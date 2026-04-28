/**
 * AI Invocation Guard — Charter R1, R2, R4, R6.
 *
 * Da usare in ogni edge function AI:
 *
 *   import { aiGuard, recordInvocation } from "../_shared/aiInvocationGuard.ts";
 *   const guard = await aiGuard(req, body, supabase);
 *   if (!guard.ok) return guard.response;
 *   ...
 *   await recordInvocation(supabase, guard, { grounded, tool_calls_count, blocked });
 */
import { corsHeaders } from "./cors.ts";

export interface AiGuardContext {
  source: string;
  route?: string;
  mode?: string;
  extra?: Record<string, unknown>;
}

export interface AiGuardSpec {
  scope: string;
  context: AiGuardContext;
  enforcement_mode: "block" | "warn";
  requires_grounding: boolean;
  allowed_tools: string[] | null;
  function_name: string;
  user_id: string | null;
}

export interface AiGuardResultOk {
  ok: true;
  spec: AiGuardSpec;
}
export interface AiGuardResultErr {
  ok: false;
  response: Response;
}

const VALID_SCOPES = new Set([
  "home", "partners", "missions", "outreach", "crm", "staff",
  "strategic", "command", "email", "classify", "agent",
  "sherlock", "lab", "diagnostics", "briefing",
  // Specialized scopes (unified-assistant routes)
  "kb-supervisor", "deep-search", "chat", "mission-builder",
  "partner_hub", "cockpit", "contacts", "import", "extension",
]);

function jsonError(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: code, message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Valida scope+context. Carica config da ai_scope_registry (best-effort).
 * Non blocca se la tabella non risponde — fallback warn-mode.
 */
export async function aiGuard(
  req: Request,
  body: Record<string, unknown> | null | undefined,
  // deno-lint-ignore no-explicit-any
  supabase: any,
  functionName: string,
): Promise<AiGuardResultOk | AiGuardResultErr> {
  const scope = typeof body?.scope === "string" ? (body.scope as string) : "";
  const ctxRaw = (body?.context ?? {}) as Record<string, unknown>;
  const context: AiGuardContext = {
    source: typeof ctxRaw.source === "string" ? (ctxRaw.source as string) : "",
    route: typeof ctxRaw.route === "string" ? (ctxRaw.route as string) : undefined,
    mode: typeof ctxRaw.mode === "string" ? (ctxRaw.mode as string) : undefined,
    extra: ctxRaw.extra as Record<string, unknown> | undefined,
  };

  if (!scope) {
    return { ok: false, response: jsonError(400, "missing_scope", "Charter R1: scope obbligatorio") };
  }
  if (!VALID_SCOPES.has(scope)) {
    return { ok: false, response: jsonError(400, "invalid_scope", `scope '${scope}' non registrato`) };
  }
  if (!context.source) {
    return { ok: false, response: jsonError(400, "missing_context", "Charter R2: context.source obbligatorio") };
  }

  // Best-effort lookup config
  let enforcement_mode: "block" | "warn" = "warn";
  let requires_grounding = false;
  let allowed_tools: string[] | null = null;
  try {
    const { data } = await supabase
      .from("ai_scope_registry")
      .select("enforcement_mode, requires_grounding, allowed_tools")
      .eq("scope", scope)
      .maybeSingle();
    if (data) {
      enforcement_mode = (data.enforcement_mode as "block" | "warn") ?? "warn";
      requires_grounding = Boolean(data.requires_grounding);
      allowed_tools = (data.allowed_tools as string[] | null) ?? null;
    }
  } catch {
    // tabella non disponibile → fallback warn
  }

  // user_id da JWT (best-effort)
  let user_id: string | null = null;
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (token) {
      const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
      if (typeof payload?.sub === "string") user_id = payload.sub;
    }
  } catch { /* ignore */ }

  return {
    ok: true,
    spec: { scope, context, enforcement_mode, requires_grounding, allowed_tools, function_name: functionName, user_id },
  };
}

/** R4 — verifica grounding dopo la risposta del modello. */
export function checkGrounding(spec: AiGuardSpec, toolCallsCount: number, hasEntityHint: boolean): {
  blocked: boolean;
  reason?: string;
} {
  if (!spec.requires_grounding) return { blocked: false };
  if (toolCallsCount > 0) return { blocked: false };
  if (!hasEntityHint) return { blocked: false }; // chat conversazionale innocua
  if (spec.enforcement_mode === "warn") return { blocked: false };
  return {
    blocked: true,
    reason: `Charter R4: scope '${spec.scope}' richiede tool-grounding ma il modello non ha chiamato alcun tool.`,
  };
}

/** Heuristica entità: utile per R4. */
export function hasEntityMention(text: string): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return /(partner|partners|paese|paesi|country|countries|lead|mission|campagn|contatt|email|hq|branch|filial|sede)/i.test(t);
}

/** R6 — log invocazione. Best-effort, non blocca. */
export async function recordInvocation(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  spec: AiGuardSpec,
  result: { grounded: boolean; tool_calls_count: number; blocked: boolean; block_reason?: string },
): Promise<void> {
  try {
    await supabase.from("ai_invocation_audit").insert({
      user_id: spec.user_id,
      scope: spec.scope,
      function_name: spec.function_name,
      context_source: spec.context.source,
      enforcement_mode: spec.enforcement_mode,
      grounded: result.grounded,
      tool_calls_count: result.tool_calls_count,
      blocked: result.blocked,
      block_reason: result.block_reason ?? null,
    });
  } catch {
    // audit best-effort, non interrompiamo flusso
  }
}

/** Risposta 409 grounding_required pronta da ritornare dall'edge. */
export function groundingBlockResponse(reason: string): Response {
  return new Response(
    JSON.stringify({
      error: "grounding_required",
      message: reason,
      hint: "L'AI deve chiamare uno dei tool disponibili (es. search_partners, get_country_stats) prima di rispondere.",
    }),
    { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}