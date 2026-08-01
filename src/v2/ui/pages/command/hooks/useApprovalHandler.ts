/**
 * useApprovalHandler — Handle user approval of pending tool execution
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Message, CanvasType, FlowPhase } from "../constants";
import type { ToolResult } from "../tools/types";
import type { PlanExecutionState } from "../planRunner";
import { TOOLS } from "../tools/registry";

interface ApprovalHandlerDeps {
  addMessage: (msg: Omit<Message, "id">) => void;
  ts: () => string;
  setFlowPhase: (p: FlowPhase) => void;
  setLiveResult: (v: ToolResult | null) => void;
  setCanvas: (c: CanvasType | null) => void;
  setPendingApproval: (v: { toolId: string; payload: Record<string, unknown>; prompt: string } | null) => void;
  canvasForResult: (result: ToolResult) => CanvasType;
}

export function useApprovalHandler(deps: ApprovalHandlerDeps) {
  const {
    addMessage, ts, setFlowPhase, setLiveResult, setCanvas, setPendingApproval, canvasForResult,
  } = deps;

  /** User approves a single-tool pending approval (live-approval canvas) */
  const handleApprove = useCallback(
    async (
      planStateVal: PlanExecutionState | null,
      pendingApprovalVal: { toolId: string; payload: Record<string, unknown>; prompt: string } | null,
      onApproveStep: (planStateVal: PlanExecutionState, userPrompt: string) => Promise<void>,
      onCommentNeeded: (userPrompt: string, toolId: string, result: ToolResult) => Promise<void>,
    ) => {
      if (planStateVal?.status === "awaiting-approval") {
        await onApproveStep(planStateVal, pendingApprovalVal?.prompt ?? "");
        return;
      }

      if (pendingApprovalVal) {
        const tool = TOOLS.find((t) => t.id === pendingApprovalVal.toolId);
        if (!tool) return;
        setFlowPhase("executing");
        setCanvas(null);
        setPendingApproval(null);
        addMessage({ role: "assistant", content: "Esecuzione in corso...", timestamp: ts(), agentName: "Automation" });
        try {
          const result = await tool.execute(pendingApprovalVal.prompt, {
            confirmed: true,
            payload: pendingApprovalVal.payload,
            originalPrompt: pendingApprovalVal.prompt,
          });
          setLiveResult(result);
          setCanvas(canvasForResult(result));
          setFlowPhase("done");
          if (result.kind !== "approval") {
            await onCommentNeeded(pendingApprovalVal.prompt, pendingApprovalVal.toolId, result);
          }
          toast.success("Azione completata");
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Errore";
          toast.error(msg);
          addMessage({ role: "assistant", content: `❌ Errore: ${msg}`, agentName: "Automation", timestamp: ts() });
          setFlowPhase("idle");
        }
      }
    },
    [addMessage, setCanvas, setFlowPhase, setLiveResult, setPendingApproval, ts, canvasForResult],
  );

  return { handleApprove };
}
