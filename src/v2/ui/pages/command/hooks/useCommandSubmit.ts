/**
 * useCommandSubmit — Conversational AI orchestrator for the Command Page.
 *
 * Flow for every user prompt:
 *   1. Push user message + thinking indicator
 *   2. Lexical normalization (typo fix: pane→partner, nyc→New York, ecc.)
 *   3. FAST LANE: if prompt clearly matches `ai-query` and is single-shot, skip
 *      planExecution and run aiQueryTool directly (with conversational context).
 *   4. Otherwise: planExecution → planRunner → per-step approval (write tools)
 *   5. Conversational AI comment + suggested next actions on the final result
 *   6. Persist last query "shape" in queryContext for follow-up handling
 *
 * Refactored into sub-modules:
 *   - useCommandHistory: Build and manage conversation history
 *   - usePromptAnalysis: Analyze prompts for execution strategy
 *   - useResultCommentary: Generate AI commentary on results
 *   - useQueryContext: Manage conversational context persistence
 *   - usePlanExecution: Execute multi-step plans
 *   - usePlanCompletion: Render completed plans
 *   - useFastLane: Direct tool execution for simple queries
 *   - useApprovalHandler: Handle user approvals
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import { TOOLS, TOOL_METADATA } from "../tools/registry";
import type { ToolResult } from "../tools/types";
import { planExecution } from "@/v2/io/edge/aiAssistant";
import {
  buildInitialStepStates,
  MAX_PLAN_STEPS,
  type PlanExecutionState,
} from "../planRunner";
import { normalizePrompt } from "../lib/lexicalNormalizer";
import {
  contextHint as buildContextHint,
  isContextFresh,
  isElliptical,
  type QueryContext,
} from "../lib/queryContext";
import type { Message, CanvasType, FlowPhase } from "../constants";
import { startTrace, type TraceBuilder } from "../lib/toolTrace";

import { useCommandHistory } from "./useCommandHistory";
import { usePromptAnalysis } from "./usePromptAnalysis";
import { useResultCommentary } from "./useResultCommentary";
import { useQueryContext } from "./useQueryContext";
import { usePlanExecution } from "./usePlanExecution";
import { usePlanCompletion } from "./usePlanCompletion";
import { useFastLane } from "./useFastLane";
import { useApprovalHandler } from "./useApprovalHandler";

interface CommandStateApi {
  addMessage: (msg: Omit<Message, "id">) => void;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setCanvas: (c: CanvasType) => void;
  setFlowPhase: (p: FlowPhase) => void;
  setShowTools: (v: boolean) => void;
  setToolPhase: (v: "activating" | "active" | "done") => void;
  setChainHighlight: (v: number | undefined | ((prev: number | undefined) => number | undefined)) => void;
  setExecSteps: (v: ExecutionStep[] | ((prev: ExecutionStep[]) => ExecutionStep[])) => void;
  setExecProgress: (v: number) => void;
  setLiveResult: (v: ToolResult | null) => void;
  setPendingApproval: (v: { toolId: string; payload: Record<string, unknown>; prompt: string } | null) => void;
  setPlanState: (v: PlanExecutionState | null) => void;
  setActiveToolKey: (v: string | null) => void;
  setVoiceSpeaking: (v: boolean) => void;
  resetForNewMessage: () => void;
  ts: () => string;
  governance: { role: string; permission: string; policy: string };
  ttsSpeak: (text: string) => void;
  /** Last N messages for AI conversational context */
  messages: Message[];
  /** Conversational query context (for follow-ups) */
  queryContext: QueryContext | null;
  setQueryContext: (v: QueryContext | null) => void;
}

export function useCommandSubmit(state: CommandStateApi) {
  const {
    addMessage, setMessages, setCanvas, setFlowPhase, setShowTools, setToolPhase,
    setChainHighlight, setExecSteps, setExecProgress, setLiveResult,
    setPendingApproval, setPlanState, setActiveToolKey,
    setVoiceSpeaking, resetForNewMessage, ts, governance, ttsSpeak, messages,
    queryContext, setQueryContext,
  } = state;

  // Initialize sub-hooks
  const { buildHistory } = useCommandHistory(messages);
  const { looksLikeSimpleQuery } = usePromptAnalysis();
  const { commentOnResult } = useResultCommentary({
    addMessage, ts, governance, ttsSpeak, setVoiceSpeaking, buildHistory,
  });
  const { updateQueryContextFromLastPlan, isContextUsable } = useQueryContext({
    setQueryContext, queryContext,
  });
  const { renderPlanCompletion, canvasForResult } = usePlanCompletion({
    addMessage, ts, setFlowPhase, setExecProgress, setLiveResult, setCanvas, setShowTools,
  });
  const { runPlan, handleApproveStep: handleApproveStepFromExecution } = usePlanExecution({
    addMessage, ts, setFlowPhase, setExecProgress, setPlanState, setLiveResult, setCanvas, setShowTools, buildHistory,
  });
  const { runFastLane } = useFastLane({
    addMessage, ts, setFlowPhase, setExecProgress, setLiveResult, setCanvas, setShowTools,
    setActiveToolKey, setToolPhase, setChainHighlight, setExecSteps, buildHistory, canvasForResult,
  });
  const { handleApprove } = useApprovalHandler({
    addMessage, ts, setFlowPhase, setLiveResult, setCanvas, setPendingApproval, canvasForResult,
  });

  // Wrapper for plan completion that updates query context
  const renderPlanWithContext = useCallback(
    async (userPrompt: string, final: PlanExecutionState, trace?: TraceBuilder) => {
      await renderPlanCompletion(userPrompt, final, commentOnResult, trace);
      updateQueryContextFromLastPlan();
    },
    [renderPlanCompletion, commentOnResult, updateQueryContextFromLastPlan],
  );

  // Wrapper for runPlan that integrates with completion
  const runPlanWrapped = useCallback(
    async (planStateVal: PlanExecutionState, userPrompt: string, hint: string, trace?: TraceBuilder) => {
      await runPlan(
        planStateVal,
        userPrompt,
        hint,
        (final) => renderPlanWithContext(userPrompt, final, trace),
        trace,
      );
    },
    [runPlan, renderPlanWithContext],
  );

  // Wrapper for fast lane that integrates with completion
  const runFastLaneWrapped = useCallback(
    async (userPrompt: string, hint: string) => {
      await runFastLane(userPrompt, hint, commentOnResult, updateQueryContextFromLastPlan);
    },
    [runFastLane, commentOnResult, updateQueryContextFromLastPlan],
  );

  // Wrapper for handleApproveStep that integrates completion rendering
  const handleApproveStepWrapped = useCallback(
    async (planStateVal: PlanExecutionState, userPrompt: string) => {
      await handleApproveStepFromExecution(planStateVal, userPrompt, (final) => renderPlanWithContext(userPrompt, final));
    },
    [handleApproveStepFromExecution, renderPlanWithContext],
  );

  // Wrapper for handleApprove that integrates completion rendering
  const handleApproveWrapped = useCallback(
    async (
      planStateVal: PlanExecutionState | null,
      pendingApprovalVal: { toolId: string; payload: Record<string, unknown>; prompt: string } | null,
    ) => {
      await handleApprove(planStateVal, pendingApprovalVal, handleApproveStepWrapped, commentOnResult);
    },
    [handleApprove, handleApproveStepWrapped, commentOnResult],
  );

  const handleCancel = useCallback(() => {
    resetForNewMessage();
    toast("Azione annullata");
    addMessage({
      role: "assistant",
      content: "Operazione annullata. Nessuna azione eseguita.",
      timestamp: ts(),
      agentName: "Orchestratore",
    });
  }, [addMessage, resetForNewMessage, ts]);

  /** Main entry: process a user prompt */
  const sendMessage = useCallback(
    async (rawText: string) => {
      if (!rawText.trim()) return;
      // Show original (un-normalized) text in chat for UX honesty
      addMessage({ role: "user", content: rawText, timestamp: ts() });
      resetForNewMessage();

      // Lexical normalization (typo fix)
      const text = normalizePrompt(rawText);

      // Build conversational hint from previous query context (if fresh)
      const hint = buildContextHint(isContextFresh(queryContext) ? queryContext : null);

      // FAST LANE: simple read query OR elliptical follow-up with fresh context
      const fastLane =
        looksLikeSimpleQuery(text) ||
        (isElliptical(text) && isContextUsable());

      if (fastLane) {
        await runFastLaneWrapped(text, hint);
        return;
      }

      setFlowPhase("thinking");
      setShowTools(true);
      setToolPhase("activating");
      setChainHighlight(0);
      addMessage({ role: "assistant", content: "", timestamp: "", thinking: true });

      const chainInterval = setInterval(() => {
        setChainHighlight((prev: number | undefined) => {
          if (prev === undefined || prev >= 2) return prev;
          return prev + 1;
        });
      }, 600);

      try {
        const planRes = await planExecution(text, TOOL_METADATA, buildHistory());
        clearInterval(chainInterval);
        setMessages((prev) => prev.filter((m) => !m.thinking));
        setToolPhase("active");
        setChainHighlight(3);

        if (planRes._tag === "Err") {
          addMessage({
            role: "assistant",
            content: `Non riesco a connettermi al motore AI in questo momento. Riprova tra un istante.\n\n_Dettaglio: ${planRes.error.message}_`,
            agentName: "Orchestratore",
            timestamp: ts(),
          });
          setFlowPhase("idle");
          setShowTools(false);
          return;
        }

        const plan = planRes.value;

        if (plan.steps.length === 0) {
          addMessage({
            role: "assistant",
            content: plan.summary || "Non ho trovato un'azione adatta. Puoi essere più specifico? Ad esempio: \"cerca partner italiani con email\" oppure \"mostra dashboard\".",
            agentName: "Direttore",
            timestamp: ts(),
          });
          setFlowPhase("idle");
          setShowTools(false);
          return;
        }

        setActiveToolKey(plan.steps[0].toolId);
        const flowSteps: ExecutionStep[] = plan.steps.map((s) => ({
          label: TOOLS.find((t) => t.id === s.toolId)?.label ?? s.toolId,
          detail: s.reasoning,
          status: "pending" as const,
        }));
        setExecSteps(flowSteps);

        if (plan.steps.length > 1) {
          addMessage({
            role: "assistant",
            content: `**Piano in ${plan.steps.length} step:** ${plan.summary}\n\n${plan.steps
              .map((s) => `${s.stepNumber}. **${TOOLS.find((t) => t.id === s.toolId)?.label ?? s.toolId}** — ${s.reasoning}`)
              .join("\n")}`,
            agentName: "Orchestratore",
            timestamp: ts(),
            meta: `plan-execution · ${plan.steps.length} step`,
          });
        }

        const cappedSteps = plan.steps.slice(0, MAX_PLAN_STEPS);
        const newState: PlanExecutionState = {
          steps: cappedSteps,
          stepStates: buildInitialStepStates(cappedSteps),
          summary: plan.summary,
          results: {},
          currentStep: 0,
          status: "running",
        };
        setPlanState(newState);
        setFlowPhase("executing");
        setChainHighlight(5);

        // Audit trace per il path plan-execution
        const planTrace = startTrace(text);
        planTrace.setPhase("plan-execution");
        planTrace.setPlanSummary(plan.summary);
        planTrace.setDriver(cappedSteps[cappedSteps.length - 1]?.toolId ?? "unknown");

        await runPlanWrapped(newState, text, hint, planTrace);
      } catch (err: unknown) {
        clearInterval(chainInterval);
        setMessages((prev) => prev.filter((m) => !m.thinking));
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        addMessage({
          role: "assistant",
          content: `Errore durante la pianificazione: ${msg}`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        setFlowPhase("idle");
        setShowTools(false);
      }
    },
    [
      addMessage, buildHistory, resetForNewMessage, runFastLaneWrapped, runPlanWrapped,
      setActiveToolKey, setChainHighlight, setExecSteps, setFlowPhase, setMessages,
      setPlanState, setShowTools, setToolPhase, ts, isContextUsable, queryContext, looksLikeSimpleQuery,
    ],
  );

  return { sendMessage, handleApprove: handleApproveWrapped, handleCancel, handleApproveStep: handleApproveStepWrapped };
}
