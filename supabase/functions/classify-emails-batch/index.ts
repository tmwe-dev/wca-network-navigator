/**
 * classify-emails-batch — Cron fallback per inbound non classificati.
 *
 * Trova channel_messages.direction='inbound' senza riga in reply_classifications
 * (ultime 24h) e invoca classify-inbound-message per ciascuno (max 50/cycle).
 *
 * Indipendente dal trigger DB on_inbound_message: garantisce che, se il trigger
 * fallisce (es. GUC service_role_key non set, network error), la classificazione
 * AI + funnemail + post-pipeline parta comunque.
 *
 * Idempotente lato classify-inbound-message (vedi guard reply_classifications).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";

const BATCH_SIZE = 50;
const LOOKBACK_HOURS = 24;

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders(corsH);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const sinceIso = new Date(
      Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000,
    ).toISOString();

    // Trova candidati: inbound recenti senza classificazione.
    const { data: pending, error: selErr } = await supabase
      .from("channel_messages")
      .select("id, channel, from_address, subject, body_text, body_html, partner_id, user_id, raw_payload")
      .eq("direction", "inbound")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(500);

    if (selErr) {
      return new Response(
        JSON.stringify({ error: "select_failed", details: selErr.message }),
        { status: 500, headers },
      );
    }

    const candidateIds = (pending ?? []).map((m) => m.id as string);
    if (candidateIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, candidates: 0 }),
        { status: 200, headers },
      );
    }

    const { data: alreadyClassified } = await supabase
      .from("reply_classifications")
      .select("message_id")
      .in("message_id", candidateIds);

    const classifiedSet = new Set(
      (alreadyClassified ?? []).map((r) => r.message_id as string),
    );

    const toProcess = (pending ?? [])
      .filter((m) => !classifiedSet.has(m.id as string))
      .slice(0, BATCH_SIZE);

    if (toProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, candidates: candidateIds.length }),
        { status: 200, headers },
      );
    }

    let dispatched = 0;
    for (const msg of toProcess) {
      const payload = (msg.raw_payload ?? {}) as Record<string, unknown>;
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/classify-inbound-message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            message_id: msg.id,
            activity_id: (payload.source_activity_id as string) || null,
            channel: msg.channel || "email",
            body_text: (msg.body_text as string) || (msg.body_html as string) || "",
            from_address: msg.from_address || "",
            subject: msg.subject || "",
            partner_id: msg.partner_id || null,
            mission_id: (payload.mission_id as string) || null,
            user_id: msg.user_id || null,
          }),
        });
        // Consume body to avoid resource leak (Deno).
        try { await resp.text(); } catch (_) { /* noop */ }
        if (resp.ok) dispatched += 1;
      } catch (_e) {
        // continue
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        candidates: candidateIds.length,
        unclassified: toProcess.length,
        dispatched,
      }),
      { status: 200, headers },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "batch_failed", details: (e as Error).message }),
      { status: 500, headers },
    );
  }
});