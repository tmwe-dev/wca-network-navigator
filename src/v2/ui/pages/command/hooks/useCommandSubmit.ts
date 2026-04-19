/**
 * useCommandSubmit — Conversational AI orchestrator for the Command Page.
 *
 * Flow for every user prompt:
 *   1. Push user message + thinking indicator
 *   2. Call planExecution (ai-assistant edge fn, mode=plan-execution, scope=command)
 *      → AI returns ordered tool steps with reasoning
 *   3. Execute the plan via planRunner (single-step or multi-step, with per-step
 *      approval for write-tools)
 *   4. After execution, call getAiComment (ai-assistant default mode, scope=command)
 *      → AI reads the result, comments conversationally + proposes 2-4 next actions
 *   5. Render the final reply with clickable suggested-action chips + TTS
 *
 * Key differences vs the old version:
 *   • No regex/keyword routing → AI always picks the tools
 *   • No mock scenarios / hardcoded result templates
 *   • Real conversation: AI reads tool output and reasons on it
 *   • Suggested next actions surfaced as clickable buttons
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

export function useCommandSubmit(state: CommandStateApi) {
  const {
    addMessage, setMessages, setCanvas, setFlowPhase, setShowTools, setToolPhase,
    setChainHighlight, setExecSteps, setExecProgress, setLiveResult,
    setPendingApproval, setPlanState, setActiveToolKey,
    setVoiceSpeaking, resetForNewMessage, ts, governance, ttsSpeak, messages,
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

      // Show last result on the canvas
      const lastStep = final.steps[final.steps.length - 1];
      const lastResult = final.results[lastStep.stepNumber];
      if (lastResult) {
        setLiveResult(lastResult);
        setCanvas(canvasForResult(lastResult));
      }

      setFlowPhase("done");
      setExecProgress(100);
      setShowTools(false);

      // Conversational comment from AI on the FINAL result of the plan
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
    [addMessage, commentOnResult, setCanvas, setExecProgress, setFlowPhase, setLiveResult, setShowTools, ts],
  );

  /** Run a plan to completion (or pause for per-step approval) */
  const runPlan = useCallback(
    async (planStateVal: PlanExecutionState, userPrompt: string) => {
      const final = await executePlan(planStateVal, (s) => {
        setPlanState(s);
        const done = Object.keys(s.results).length;
        const total = planStateVal.steps.length || 1;
        setExecProgress(Math.round((done / total) * 100));
      });

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
    [addMessage, renderPlanCompletion, setExecProgress, setFlowPhase, setPlanState, ts],
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
      // Plan branch
      if (planStateVal?.status === "awaiting-approval") {
        await handleApproveStep(planStateVal, pendingApprovalVal?.prompt ?? "");
        return;
      }

      // Single-tool branch
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

  /** Main entry: process a user prompt */
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;
      addMessage({ role: "user", content: text, timestamp: ts() });
      resetForNewMessage();

      setFlowPhase("thinking");
      setShowTools(true);
      setToolPhase("activating");
      setChainHighlight(0);
      addMessage({ role: "assistant", content: "", timestamp: "", thinking: true });

      // Animate the chain bar
      const chainInterval = setInterval(() => {
        setChainHighlight((prev: number | undefined) => {
          if (prev === undefined || prev >= 2) return prev;
          return prev + 1;
        });
      }, 600);

      try {
        // ── 1. AI plans the execution ──
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
          // AI couldn't map the request to any tool → still reply conversationally
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

        // ── 2. Show the plan to the user ──
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

        // ── 3. Execute the plan ──
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
        await runPlan(newState, text);
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
      addMessage, buildHistory, resetForNewMessage, runPlan, setActiveToolKey,
      setChainHighlight, setExecSteps, setFlowPhase, setMessages, setPlanState,
      setShowTools, setToolPhase, ts,
    ],
  );

  return { sendMessage, handleApprove, handleCancel, handleApproveStep };
}
