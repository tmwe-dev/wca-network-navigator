/**
 * invokeAi — Gateway SSOT per invocazioni AI dal frontend.
 *
 * Vedi docs/ai/AI_INVOCATION_CHARTER.md.
 *
 * Regole inviolabili (R1-R8):
 *  - scope obbligatorio (registrato in ai_scope_registry)
 *  - context obbligatorio (audit)
 *  - tutte le edge AI passano da qui (no supabase.functions.invoke diretto)
 *
 * Wrapping su invokeEdge per ereditare retry/error normalization.
 */
import { invokeEdge, type InvokeEdgeOptions } from "@/lib/api/invokeEdge";
import { traceCollector } from "@/v2/observability/traceCollector";
import { Sentry } from "@/lib/sentry";

export type AiScope =
  | "home"
  | "partners"
  | "missions"
  | "outreach"
  | "crm"
  | "staff"
  | "strategic"
  | "command"
  | "email"
  | "classify"
  | "agent"
  | "sherlock"
  | "lab"
  | "diagnostics"
  | "briefing";

export interface AiContext {
  /** componente o hook chiamante, es. "HomeAIPrompt" */
  source: string;
  /** rotta corrente, es. "/v2" */
  route?: string;
  /** modalità operativa documentale, es. "tool-decision" | "generate" */
  mode?: string;
  /** payload contestuale extra (filtri, IDs, ecc.) */
  extra?: Record<string, unknown>;
}

export interface InvokeAiOptions<TBody = Record<string, unknown>> {
  scope: AiScope;
  context: AiContext;
  /** corpo specifico della funzione (messages, prompt, body custom...) */
  body: TBody;
  headers?: Record<string, string>;
}

/** Set delle edge function considerate "AI" — usato anche dal lint/audit. */
export const AI_FUNCTION_NAMES = new Set<string>([
  "ai-assistant",
  "agent-execute",
  "agent-loop",
  "agent-simulate",
  "agent-prompt-refiner",
  "agent-task-drainer",
  "unified-assistant",
  "generate-email",
  "generate-outreach",
  "improve-email",
  "classify-email-response",
  "classify-inbound-message",
  "categorize-content",
  "suggest-email-groups",
  "parse-business-card",
  "agentic-decide",
  "sherlock-extract",
  "prompt-test-runner",
  "daily-briefing",
  "save-correction-memory",
]);

export async function invokeAi<TResponse = unknown, TBody = Record<string, unknown>>(
  functionName: string,
  options: InvokeAiOptions<TBody>,
): Promise<TResponse> {
  const { scope, context, body, headers } = options;

  if (!scope) {
    throw new Error(`[invokeAi] scope obbligatorio (Charter R1) per ${functionName}`);
  }
  if (!context?.source) {
    throw new Error(`[invokeAi] context.source obbligatorio (Charter R2) per ${functionName}`);
  }

  // Inietta scope+context nel body inviato all'edge function.
  // Ogni edge AI deve leggerli via _shared/aiInvocationGuard.ts.
  const enrichedBody = {
    ...(body as Record<string, unknown>),
    scope,
    context: {
      source: context.source,
      route: context.route,
      mode: context.mode,
      extra: context.extra,
    },
  };

  const invokeOpts: InvokeEdgeOptions = {
    body: enrichedBody,
    context: `${scope}:${context.source}`,
    headers,
  };

  // Trace AI: avvolge l'invocazione in un correlation_id condiviso con
  // l'evento `edge.invoke` interno (che riusa il correlation attivo).
  const corr = traceCollector.startCorrelation();
  const route = typeof window !== "undefined" ? window.location.pathname : undefined;
  const start = Date.now();
  try {
    const res = await invokeEdge<TResponse>(functionName, invokeOpts);
    traceCollector.push({
      type: "ai.invoke",
      scope,
      source: `${functionName}:${context.source}`,
      route,
      status: "success",
      duration_ms: Date.now() - start,
      payload_summary: { functionName, mode: context.mode },
      correlation_id: corr,
    });
    return res;
  } catch (err) {
    const e = err as { message?: string; code?: string; httpStatus?: number };
    traceCollector.push({
      type: "ai.invoke",
      scope,
      source: `${functionName}:${context.source}`,
      route,
      status: "error",
      duration_ms: Date.now() - start,
      payload_summary: { functionName, mode: context.mode },
      error: { message: e?.message ?? String(err), code: e?.code, status: e?.httpStatus },
      correlation_id: corr,
    });
    // Charter R6 — surface AI failures to Sentry with full context for triage.
    Sentry.captureException(err, {
      tags: { invocation: "ai", scope, fn: functionName, source: context.source },
      extra: {
        mode: context.mode,
        route,
        duration_ms: Date.now() - start,
        correlation_id: corr,
        httpStatus: e?.httpStatus,
        code: e?.code,
      },
    });
    throw err;
  } finally {
    traceCollector.endCorrelation(corr);
  }
}