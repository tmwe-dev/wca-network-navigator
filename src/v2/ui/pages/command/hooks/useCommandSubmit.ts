/**
 * useCommandSubmit — Conversational AI orchestrator for the Command Page.
 *
 * Flow (single dispatch, master control unico):
 *   1. Push user message
 *   2. classifyIntent(rawText) → smalltalk | compose-email | plan
 *        - smalltalk     → risposta Direttore (< 1s, niente DB)
 *        - compose-email → runDirectComposer (fast-lane batch email osservabile)
 *        - plan          → planExecution → planRunner (default)
 *   3. Fallback anti-allucinazione: se plan.steps=[] e il prompt sembra
 *      ricerca (shouldForceAiQuery), forziamo 1 step su ai-query nello
 *      stesso planRunner.
 *   4. Conversational AI comment + suggested next actions
 *   5. Persist last query "shape" in queryContext for follow-up handling
 *
 * Refactored into sub-modules:
 *   - useCommandHistory: Build and manage conversation history
 *   - usePromptAnalysis: Analyze prompts for execution strategy
 *   - useResultCommentary: Generate AI commentary on results
 *   - useQueryContext: Manage conversational context persistence
 *   - usePlanExecution: Execute multi-step plans
 *   - usePlanCompletion: Render completed plans
 *   - useApprovalHandler: Handle user approvals
 *   - intentClassifier: single-point intent dispatch (smalltalk/compose/plan)
 *   - planFallback: shouldForceAiQuery guard for empty plans
 */
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import { TOOLS, TOOL_METADATA } from "../tools/registry";
import type { ToolResult } from "../tools/types";
import { planExecution, type PlanStep } from "@/v2/io/edge/aiAssistant";
import { type PlanExecutionState } from "../planRunner";
import { normalizePrompt } from "../lib/lexicalNormalizer";
import { classifyIntent } from "../lib/intentClassifier";
import { shouldForceAiQuery } from "../lib/planFallback";
import { buildPlanState, buildAiQueryFallbackPlan } from "../lib/buildPlanState";
import { buildPlanPreview, labelForToolId } from "../lib/planPreview";
import { withTimeout } from "../lib/withTimeout";
import {
  enterIdle,
  enterThinking,
  enterExecuting,
  startChainAnimation,
  type PhaseApi,
} from "../lib/phaseTransitions";
import {
  contextHint as buildContextHint,
  isContextFresh,
  type QueryContext,
} from "../lib/queryContext";
import type { Message, CanvasType, FlowPhase } from "../constants";
import { startTrace, type TraceBuilder } from "../lib/toolTrace";
import type { ConversationMessage } from "@/v2/io/supabase/queries/conversations";

import { useCommandHistory } from "./useCommandHistory";
import { usePromptAnalysis } from "./usePromptAnalysis";
import { useResultCommentary } from "./useResultCommentary";
import { useQueryContext } from "./useQueryContext";
import { usePlanExecution } from "./usePlanExecution";
import { usePlanCompletion } from "./usePlanCompletion";
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
  /**
   * Persistent multi-turn memory (DB-backed via useConversation).
   * When provided, every user/assistant/tool turn is appended to the DB so the
   * planner can re-read the FULL conversation, not just the last 6 RAM messages.
   */
  persistedMessages?: ConversationMessage[];
  persistMessage?: (msg: {
    role: "user" | "assistant" | "tool" | "system";
    content: string;
    tool_id?: string;
    tool_result?: unknown;
  }) => Promise<void> | void;
}

export function useCommandSubmit(state: CommandStateApi) {
  const {
    addMessage, setMessages, setCanvas, setFlowPhase, setShowTools, setToolPhase,
    setChainHighlight, setExecSteps, setExecProgress, setLiveResult,
    setPendingApproval, setPlanState, setActiveToolKey,
    setVoiceSpeaking, resetForNewMessage, ts, governance, ttsSpeak, messages,
    queryContext, setQueryContext, persistedMessages, persistMessage,
  } = state;

  // Initialize sub-hooks
  const { buildHistory } = useCommandHistory(messages, persistedMessages ?? []);
  const { looksLikeSimpleQuery } = usePromptAnalysis();

  // Wrap addMessage to also persist user/assistant turns to the DB so future
  // turns can re-read the full conversation. Tool results are persisted inside
  // the runners (which have access to the actual ToolResult payload).
  const addMessagePersisted = useCallback(
    (msg: Omit<Message, "id">) => {
      addMessage(msg);
      if (persistMessage && !msg.thinking && msg.content) {
        const role: "user" | "assistant" = msg.role === "user" ? "user" : "assistant";
        // Fire-and-forget: persistence shouldn't block UI.
        void persistMessage({ role, content: msg.content });
      }
    },
    [addMessage, persistMessage],
  );

  // Re-bind addMessage downstream so every sub-hook persists automatically.
  // (We don't mutate `state` — we just override the local reference.)
  const _addMessage = addMessagePersisted;
  const { commentOnResult } = useResultCommentary({
    addMessage: _addMessage, ts, governance, ttsSpeak, setVoiceSpeaking, buildHistory,
  });
  const { updateQueryContextFromLastPlan } = useQueryContext({
    setQueryContext, queryContext,
  });
  const { renderPlanCompletion, canvasForResult } = usePlanCompletion({
    addMessage: _addMessage, ts, setFlowPhase, setExecProgress, setLiveResult, setCanvas, setShowTools,
  });
  const { runPlan, handleApproveStep: handleApproveStepFromExecution } = usePlanExecution({
    addMessage: _addMessage, ts, setFlowPhase, setExecProgress, setPlanState, setLiveResult, setCanvas, setShowTools, buildHistory,
  });
  const { handleApprove } = useApprovalHandler({
    addMessage: _addMessage, ts, setFlowPhase, setLiveResult, setCanvas, setPendingApproval, canvasForResult,
  });

  // Bundle dei setter UI: un solo oggetto passato agli helper di transizione.
  const phaseApi: PhaseApi = useMemo(
    () => ({ setFlowPhase, setShowTools, setToolPhase, setChainHighlight }),
    [setFlowPhase, setShowTools, setToolPhase, setChainHighlight],
  );

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
    _addMessage({
      role: "assistant",
      content: "Operazione annullata. Nessuna azione eseguita.",
      timestamp: ts(),
      agentName: "Orchestratore",
    });
  }, [_addMessage, resetForNewMessage, ts]);

  const runDirectComposer = useCallback(
    async (userPrompt: string, hint: string): Promise<boolean> => {
      const tool = TOOLS.find((t) => t.id === "compose-email");
      if (!tool?.match(userPrompt)) return false;
      setActiveToolKey("compose-email");
      enterExecuting(phaseApi);
      setExecSteps([{ label: tool.label, detail: "Preparazione bozze email", status: "pending" as const }]);
      const trace = startTrace(userPrompt);
      trace.setPhase("fast-lane");
      trace.setDriver("compose-email");
      try {
        const startedAt = Date.now();
        const result = await tool.execute(userPrompt, {
          confirmed: true,
          originalPrompt: userPrompt,
          contextHint: hint,
          history: buildHistory(),
        });
        trace.add({
          source: "tool",
          label: tool.label,
          toolId: tool.id,
          stepNumber: 1,
          status: "ok",
          durationMs: Date.now() - startedAt,
        });
        const refs = result.meta?.auditRefs;
        if (refs) {
          for (const ref of refs) trace.addReference({ kind: ref.kind, label: ref.label, value: ref.value });
        }
        setLiveResult(result);
        setCanvas(canvasForResult(result));
        setFlowPhase("done");
        setExecProgress(100);
        setShowTools(false);
        const countLabel = result.meta && "count" in result.meta ? ` · ${result.meta.count}` : "";
        _addMessage({ role: "assistant", content: `🔧 ${tool.label}${countLabel}`, agentName: "Automation", timestamp: ts() });
        if (result.kind !== "approval") await commentOnResult(userPrompt, tool.id, result, trace);
        else trace.finish();
      } catch (err: unknown) {
        trace.finish();
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        toast.error(msg);
        _addMessage({ role: "assistant", content: `❌ Errore composer: ${msg}`, agentName: "Orchestratore", timestamp: ts() });
        enterIdle(phaseApi);
      }
      return true;
    },
    [_addMessage, buildHistory, canvasForResult, commentOnResult, phaseApi, setActiveToolKey, setCanvas, setExecProgress, setExecSteps, setLiveResult, setShowTools, setFlowPhase, ts],
  );

  /**
   * Esegue un piano sintetico a 1-step su un tool specifico.
   * Usato dal fallback anti-allucinazione (steps=[] → ai-query).
   */
  const runSyntheticPlan = useCallback(
    async (state: PlanExecutionState, userPrompt: string, hint: string, driver: string) => {
      const trace = startTrace(userPrompt);
      trace.setPhase("plan-execution");
      trace.setDriver(driver);
      setActiveToolKey(driver);
      setExecSteps([{ label: labelForToolId(driver), detail: "Esecuzione", status: "pending" as const }]);
      setPlanState(state);
      enterExecuting(phaseApi);
      await runPlanWrapped(state, userPrompt, hint, trace);
    },
    [phaseApi, runPlanWrapped, setActiveToolKey, setExecSteps, setPlanState],
  );

  /** Main entry: process a user prompt */
  const sendMessage = useCallback(
    async (rawText: string) => {
      if (!rawText.trim()) return;
      _addMessage({ role: "user", content: rawText, timestamp: ts() });
      resetForNewMessage();

      // DISPATCH UNICO sul testo grezzo (prima della normalizzazione lessicale).
      const intent = classifyIntent(rawText);

      if (intent.kind === "smalltalk") {
        _addMessage({
          role: "assistant",
          content: intent.match.reply,
          agentName: "Direttore",
          timestamp: ts(),
          meta: `smalltalk · ${intent.match.kind}`,
        });
        enterIdle(phaseApi);
        return;
      }

      const text = normalizePrompt(rawText);
      const hint = buildContextHint(isContextFresh(queryContext) ? queryContext : null);

      // Fast-lane compose-email (già classificata): salta il planner.
      if (intent.kind === "compose-email" && (await runDirectComposer(text, hint))) return;

      // Flusso planner: single entry, single exit.
      enterThinking(phaseApi);
      addMessage({ role: "assistant", content: "", timestamp: "", thinking: true });
      const stopChain = startChainAnimation(setChainHighlight);

      try {
        const planRes = await withTimeout(
          planExecution(text, TOOL_METADATA, buildHistory()),
          30_000,
          "planner",
        ).catch((e: unknown) => ({
          _tag: "Err" as const,
          error: { message: e instanceof Error ? e.message : String(e) } as { message: string },
        }));
        stopChain();
        setMessages((prev) => prev.filter((m) => !m.thinking));

        if (planRes._tag === "Err") {
          _addMessage({
            role: "assistant",
            content: `Non riesco a connettermi al motore AI in questo momento. Riprova tra un istante.\n\n_Dettaglio: ${planRes.error.message}_`,
            agentName: "Orchestratore",
            timestamp: ts(),
          });
          enterIdle(phaseApi);
          return;
        }

        const plan = planRes.value;

        // ANTI-ALLUCINAZIONE: steps=[] ma prompt sembra ricerca → 1-step ai-query.
        if (plan.steps.length === 0) {
          if (shouldForceAiQuery(text, looksLikeSimpleQuery)) {
            await runSyntheticPlan(buildAiQueryFallbackPlan(), text, hint, "ai-query");
            return;
          }
          _addMessage({
            role: "assistant",
            content: plan.summary || "Non ho trovato un'azione adatta. Puoi essere più specifico? Ad esempio: \"cerca partner italiani con email\" oppure \"mostra dashboard\".",
            agentName: "Direttore",
            timestamp: ts(),
          });
          enterIdle(phaseApi);
          return;
        }

        // Piano multi-step: setup UI + trace + esecuzione.
        setActiveToolKey(plan.steps[0].toolId);
        setExecSteps(
          plan.steps.map((s) => ({
            label: labelForToolId(s.toolId),
            detail: s.reasoning,
            status: "pending" as const,
          })) satisfies ExecutionStep[],
        );

        if (plan.steps.length > 1) {
          _addMessage({
            role: "assistant",
            content: buildPlanPreview(plan.summary, plan.steps),
            agentName: "Orchestratore",
            timestamp: ts(),
            meta: `plan-execution · ${plan.steps.length} step`,
          });
        }

        const newState = buildPlanState(plan.steps, plan.summary);
        setPlanState(newState);
        enterExecuting(phaseApi);

        const planTrace = startTrace(text);
        planTrace.setPhase("plan-execution");
        planTrace.setPlanSummary(plan.summary);
        planTrace.setDriver(newState.steps[newState.steps.length - 1]?.toolId ?? "unknown");

        await runPlanWrapped(newState, text, hint, planTrace);
      } catch (err: unknown) {
        stopChain();
        setMessages((prev) => prev.filter((m) => !m.thinking));
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        _addMessage({
          role: "assistant",
          content: `Errore durante la pianificazione: ${msg}`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        enterIdle(phaseApi);
      }
    },
    [
      _addMessage, addMessage, buildHistory, resetForNewMessage, runPlanWrapped, runSyntheticPlan,
      setActiveToolKey, setChainHighlight, setExecSteps, setMessages, setPlanState, ts,
      queryContext, looksLikeSimpleQuery, runDirectComposer, phaseApi,
    ],
  );

  return { sendMessage, handleApprove: handleApproveWrapped, handleCancel, handleApproveStep: handleApproveStepWrapped };
}
