/**
 * dispatch-urgent-alert — Invio autonomo di alert WhatsApp ai responsabili
 * configurati in `alert_recipients` per messaggi inbound classificati P1.
 *
 * Bypassa journalistReview: il messaggio è un TEMPLATE FISSO di sistema, non
 * contenuto AI free-form. Idempotente per (recipient_id, message_id).
 *
 * Chiamato fire-and-forget da classify-inbound-message quando il triage
 * indica `should_alert = true`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";

interface Body {
  user_id: string;
  message_id: string;
  from_address: string;
  subject: string;
  business_category: string;
  urgency_score: number;
  alert_categories: string[];
  summary: string;
  channel?: string;
}

interface RecipientRow {
  id: string;
  name: string;
  whatsapp_e164: string;
  categories: string[];
  min_urgency_score: number;
  is_active: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  timezone: string | null;
}

function inQuietHours(start: string | null, end: string | null, tz: string | null): boolean {
  if (!start || !end) return false;
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz || "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const hhmm = fmt.format(now);
    if (start <= end) return hhmm >= start && hhmm < end;
    return hhmm >= start || hhmm < end;
  } catch {
    return false;
  }
}

function buildTemplate(b: Body, recipientName: string): string {
  const cat = b.business_category.toUpperCase();
  const subj = (b.subject || "").slice(0, 80);
  const summary = (b.summary || "").slice(0, 240);
  return `🚨 ALERT TMWE [${cat} · urgency ${b.urgency_score}]
Per: ${recipientName}
Da: ${b.from_address}
Oggetto: ${subj}

${summary}

Apri: https://wca-network-navigator.lovable.app/v2/email-intelligence?msg=${b.message_id}`;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const headers = getSecurityHeaders(getCorsHeaders(req.headers.get("origin")));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers });
  }

  if (!body.user_id || !body.message_id || !Array.isArray(body.alert_categories)) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400, headers });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  // Carica destinatari attivi del proprietario con almeno una categoria che interseca.
  const { data, error } = await supabase
    .from("alert_recipients")
    .select("id,name,whatsapp_e164,categories,min_urgency_score,is_active,quiet_hours_start,quiet_hours_end,timezone")
    .eq("user_id", body.user_id)
    .eq("is_active", true)
    .overlaps("categories", body.alert_categories);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }

  const recipients = (data ?? []) as RecipientRow[];
  const matched = recipients.filter(
    (r) => body.urgency_score >= (r.min_urgency_score ?? 70),
  );

  const dispatched: string[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const r of matched) {
    if (inQuietHours(r.quiet_hours_start, r.quiet_hours_end, r.timezone)) {
      skipped.push({ id: r.id, reason: "quiet_hours" });
      continue;
    }

    // Idempotenza: skip se già loggato per (recipient, message)
    const { data: existing } = await supabase
      .from("alert_dispatch_log")
      .select("id")
      .eq("recipient_id", r.id)
      .eq("message_id", body.message_id)
      .maybeSingle();
    if (existing) {
      skipped.push({ id: r.id, reason: "duplicate" });
      continue;
    }

    const text = buildTemplate(body, r.name);

    // Inserisce nella coda extension WhatsApp (system alert, no journalist review)
    const { error: qErr } = await supabase.from("extension_dispatch_queue").insert({
      user_id: body.user_id,
      channel: "whatsapp",
      recipient: r.whatsapp_e164,
      message_text: text,
      status: "pending",
    });

    const status = qErr ? "failed" : "sent";
    await supabase.from("alert_dispatch_log").insert({
      user_id: body.user_id,
      recipient_id: r.id,
      message_id: body.message_id,
      channel: "whatsapp",
      business_category: body.business_category,
      urgency_score: body.urgency_score,
      alert_categories: body.alert_categories,
      payload: { text, is_system_alert: true, summary: body.summary },
      status,
      error: qErr?.message ?? null,
      dedup_key: `${r.id}:${body.message_id}`,
    });

    if (qErr) skipped.push({ id: r.id, reason: qErr.message });
    else dispatched.push(r.id);
  }

  return new Response(
    JSON.stringify({ ok: true, dispatched: dispatched.length, skipped }),
    { status: 200, headers },
  );
});