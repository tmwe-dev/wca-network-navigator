/**
 * funnemail-policy-engine — Sprint 3.
 *
 * Risolve la policy effettiva (per-user override → group default) per un
 * messaggio inbound già classificato e ritorna il PIANO di azioni da
 * eseguire (action_type + params + idempotency_key). NON esegue side-effect:
 * solo lettura + composizione. È pensato per:
 *   - debug/inspection dalla UI (preview "cosa farebbe Funnemail?")
 *   - chiamate da orchestratori che vogliono eseguire azioni una alla volta
 *
 * Auth: solo internal (x-internal-token = SUPABASE_SERVICE_ROLE_KEY) o JWT utente.
 * Mai pubblico/anonimo.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";

interface ReqBody {
  message_id: string;
  user_id?: string | null;
  from_address: string;
  partner_id?: string | null;
  classification?: string;
  confidence?: number;
}

interface PlannedAction {
  action_type: string;
  params: Record<string, unknown>;
  idempotency_key: string;
  source: "policy" | "fallback";
}

const ALLOWED_ACTIONS = new Set([
  "tag_only", "deep_search", "draft_reply", "crm_update",
  "imap_action", "escalate", "autoresponder", "snooze",
]);

function buildPlanFromPolicy(policy: Record<string, unknown> | null, body: ReqBody): PlannedAction[] {
  const out: PlannedAction[] = [];
  if (!policy) return out;
  const requested = Array.isArray(policy.actions) ? (policy.actions as string[]) : [];
  const minConf = Number(policy.min_confidence ?? 0);
  const above = (body.confidence ?? 0) >= minConf;
  for (const a of requested) {
    if (!ALLOWED_ACTIONS.has(a)) continue;
    if (!above && a !== "tag_only") continue;
    out.push({
      action_type: a,
      params: (policy[a] as Record<string, unknown>) ?? {},
      idempotency_key: a,
      source: "policy",
    });
  }
  return out;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("funnemail-policy-engine");

  try {
    const auth = await requireInternalOrUser(req);
    if (auth instanceof Response) {
      endMetrics(metrics, false, auth.status);
      return auth;
    }

    const body = (await req.json()) as ReqBody;
    if (!body.message_id || !body.from_address) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "missing message_id or from_address" }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // 1) Per-user override
    let effective: { scope: string; policy: Record<string, unknown> | null } | null = null;
    if (body.user_id) {
      const { data } = await supabase.rpc("resolve_funnemail_policy", {
        p_user_id: body.user_id,
        p_from_address: body.from_address,
        p_group_id: null,
      }).maybeSingle();
      if (data) effective = { scope: data.scope, policy: data.policy as Record<string, unknown> };
    }

    // 2) Fallback: policy del gruppo del mittente (email_sender_groups)
    let groupId: string | null = null;
    if (!effective) {
      const { data: rule } = await supabase
        .from("email_address_rules")
        .select("group_id")
        .eq("email_address", body.from_address.toLowerCase())
        .not("group_id", "is", null)
        .limit(1)
        .maybeSingle();
      groupId = rule?.group_id ?? null;
      if (groupId) {
        const { data: grp } = await supabase
          .from("email_sender_groups")
          .select("funnemail_enabled, funnemail_policy")
          .eq("id", groupId)
          .maybeSingle();
        if (grp?.funnemail_enabled) {
          effective = { scope: "group", policy: (grp.funnemail_policy ?? {}) as Record<string, unknown> };
        }
      }
    }

    const plan = buildPlanFromPolicy(effective?.policy ?? null, body);

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({
      message_id: body.message_id,
      effective_scope: effective?.scope ?? "none",
      group_id: groupId,
      plan,
    }), { status: 200, headers });
  } catch (e) {
    logEdgeError("funnemail-policy-engine", e);
    endMetrics(metrics, false, 500);
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});