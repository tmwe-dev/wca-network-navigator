/**
 * usePlanExecution — Execute and manage multi-step plans with progress tracking
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Message, FlowPhase } from "../constants";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import type { ToolResult } from "../tools/types";
import type { PlanExecutionState } from "../planRunner";
import type { CanvasType } from "../constants";
import {
  executePlan,
  executeApprovedStep,
  MAX_PLAN_STEPS,
} from "../planRunner";
import type { TraceBuilder } from "../lib/toolTrace";

interface PlanExecutionDeps {
  addMessage: (msg: Omit<Message, "id">) => void;
  ts: () => string;
  setFlowPhase: (p: FlowPhase) => void;
  setExecProgress: (v: number) => void;
  setPlanState: (v: PlanExecutionState | null) => void;
  setLiveResult: (v: ToolResult | null) => void;
  setCanvas: (c: CanvasType | null) => void;
  setShowTools: (v: boolean) => void;
  buildHistory: () => { role: "user" | "assistant"; content: string }[];
}

export function usePlanExecution(deps: PlanExecutionDeps) {
  const {
    addMessage, ts, setFlowPhase, setExecProgress, setPlanState, setLiveResult, setCanvas, setShowTools, buildHistory,
  } = deps;

  /** Run a plan to completion (or pause for per-step approval) */
  const runPlan = useCallback(
    async (
      planStateVal: PlanExecutionState,
      userPrompt: string,
      hint: string,
      onCompletion: (final: PlanExecutionState) => Promise<void>,
      trace?: TraceBuilder,
    ) => {
      const final = await executePlan(
        planStateVal,
        (s) => {
          setPlanState(s);
          const done = Object.keys(s.results).length;
          const total = planStateVal.steps.length || 1;
          setExecProgress(Math.round((done / total) * 100));
        },
        undefined,
        { originalPrompt: userPrompt, contextHint: hint, history: buildHistory() },
      );

      if (final.status === "awaiting-approval") {
        setFlowPhase("proposal");
        trace?.add({
          source: "tool",
          label: "awaiting-approval",
          stepNumber: final.approvalStepNumber,
          status: "approved",
          durationMs: 0,
        });
        addMessage({
          role: "assistant",
          content: `⏸ Step ${final.approvalStepNumber} richiede la tua approvazione. Conferma per procedere.`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        return;
      }

      if (final.status === "done") {
        await onCompletion(final);
        return;
      }

      if (final.status === "error") {
        toast.error(final.error ?? "Errore esecuzione piano");
        addMessage({
          role: "assistant",
          content: `❌ Piano fallito: ${final.error}\n\nRiformula la richiesta o specifica meglio cosa vuoi ottenere.`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        setFlowPhase("idle");
      }
    },
    [addMessage, buildHistory, setExecProgress, setFlowPhase, setPlanState, ts],
  );

  /** User approved a paused write-step → continue the plan */
  const handleApproveStep = useCallback(
    async (
      planStateVal: PlanExecutionState,
      userPrompt: string,
      onCompletion: (final: PlanExecutionState) => Promise<void>,
      trace?: TraceBuilder,
    ) => {
      if (planStateVal.status !== "awaiting-approval") return;
      setFlowPhase("executing");
      addMessage({
        role: "assistant",
        content: `✓ Step ${planStateVal.approvalStepNumber} approvato. Continuo...`,
        agentName: "Automation",
        timestamp: ts(),
      });
      const final = await executeApprovedStep(
        planStateVal,
        (s) => {
          setPlanState(s);
          const done = Object.keys(s.results).length;
          const total = planStateVal.steps.length || 1;
          setExecProgress(Math.round((done / total) * 100));
        },
        { originalPrompt: userPrompt, history: buildHistory() },
      );
      if (final.status === "awaiting-approval") {
        setFlowPhase("proposal");
        addMessage({
          role: "assistant",
          content: `⏸ Step ${final.approvalStepNumber} richiede la tua approvazione.`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        return;
      }
      if (final.status === "done") {
        await onCompletion(final);
        return;
      }
      if (final.status === "error") {
        toast.error(final.error ?? "Errore");
        addMessage({
          role: "assistant",
          content: `❌ ${final.error}`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        setFlowPhase("idle");
      }
    },
    [addMessage, setExecProgress, setFlowPhase, setPlanState, ts],
  );

  return { runPlan, handleApproveStep };
}
