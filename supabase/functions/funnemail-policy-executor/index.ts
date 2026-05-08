/**
 * funnemail-policy-executor — Sprint 3.
 *
 * Esegue UNA singola azione (action_type) in modo idempotente. Hard guards:
 *  - draft_reply / autoresponder NON vengono mai inviate da qui: solo log
 *    intent + delega ai flussi esistenti (generate-email con journalistReview
 *    o funnemail-send-autoresponder per template-only). Vedi memoria
 *    "autoresponder-template-only-exception" e "editorial-review-layer-mandatory".
 *  - Idempotenza tramite UNIQUE INDEX su (message_id, idempotency_key).
 *  - Auth: solo internal token o JWT utente. Mai pubblico.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";

const KNOWN_ACTIONS = new Set([
  "tag_only", "deep_search", "draft_reply", "crm_update",
  "imap_action", "escalate", "autoresponder", "snooze",
]);

interface ExecBody {
  message_id: string;
  user_id?: string | null;
  from_address: string;
  partner_id?: string | null;
  group_id?: string | null;
  action_type: string;
  params?: Record<string, unknown>;
  idempotency_key?: string;
}

// deno-lint-ignore no-explicit-any
type Sb = any;

async function claimIdempotent(
  supabase: Sb,
  body: ExecBody,
  status: string,
  payload: Record<string, unknown>,
  error?: string | null,
): Promise<{ claimed: boolean; reason?: string }> {
  const idemKey = body.idempotency_key ?? body.action_type;
  const { error: insErr } = await supabase.from("funnemail_actions_log").insert({
    message_id: body.message_id,
    user_id: body.user_id ?? null,
    group_id: body.group_id ?? null,
    from_address: body.from_address,
    partner_id: body.partner_id ?? null,
    action: body.action_type,
    action_type: body.action_type,
    idempotency_key: idemKey,
    status,
    payload,
    error: error ?? null,
  });
  if (insErr) {
    if ((insErr as { code?: string }).code === "23505") return { claimed: false, reason: "duplicate" };
    return { claimed: false, reason: insErr.message ?? String(insErr) };
  }
  return { claimed: true };
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("funnemail-policy-executor");

  try {
    const body = (await req.json().catch(() => ({}))) as ExecBody;
    const auth = await requireInternalOrUser(req, body.user_id ?? null, headers);
    if (auth.kind === "error") {
      endMetrics(metrics, false, 401);
      return auth.response;
    }

    if (!body.message_id || !body.action_type || !body.from_address) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "missing message_id, from_address or action_type" }), { status: 400, headers });
    }
    if (!KNOWN_ACTIONS.has(body.action_type)) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: `unknown action_type: ${body.action_type}` }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Hard guard: draft_reply NON parte mai da qui (richiede journalistReview).
    if (body.action_type === "draft_reply") {
      const claim = await claimIdempotent(supabase, body, "queued", {
        ...(body.params ?? {}),
        note: "deferred to outreach orchestrator (journalistReview enforced there)",
      });
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, action: "draft_reply", ...claim }), { status: 200, headers });
    }

    // Hard guard: autoresponder DEVE passare da funnemail-send-autoresponder (template-only).
    if (body.action_type === "autoresponder") {
      const claim = await claimIdempotent(supabase, body, "queued", {
        ...(body.params ?? {}),
        note: "must be executed via funnemail-send-autoresponder (template-only)",
      });
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, action: "autoresponder", ...claim }), { status: 200, headers });
    }

    // tag_only / crm_update / snooze / escalate → log idempotente (side-effect ridotti).
    // imap_action / deep_search → al momento solo claim; l'esecuzione effettiva resta
    // affidata ai flussi esistenti (apply-email-rules, sherlock-extract).
    const claim = await claimIdempotent(supabase, body, "ok", body.params ?? {});

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({ ok: true, action: body.action_type, ...claim }), { status: 200, headers });
  } catch (e) {
    logEdgeError("funnemail-policy-executor", e);
    endMetrics(metrics, false, 500);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});