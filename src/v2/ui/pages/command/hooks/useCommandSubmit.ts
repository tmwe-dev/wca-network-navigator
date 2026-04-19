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
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import { TOOLS, TOOL_METADATA } from "../tools/registry";
import type { ToolResult } from "../tools/types";
import { planExecution } from "@/v2/io/edge/aiAssistant";
import {
  executePlan,
  executeApprovedStep,
  buildInitialStepStates,
  MAX_PLAN_STEPS,
  type PlanExecutionState,
} from "../planRunner";
import { getAiComment, serializeResultForAI, type SuggestedAction } from "../aiBridge";
import { aiQueryTool, getLastSuccessfulQueryPlan, clearLastSuccessfulQueryPlan } from "../tools/aiQueryTool";
import { normalizePrompt } from "../lib/lexicalNormalizer";
import {
  buildContextFromPlan,
  contextHint as buildContextHint,
  isContextFresh,
  isElliptical,
  type QueryContext,
} from "../lib/queryContext";
import { tryLocalComment } from "../lib/localResultFormatter";
import { startTrace, formatTraceLine, type TraceBuilder } from "../lib/toolTrace";
import type { Message, CanvasType, FlowPhase } from "../constants";

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

/** Heuristic: does this prompt look like a simple read query that ai-query handles? */
function looksLikeSimpleQuery(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim();
  if (!lower) return false;
  // Action verbs → not simple read
  const actionPatterns = [
    /\bcrea\b/, /\baggiungi\b/, /\baggiorna\b/, /\bmodifica\b/, /\belimina\b/,
    /\bscrap/, /\benrich/, /\barricch/, /\bdedup/, /\bcalcola lead/, /\binvia\b/,
    /\bcomponi\b/, /\bnaviga\b/, /\bcompila form/, /\bprogramma\b/, /\bschedul/,
    /\bapprov/,
  ];
  if (actionPatterns.some((re) => re.test(lower))) return false;
  // Multi-step indicators → use planner
  if (/\b(poi|quindi|dopo|infine|e poi|successivamente)\b/.test(lower)) return false;

  // Aggressive read-verb + domain-noun detector
  const readVerb = /\b(quant|mostr|elenc|trov|lista|cerca|visualiz|dammi|fammi vedere|recenti|ultim)/i;
  const domainNoun = /\b(partner|contatt|attivit|email|messagg|agente|biglietti|campagn|prospect|outreach|job|kb)\b/i;
  if (readVerb.test(lower) && domainNoun.test(lower)) return true;

  return aiQueryTool.match(lower);
}

export function useCommandSubmit(state: CommandStateApi) {
  const {
    addMessage, setMessages, setCanvas, setFlowPhase, setShowTools, setToolPhase,
    setChainHighlight, setExecSteps, setExecProgress, setLiveResult,
    setPendingApproval, setPlanState, setActiveToolKey,
    setVoiceSpeaking, resetForNewMessage, ts, governance, ttsSpeak, messages,
    queryContext, setQueryContext,
  } = state;

  /** Build short conversation history for AI context */
  const buildHistory = useCallback((): { role: "user" | "assistant"; content: string }[] => {
    return messages
      .filter((m) => !m.thinking && m.content)
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.content }));
  }, [messages]);

  /** After tool execution, ask AI to comment on the result + suggest next actions */
  const commentOnResult = useCallback(
    async (userPrompt: string, toolId: string, result: ToolResult) => {
      const tool = TOOLS.find((t) => t.id === toolId);
      const toolLabel = tool?.label ?? toolId;
      const resultSummary = serializeResultForAI(result);

      const comment = await getAiComment({
        userPrompt,
        toolId,
        toolLabel,
        resultSummary,
        history: buildHistory(),
      });

      addMessage({
        role: "assistant",
        content: comment.message,
        agentName: "Direttore",
        timestamp: ts(),
        meta: result.meta?.sourceLabel ? `${result.meta.sourceLabel} · ${result.meta.count} record · LIVE` : undefined,
        governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
        suggestedActions: comment.suggestedActions,
      });

      const tts = comment.spokenSummary ?? comment.message.replace(/\*\*/g, "").slice(0, 200);
      if (tts.trim()) ttsSpeak(tts);
      setVoiceSpeaking(false);
    },
    [addMessage, buildHistory, governance, setVoiceSpeaking, ts, ttsSpeak],
  );

  /** Persist last query plan into context for follow-ups */
  const updateQueryContextFromLastPlan = useCallback(() => {
    const plan = getLastSuccessfulQueryPlan();
    if (plan && plan.table !== "INVALID") {
      setQueryContext(buildContextFromPlan(plan));
    }
    clearLastSuccessfulQueryPlan();
  }, [setQueryContext]);

  /** Render an executed plan: messages + canvas + AI comment */
  const renderPlanCompletion = useCallback(
    async (userPrompt: string, final: PlanExecutionState) => {
      // Step-by-step recap messages
      for (const step of final.steps) {
        const r = final.results[step.stepNumber];
        const tool = TOOLS.find((t) => t.id === step.toolId);
        const countLabel = r?.meta && "count" in r.meta ? ` · ${r.meta.count}` : "";
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

      // Update conversational query context (if last tool was ai-query)
      updateQueryContextFromLastPlan();

      if (lastResult && lastResult.kind !== "approval") {
        await commentOnResult(userPrompt, lastStep.toolId, lastResult);
      } else {
        addMessage({
          role: "assistant",
          content: `✅ Piano completato: ${final.summary}`,
          agentName: "Orchestratore",
          timestamp: ts(),
          meta: `${final.steps.length} step · plan-execution`,
        });
      }
      toast.success("Piano completato");
    },
    [addMessage, commentOnResult, setCanvas, setExecProgress, setFlowPhase, setLiveResult, setShowTools, ts, updateQueryContextFromLastPlan],
  );

  /** Run a plan to completion (or pause for per-step approval) */
  const runPlan = useCallback(
    async (planStateVal: PlanExecutionState, userPrompt: string, hint: string) => {
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
        addMessage({
          role: "assistant",
          content: `⏸ Step ${final.approvalStepNumber} richiede la tua approvazione. Conferma per procedere.`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        return;
      }

      if (final.status === "done") {
        await renderPlanCompletion(userPrompt, final);
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
    [addMessage, buildHistory, renderPlanCompletion, setExecProgress, setFlowPhase, setPlanState, ts],
  );

  /** User approved a paused write-step → continue the plan */
  const handleApproveStep = useCallback(
    async (planStateVal: PlanExecutionState, userPrompt: string) => {
      if (planStateVal.status !== "awaiting-approval") return;
      setFlowPhase("executing");
      addMessage({
        role: "assistant",
        content: `✓ Step ${planStateVal.approvalStepNumber} approvato. Continuo...`,
        agentName: "Automation",
        timestamp: ts(),
      });
      const final = await executeApprovedStep(planStateVal, (s) => {
        setPlanState(s);
        const done = Object.keys(s.results).length;
        const total = planStateVal.steps.length || 1;
        setExecProgress(Math.round((done / total) * 100));
      });
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
        await renderPlanCompletion(userPrompt, final);
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
    [addMessage, renderPlanCompletion, setExecProgress, setFlowPhase, setPlanState, ts],
  );

  /** User approves a single-tool pending approval (live-approval canvas) */
  const handleApprove = useCallback(
    async (
      planStateVal: PlanExecutionState | null,
      pendingApprovalVal: { toolId: string; payload: Record<string, unknown>; prompt: string } | null,
    ) => {
      if (planStateVal?.status === "awaiting-approval") {
        await handleApproveStep(planStateVal, pendingApprovalVal?.prompt ?? "");
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
            await commentOnResult(pendingApprovalVal.prompt, pendingApprovalVal.toolId, result);
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
    [addMessage, commentOnResult, handleApproveStep, setCanvas, setFlowPhase, setLiveResult, setPendingApproval, ts],
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

  /** FAST LANE: run aiQueryTool directly (skips plan-execution AI hop). */
  const runFastLane = useCallback(
    async (userPrompt: string, hint: string) => {
      setActiveToolKey("ai-query");
      setShowTools(true);
      setToolPhase("active");
      setChainHighlight(3);
      setFlowPhase("executing");
      setExecSteps([{ label: "Ricerca AI", detail: "Query DB diretta", status: "pending" as const }]);

      try {
        const result = await aiQueryTool.execute(userPrompt, {
          confirmed: false,
          originalPrompt: userPrompt,
          contextHint: hint,
          history: buildHistory(),
        });

        setLiveResult(result);
        setCanvas(canvasForResult(result));
        setFlowPhase("done");
        setExecProgress(100);
        setShowTools(false);

        // Update query context
        updateQueryContextFromLastPlan();

        // Show step recap
        const countLabel = result.meta && "count" in result.meta ? ` · ${result.meta.count}` : "";
        addMessage({
          role: "assistant",
          content: `🔧 Ricerca AI${countLabel}`,
          agentName: "Automation",
          timestamp: ts(),
        });

        if (result.kind !== "approval") {
          await commentOnResult(userPrompt, "ai-query", result);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        toast.error(msg);
        addMessage({
          role: "assistant",
          content: `❌ Errore ricerca AI: ${msg}`,
          agentName: "Orchestratore",
          timestamp: ts(),
        });
        setFlowPhase("idle");
        setShowTools(false);
      }
    },
    [
      addMessage, buildHistory, commentOnResult, setActiveToolKey, setCanvas, setChainHighlight,
      setExecProgress, setExecSteps, setFlowPhase, setLiveResult, setShowTools, setToolPhase, ts,
      updateQueryContextFromLastPlan,
    ],
  );

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
        (isElliptical(text) && isContextFresh(queryContext));

      if (fastLane) {
        await runFastLane(text, hint);
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
        await runPlan(newState, text, hint);
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
      addMessage, buildHistory, queryContext, resetForNewMessage, runFastLane, runPlan,
      setActiveToolKey, setChainHighlight, setExecSteps, setFlowPhase, setMessages,
      setPlanState, setShowTools, setToolPhase, ts,
    ],
  );

  return { sendMessage, handleApprove, handleCancel, handleApproveStep };
}
