/**
 * auditFromTrace — converte un ToolTrace in un MessageAudit pronto da
 * appendere al messaggio del Direttore per render visibile in Command.
 */
import type { ToolTrace } from "./toolTrace";
import type { MessageAudit, AuditStep, AuditReference } from "../constants";
import { TOOLS } from "../tools/registry";

function labelForToolId(toolId?: string): string {
  if (!toolId) return "—";
  return TOOLS.find((t) => t.id === toolId)?.label ?? toolId;
}

export function buildAuditFromTrace(trace: ToolTrace): MessageAudit {
  const phase = trace.phase ?? "fast-lane";

  // Filtra step "tecnici" (comment, tts) e tieni solo quelli che hanno toolId esplicito
  // o sono planner/tool: in mancanza di toolId, usa label.
  const steps: AuditStep[] = trace.steps
    .filter((s) => s.source !== "comment" && s.source !== "tts")
    .map((s, i) => ({
      number: s.stepNumber ?? i + 1,
      toolId: s.toolId ?? s.label,
      label: s.toolId ? labelForToolId(s.toolId) : s.label,
      reasoning: s.reasoning,
      durationMs: s.durationMs,
      status: s.status ?? "ok",
    }));

  const driver = trace.driver
    ?? (steps.length > 0 ? steps[steps.length - 1].toolId : "unknown");

  const references: AuditReference[] = (trace.references ?? []).map((r) => ({
    kind: r.kind,
    label: r.label,
    value: r.value,
  }));

  return {
    phase,
    planSummary: trace.planSummary,
    steps,
    driver,
    references,
    totalMs: trace.totalMs,
  };
}