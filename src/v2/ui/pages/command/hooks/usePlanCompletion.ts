/**
 * usePlanCompletion — Render completed execution plans with results and commentary
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Message, CanvasType, FlowPhase } from "../constants";
import type { ToolResult } from "../tools/types";
import type { PlanExecutionState } from "../planRunner";
import { TOOLS } from "../tools/registry";
import type { TraceBuilder } from "../lib/toolTrace";

/** Map a ToolResult kind to the corresponding canvas type */
function canvasForResult(result: ToolResult): CanvasType {
  switch (result.kind) {
    case "table":      return "live-table";
    case "card-grid":  return "live-card-grid";
    case "timeline":   return "live-timeline";
    case "flow":       return "live-flow";
    case "composer":   return "live-composer";
    case "report":     return "live-report";
    case "approval":   return "live-approval";
    case "result":     return "live-result";
  }
}

interface PlanCompletionDeps {
  addMessage: (msg: Omit<Message, "id">) => void;
  ts: () => string;
  setFlowPhase: (p: FlowPhase) => void;
  setExecProgress: (v: number) => void;
  setLiveResult: (v: ToolResult | null) => void;
  setCanvas: (c: CanvasType | null) => void;
  setShowTools: (v: boolean) => void;
}

export function usePlanCompletion(deps: PlanCompletionDeps) {
  const {
    addMessage, ts, setFlowPhase, setExecProgress, setLiveResult, setCanvas, setShowTools,
  } = deps;

  /** Render an executed plan: messages + canvas + AI comment */
  const renderPlanCompletion = useCallback(
    async (
      userPrompt: string,
      final: PlanExecutionState,
      onCommentNeeded: (userPrompt: string, toolId: string, result: ToolResult, trace?: TraceBuilder) => Promise<void>,
      trace?: TraceBuilder,
    ) => {
      // Step-by-step recap messages
      for (const step of final.steps) {
        const r = final.results[step.stepNumber];
        const tool = TOOLS.find((t) => t.id === step.toolId);
        const countLabel = r?.meta && "count" in r.meta ? ` · ${r.meta.count}` : "";
        // Aggiungi step al trace (audit log)
        trace?.add({
          source: "tool",
          label: tool?.label ?? step.toolId,
          toolId: step.toolId,
          stepNumber: step.stepNumber,
          reasoning: step.reasoning,
          durationMs: 0,
          status: "ok",
        });
        // Propaga eventuali references dal risultato
        const refs = r?.meta?.auditRefs;
        if (refs) {
          for (const ref of refs) {
            trace?.addReference({ kind: ref.kind, label: ref.label, value: ref.value });
          }
        }
        addMessage({
          role: "assistant",
          content: `🔧 Step ${step.stepNumber}/${final.steps.length} · ${tool?.label ?? step.toolId}${countLabel}`,
          agentName: "Automation",
          timestamp: ts(),
        });
      }

      const lastStep = final.steps[final.steps.length - 1];
      const lastResult = final.results[lastStep.stepNumber];
      if (lastResult) {
        setLiveResult(lastResult);
        setCanvas(canvasForResult(lastResult));
      }

      setFlowPhase("done");
      setExecProgress(100);
      setShowTools(false);

      if (lastResult && lastResult.kind !== "approval") {
        await onCommentNeeded(userPrompt, lastStep.toolId, lastResult, trace);
      } else {
        const finalTrace = trace?.finish();
        addMessage({
          role: "assistant",
          content: `✅ Piano completato: ${final.summary}`,
          agentName: "Orchestratore",
          timestamp: ts(),
          meta: `${final.steps.length} step · plan-execution`,
          audit: finalTrace
            ? {
                phase: finalTrace.phase ?? "plan-execution",
                planSummary: finalTrace.planSummary,
                steps: finalTrace.steps
                  .filter((s) => s.source !== "comment" && s.source !== "tts")
                  .map((s, i) => ({
                    number: s.stepNumber ?? i + 1,
                    toolId: s.toolId ?? s.label,
                    label: s.toolId ? (TOOLS.find((t) => t.id === s.toolId)?.label ?? s.toolId) : s.label,
                    reasoning: s.reasoning,
                    durationMs: s.durationMs,
                    status: s.status ?? "ok",
                  })),
                driver: finalTrace.driver ?? lastStep.toolId,
                references: finalTrace.references?.map((r) => ({ kind: r.kind, label: r.label, value: r.value })),
                totalMs: finalTrace.totalMs,
              }
            : undefined,
        });
      }
      toast.success("Piano completato");
    },
    [addMessage, setCanvas, setExecProgress, setFlowPhase, setLiveResult, setShowTools, ts],
  );

  return { renderPlanCompletion, canvasForResult };
}
