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

  return invokeEdge<TResponse>(functionName, invokeOpts);
}