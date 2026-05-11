/**
 * funnemail-backfill-inbound — Riprocessa retro-attivamente le inbound non
 * classificate degli ultimi N giorni invocando `funnemail-classify` per ogni
 * messaggio. Idempotente (skip se già presente in funnemail_decisions).
 *
 * Modalità:
 *  - dry_run=true (default): NON invia nulla, ritorna solo il piano.
 *  - dry_run=false: dispatcha effettivamente verso funnemail-classify.
 *
 * Auth: solo chiamate utente autenticato (admin) o internal token.
 * Hard guards: limit massimo 200 messaggi/run, no scrittura su autoresponder.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";

const MAX_BATCH = 200;
const DEFAULT_DAYS = 7;

interface BackfillRequest {
  days?: number;
  limit?: number;
  dry_run?: boolean;
  user_id?: string | null;
  group_ids?: string[]; // se omesso, tutti i gruppi pilot funnemail_enabled
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const headers = getSecurityHeaders(getCorsHeaders(req.headers.get("origin")));

  try {
    const body: BackfillRequest = await req.json().catch(() => ({} as BackfillRequest));
    const auth = await requireInternalOrUser(req, body.user_id, headers);
    if (auth.kind === "error") return auth.response;

    const days = Math.min(Math.max(body.days ?? DEFAULT_DAYS, 1), 30);
    const limit = Math.min(Math.max(body.limit ?? 50, 1), MAX_BATCH);
    const dryRun = body.dry_run !== false; // default true

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Risolvi gruppi pilot
    let groupIds = body.group_ids ?? [];
    if (groupIds.length === 0) {
      const { data: groups } = await supabase
        .from("email_sender_groups")
        .select("id")
        .eq("funnemail_enabled", true);
      groupIds = (groups ?? []).map((g) => g.id);
    }
    if (groupIds.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, dry_run: dryRun, eligible: 0, dispatched: 0, reason: "no_pilot_groups" }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    // 2. Trova inbound non classificate degli ultimi N gg
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { data: msgs, error: msgErr } = await supabase
      .from("channel_messages")
      .select("id, from_address, subject, body_text, partner_id, user_id, group_id")
      .eq("direction", "inbound")
      .eq("channel", "email")
      .gte("created_at", since)
      .in("group_id", groupIds)
      .is("ai_classification_suggestion", null)
      .limit(limit * 2);
    if (msgErr) throw msgErr;

    // 3. Filtra già presenti in funnemail_decisions (idempotenza)
    const candidateIds = (msgs ?? []).map((m) => m.id);
    let alreadyDone = new Set<string>();
    if (candidateIds.length > 0) {
      const { data: done } = await supabase
        .from("funnemail_decisions")
        .select("message_id")
        .in("message_id", candidateIds);
      alreadyDone = new Set((done ?? []).map((r: { message_id: string }) => r.message_id));
    }
    const eligible = (msgs ?? []).filter((m) => !alreadyDone.has(m.id)).slice(0, limit);

    const plan = eligible.map((m) => ({
      message_id: m.id,
      from_address: m.from_address,
      subject: (m.subject ?? "").slice(0, 80),
      group_id: m.group_id,
    }));

    if (dryRun) {
      return new Response(
        JSON.stringify({ ok: true, dry_run: true, eligible: eligible.length, dispatched: 0, plan }),
        { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    // 4. Dispatch reale verso funnemail-classify (sequenziale, soft-fail per riga)
    const results: Array<{ message_id: string; status: string; error?: string }> = [];
    for (const m of eligible) {
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/funnemail-classify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-internal-token": serviceKey,
          },
          body: JSON.stringify({
            message_id: m.id,
            from_address: m.from_address ?? "",
            subject: m.subject ?? "",
            body_text: m.body_text ?? "",
            partner_id: m.partner_id ?? null,
            user_id: m.user_id ?? null,
          }),
        });
        const txt = await resp.text();
        results.push({
          message_id: m.id,
          status: resp.ok ? "ok" : `http_${resp.status}`,
          error: resp.ok ? undefined : txt.slice(0, 200),
        });
      } catch (e) {
        results.push({ message_id: m.id, status: "exception", error: String(e).slice(0, 200) });
      }
    }

    const okCount = results.filter((r) => r.status === "ok").length;
    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: false,
        eligible: eligible.length,
        dispatched: results.length,
        succeeded: okCount,
        failed: results.length - okCount,
        results,
      }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e instanceof Error ? e.message : e) }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }
});