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
import {
  messagePipelineBus,
  newPipelineId,
  replayServerTrace,
  type PipelineStageId,
  type PipelineStageStatus,
} from "@/lib/messaging/pipelineBus";

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
  | "briefing"
  | "kb-supervisor"
  | "deep-search"
  | "chat"
  | "mission-builder"
  | "partner_hub"
  | "cockpit"
  | "contacts"
  | "import"
  | "extension";

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

  // Pipeline tracker: only for message-generation endpoints. The user wants
  // to "see the paper move from room to room" while a message is built.
  const pipelineFnMap: Record<string, "email" | "whatsapp" | "linkedin" | "generic"> = {
    "generate-email": "email",
    "improve-email": "email",
    "generate-outreach": "generic", // refined below from body.channel if present
  };
  const pipelineChannelHint = pipelineFnMap[functionName];
  const pipelineId = pipelineChannelHint ? newPipelineId() : null;
  if (pipelineId && pipelineChannelHint) {
    const bodyAny = body as Record<string, unknown>;
    const ch = (bodyAny?.channel as string | undefined) ?? pipelineChannelHint;
    const channel: "email" | "whatsapp" | "linkedin" | "generic" =
      ch === "whatsapp" || ch === "linkedin" || ch === "email" ? ch : "generic";
    const labelHint =
      (bodyAny?.subject as string | undefined) ||
      (bodyAny?.recipient_name as string | undefined) ||
      (context.extra?.label as string | undefined) ||
      undefined;
    messagePipelineBus.start({
      pipelineId,
      channel,
      surface: context.source,
      label: labelHint,
    });
    // Mark first stage as running optimistically so user sees movement immediately.
    messagePipelineBus.update(pipelineId, "contract", { status: "running" });
  }

  try {
    const res = await invokeEdge<TResponse>(functionName, invokeOpts);
    // If the edge returned a pipeline_trace, replay it progressively.
    if (pipelineId && res && typeof res === "object") {
      const trace = (res as { pipeline_trace?: Array<{ stage: PipelineStageId; status: PipelineStageStatus; durationMs?: number; detail?: string }> })
        .pipeline_trace;
      if (Array.isArray(trace) && trace.length > 0) {
        // Fire and forget — don't block the caller.
        void replayServerTrace(pipelineId, trace).then(() => {
          messagePipelineBus.end(pipelineId, "done");
        });
      } else {
        // No trace from server: just close cleanly.
        messagePipelineBus.end(pipelineId, "done");
      }
    }
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
    if (pipelineId) {
      messagePipelineBus.end(pipelineId, "error");
    }
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