/**
 * useCommandSubmit — handles prompt submission, tool execution, plan execution.
 * Extracted from CommandPage.tsx.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { ExecutionStep } from "@/components/workspace/ExecutionFlow";
import { resolveTool, TOOLS, TOOL_METADATA } from "../tools/registry";
import type { ToolResult } from "../tools/types";
import { planExecution } from "@/v2/io/edge/aiAssistant";
import { executePlan, executeApprovedStep, buildInitialStepStates, MAX_PLAN_STEPS, type PlanExecutionState } from "../planRunner";
import { scenarios, detectScenario } from "../constants";
import { scenarios, detectScenario } from "../constants";
import type { Message, CanvasType, FlowPhase, Scenario } from "../constants";

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
  setActiveScenario: (v: Scenario | null) => void;
  setActiveScenarioKey: (v: string | null) => void;
  setVoiceSpeaking: (v: boolean) => void;
  resetForNewMessage: () => void;
  ts: () => string;
  governance: { role: string; permission: string; policy: string };
  ttsSpeak: (text: string) => void;
}

export function useCommandSubmit(state: CommandStateApi) {
  const {
    addMessage, setMessages, setCanvas, setFlowPhase, setShowTools, setToolPhase,
    setChainHighlight, setExecSteps, setExecProgress, setLiveResult,
    setPendingApproval, setPlanState, setActiveScenario, setActiveScenarioKey,
    setVoiceSpeaking, resetForNewMessage, ts, governance, ttsSpeak,
  } = state;

  const addAssistantMessage = useCallback((msg: Omit<Message, "id" | "role">, spokenSummary?: string) => {
    addMessage({ ...msg, role: "assistant" });
    if (!msg.thinking) {
      const textToSpeak = spokenSummary || msg.content.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/[#*_`→✅❌🔧●○]/g, "").slice(0, 200);
      if (textToSpeak.trim()) ttsSpeak(textToSpeak);
    }
  }, [addMessage, ttsSpeak]);

  const runPlan = useCallback(async (planStateVal: PlanExecutionState) => {
    const final = await executePlan(planStateVal, (s) => {
      setPlanState(s);
      setExecSteps(
        planStateVal.steps.map((step, i) => ({
          label: TOOLS.find((t) => t.id === step.toolId)?.label ?? step.toolId,
          detail: step.reasoning,
          status: (i + 1 < s.currentStep ? "done" : i + 1 === s.currentStep ? "running" : "pending") as ExecutionStep["status"],
        })),
      );
      setExecProgress(Math.round((Object.keys(s.results).length / planStateVal.steps.length) * 100));
    });

    if (final.status === "done") {
      const lastStep = final.steps[final.steps.length - 1];
      const lastResult = final.results[lastStep.stepNumber];
      if (lastResult) setLiveResult(lastResult);

      for (const step of final.steps) {
        const r = final.results[step.stepNumber];
        const countLabel = r?.meta && "count" in r.meta ? ` · ${r.meta.count}` : "";
        addMessage({ role: "assistant", content: `🔧 Step ${step.stepNumber}/${final.steps.length} · ${step.toolId}${countLabel}`, agentName: "Automation", timestamp: ts() });
      }

      addAssistantMessage({ content: `✅ Piano completato: ${final.summary}`, agentName: "Orchestratore", timestamp: ts(), meta: `${final.steps.length} step · plan-execution` }, `Piano completato. ${final.summary}`);
      setFlowPhase("done");
      setExecProgress(100);
      toast.success("Piano completato");

      if (lastResult) {
        if (lastResult.kind === "table") setCanvas("live-table");
        else if (lastResult.kind === "card-grid") setCanvas("live-card-grid");
        else if (lastResult.kind === "report") setCanvas("live-report");
      }
    } else if (final.status === "error") {
      toast.error(final.error ?? "Errore esecuzione piano");
      addMessage({ role: "assistant", content: `❌ Piano fallito: ${final.error}`, agentName: "Orchestratore", timestamp: ts() });
      setFlowPhase("idle");
    }
  }, [addMessage, addAssistantMessage, setCanvas, setExecProgress, setExecSteps, setFlowPhase, setLiveResult, setPlanState, ts]);

  const runLiveTool = useCallback(async (prompt: string) => {
    const tool = await resolveTool(prompt);
    if (!tool) {
      addAssistantMessage({ content: "Non ho capito cosa vuoi fare. Puoi riformulare la richiesta?", timestamp: ts(), agentName: "Orchestratore" }, "Non ho capito. Puoi riformulare?");
      return false;
    }

    setFlowPhase("thinking");
    setShowTools(true);
    setToolPhase("activating");
    setChainHighlight(0);
    setActiveScenarioKey("churn");

    addMessage({ role: "assistant", content: "", timestamp: "", thinking: true });

    const chainInterval = setInterval(() => {
      setChainHighlight((prev: number | undefined) => {
        if (prev === undefined || prev >= 2) return prev;
        return prev + 1;
      });
    }, 700);

    await new Promise(r => setTimeout(r, 1500));
    clearInterval(chainInterval);

    setMessages(prev => prev.filter(m => !m.thinking));
    setToolPhase("active");
    setChainHighlight(3);

    const isCardGrid = tool.id === "followup-batch";
    const isTimeline = tool.id === "agent-report";
    const isFlow = tool.id === "campaign-status";
    const isComposer = tool.id === "compose-email";
    const agentLabel = isComposer ? "Email Composer" : isFlow ? "Campaign Manager" : isTimeline ? "Agent Monitor" : isCardGrid ? "Follow-up Watcher" : "Partner Scout";
    const queryLabel = isComposer ? "Preparazione Composer" : isFlow ? "Query Supabase · Campaign Jobs" : isTimeline ? "Query Supabase · Agents + Activities" : isCardGrid ? "Query Supabase · Search Contacts" : "Query Supabase · Search Partners";

    addMessage({
      role: "assistant",
      content: isComposer ? `Sto preparando il composer email...\n\nAnalisi del prompt per estrarre destinatario e oggetto.`
        : isFlow ? `Sto analizzando lo stato delle campagne usando **Campaign Jobs**...\n\nAggregazione batch in corso.`
        : isTimeline ? `Sto aggregando le attività degli agenti negli ultimi 7 giorni usando **Agents + Activities**...\n\nReport in preparazione.`
        : isCardGrid ? `Sto cercando contatti inattivi nel database usando **Search Contacts**...\n\nFiltro: nessuna interazione negli ultimi 30 giorni.`
        : `Sto cercando partner nel database WCA usando **Search Partners**...\n\nQuery in corso tramite il modulo partner management.`,
      agentName: agentLabel,
      timestamp: ts(),
      meta: isComposer ? "composer · generate-email + send-email · 2 edge fn" : isFlow ? "campaign-mgr · campaign_jobs · 1 modulo" : isTimeline ? "agent-monitor · agents+activities · 2 moduli" : isCardGrid ? "contact-db · search-contacts · 1 modulo" : "partner-mgmt · search-partners · 1 modulo",
      governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
    });

    setFlowPhase("executing");
    setChainHighlight(5);

    const liveSteps: ExecutionStep[] = [
      { label: "Interpretazione richiesta", status: "done" },
      { label: queryLabel, status: "running" },
      { label: "Rendering canvas", status: "pending" },
    ];
    setExecSteps(liveSteps);
    setExecProgress(33);

    try {
      const result = await tool.execute(prompt);

      if (result.kind === "approval") {
        setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: queryLabel, status: "done", detail: "Approvazione richiesta" },
          { label: "In attesa conferma utente", status: "running" },
        ]);
        setExecProgress(66);
        setLiveResult(result);
        setPendingApproval({ toolId: result.toolId, payload: result.pendingPayload, prompt });
        setFlowPhase("proposal");
        setCanvas("live-approval");
        setShowTools(false);

        addMessage({
          role: "assistant",
          content: `**${result.title}**\n${result.description}\n\nApprovazione richiesta prima dell'esecuzione.`,
          agentName: agentLabel,
          timestamp: ts(),
          meta: `governance · ${result.governance.permission}`,
          governance: `Ruolo: ${result.governance.role} · Permesso: ${result.governance.permission} · Policy: ${result.governance.policy}`,
        });
        return true;
      }

      if (result.kind === "result") {
        setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: queryLabel, status: "done" },
          { label: "Operazione completata", status: "done" },
        ]);
        setExecProgress(100);
        setFlowPhase("done");
        setShowTools(false);
        toast.success(result.message);
        addAssistantMessage({ content: `✅ **${result.title}**\n${result.message}`, agentName: agentLabel, timestamp: ts(), meta: result.meta?.sourceLabel }, `${result.title}. ${result.message}`);
        return true;
      }

      if (result.kind === "report") {
        setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: queryLabel, status: "done", detail: `${result.sections.length} sezioni` },
          { label: "Rendering report", status: "done" },
        ]);
        setExecProgress(100);
        setLiveResult(result);
        setFlowPhase("done");
        setCanvas("live-report");
        setShowTools(false);
        addAssistantMessage({ content: `Report generato con **${result.sections.length} sezioni**.\n\nDati da: ${result.meta?.sourceLabel ?? "AI"}`, agentName: agentLabel, timestamp: ts(), meta: result.meta?.sourceLabel }, `Report generato con ${result.sections.length} sezioni.`);
        return true;
      }

      setExecSteps([
        { label: "Interpretazione richiesta", status: "done" },
        { label: queryLabel, status: "done", detail: `${result.meta?.count ?? 0} risultati` },
        { label: "Rendering canvas", status: "done" },
      ]);
      setExecProgress(100);
      setLiveResult(result);

      await new Promise(r => setTimeout(r, 400));

      setFlowPhase("done");
      setChainHighlight(6);
      setCanvas(isComposer ? "live-composer" : isFlow ? "live-flow" : isTimeline ? "live-timeline" : isCardGrid ? "live-card-grid" : "live-table");
      setShowTools(false);

      const countLabel = isComposer ? "Composer pronto"
        : isFlow ? `${result.meta?.count ?? 0} job in ${result.kind === "flow" ? result.nodes.length / 2 : 0} batch`
        : isTimeline ? `${result.meta?.count ?? 0} attività negli ultimi 7gg`
        : isCardGrid ? `${result.kind === "card-grid" ? result.cards.length : 0} contatti inattivi`
        : `${result.meta?.count ?? 0} risultati`;

      addAssistantMessage({ content: `Trovati **${countLabel}** nel database. Canvas aggiornato con i risultati live.\n\nDati da: ${result.meta?.sourceLabel ?? "Supabase"}`, agentName: agentLabel, timestamp: ts(), meta: `${result.meta?.sourceLabel ?? "Supabase"} · ${result.meta?.count ?? 0} record · LIVE` }, `Trovati ${countLabel} nel database.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      setExecSteps([
        { label: "Interpretazione richiesta", status: "done" },
        { label: queryLabel, status: "error", detail: "FAIL" },
        { label: "Rendering canvas", status: "pending" },
      ]);
      toast.error(msg);
      addMessage({ role: "assistant", content: `Errore nella query: ${msg}`, agentName: agentLabel, timestamp: ts() });
      setFlowPhase("idle");
      setShowTools(false);
    }

    return true;
  }, [addMessage, addAssistantMessage, governance, setCanvas, setChainHighlight, setExecProgress, setExecSteps, setFlowPhase, setLiveResult, setMessages, setPendingApproval, setShowTools, setToolPhase, setActiveScenarioKey, ts]);

  const runFlow = useCallback((scenarioKey: string) => {
    const scenario = scenarios[scenarioKey];
    if (!scenario) return;
    setActiveScenario(scenario);
    setActiveScenarioKey(scenarioKey);
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
    }, 700);

    setTimeout(() => {
      clearInterval(chainInterval);
      setToolPhase("active");
      setChainHighlight(3);
      setMessages((prev) => prev.filter((m) => !m.thinking));
      scenario.assistantMessages.forEach((am) => {
        addMessage({ role: "assistant", content: am.content, timestamp: ts(), agentName: am.agentName, meta: am.meta, governance: am.governance });
      });
      setCanvas(scenario.canvas);
      setFlowPhase(scenario.approval ? "proposal" : "done");

      if (scenario.autoVoice) {
        setTimeout(() => setVoiceSpeaking(true), 800);
      }
    }, 2200);
  }, [addMessage, setActiveScenario, setActiveScenarioKey, setCanvas, setChainHighlight, setFlowPhase, setMessages, setShowTools, setToolPhase, setVoiceSpeaking, ts]);

  const handleApprove = useCallback(async (planStateVal: PlanExecutionState | null, pendingApprovalVal: { toolId: string; payload: Record<string, unknown>; prompt: string } | null, activeScenarioVal: Scenario | null) => {
    if (planStateVal?.status === "awaiting-approval") {
      setFlowPhase("executing");
      addMessage({ role: "assistant", content: "Piano approvato. Esecuzione in corso...", timestamp: ts(), agentName: "Automation" });
      const updated: PlanExecutionState = { ...planStateVal, status: "running" };
      setPlanState(updated);
      await runPlan(updated);
      return;
    }

    if (pendingApprovalVal) {
      const tool = TOOLS.find(t => t.id === pendingApprovalVal.toolId);
      if (!tool) return;
      setFlowPhase("executing");
      setCanvas(null);
      setPendingApproval(null);
      addMessage({ role: "assistant", content: "Esecuzione in corso...", timestamp: ts(), agentName: "Automation" });
      try {
        const result = await tool.execute(pendingApprovalVal.prompt, { confirmed: true, payload: pendingApprovalVal.payload });
        if (result.kind === "result") {
          toast.success(result.message);
          addMessage({ role: "assistant", content: `✅ **${result.title}**\n${result.message}`, agentName: "Automation", timestamp: ts(), meta: result.meta?.sourceLabel });
        }
        setFlowPhase("done");
        setLiveResult(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore";
        toast.error(msg);
        addMessage({ role: "assistant", content: `❌ Errore: ${msg}`, agentName: "Automation", timestamp: ts() });
        setFlowPhase("idle");
      }
      return;
    }
    if (!activeScenarioVal) return;
    setFlowPhase("executing");
    setCanvas(null);
    setChainHighlight(5);

    addMessage({ role: "assistant", content: "Esecuzione avviata. Automation Agent coordina gli step operativi. Governance Agent monitora ogni azione con audit trail completo.", timestamp: ts(), agentName: "Automation", meta: "Execution Engine · Governance · Audit Action · attivo" });

    if (activeScenarioVal.executionSteps) {
      setExecSteps(activeScenarioVal.executionSteps);
      setExecProgress(0);
      const steps = [...activeScenarioVal.executionSteps];
      let progress = 0;
      const interval = setInterval(() => {
        progress += 12;
        if (progress > 100) progress = 100;
        setExecProgress(progress);
        const updated = steps.map((s, i) => {
          if (progress > (i + 1) * (100 / steps.length)) return { ...s, status: "done" as const, detail: s.detail || "✓" };
          if (progress > i * (100 / steps.length)) return { ...s, status: "running" as const };
          return s;
        });
        setExecSteps(updated);
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setFlowPhase("done");
            setChainHighlight(6);
            setCanvas(activeScenarioVal.resultCanvas || null);
            setShowTools(false);
            setToolPhase("done");
            addMessage({ role: "assistant", content: "Esecuzione completata. Tutti gli step verificati dal Governance Agent. Audit log aggiornato.\n\nVuoi salvare questo flusso come template operativo?", timestamp: ts(), agentName: "Orchestratore" });
          }, 600);
        }
      }, 700);
    }
  }, [addMessage, runPlan, setCanvas, setChainHighlight, setExecProgress, setExecSteps, setFlowPhase, setLiveResult, setPendingApproval, setPlanState, setShowTools, setToolPhase, ts]);

  const handleCancel = useCallback(() => {
    resetForNewMessage();
    toast("Azione annullata");
    addMessage({ role: "assistant", content: "Operazione annullata. Nessuna azione eseguita. Audit Action: cancellazione registrata.", timestamp: ts(), agentName: "Orchestratore" });
  }, [addMessage, resetForNewMessage, ts]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    addMessage({ role: "user", content: text, timestamp: ts() });
    resetForNewMessage();

    const isMultiStep = /\b(e poi|dopo|quindi|poi|inoltre|infine)\b/i.test(text);

    if (!isMultiStep) {
      const scenarioKey = await detectScenario(text);
      if (scenarioKey === null) {
        await runLiveTool(text);
      } else {
        runFlow(scenarioKey);
      }
      return;
    }

    // Multi-step → plan execution
    setFlowPhase("thinking");
    addMessage({ role: "assistant", content: "", timestamp: "", thinking: true });

    try {
      const planRes = await planExecution(text, TOOL_METADATA);

      setMessages((prev) => prev.filter((m) => !m.thinking));

      if (planRes._tag === "Err" || planRes.value.steps.length === 0) {
        addMessage({ role: "assistant", content: planRes._tag === "Ok" ? planRes.value.summary : "Non sono riuscito a pianificare questa azione.", agentName: "Orchestratore", timestamp: ts() });
        setFlowPhase("idle");
        return;
      }

      const plan = planRes.value;
      const flowSteps: ExecutionStep[] = plan.steps.map((s) => ({
        label: TOOLS.find((t) => t.id === s.toolId)?.label ?? s.toolId,
        detail: s.reasoning,
        status: "pending" as const,
      }));
      setExecSteps(flowSteps);

      addMessage({
        role: "assistant",
        content: `**Piano con ${plan.steps.length} step:** ${plan.summary}\n\n${plan.steps.map((s) => `${s.stepNumber}. **${TOOLS.find((t) => t.id === s.toolId)?.label ?? s.toolId}** — ${s.reasoning}`).join("\n")}`,
        agentName: "Orchestratore",
        timestamp: ts(),
        meta: `plan-execution · ${plan.steps.length} step`,
      });

      const requiresApproval = plan.steps.some((s) => {
        const meta = TOOL_METADATA.find((t) => t.id === s.toolId);
        return meta?.requiresApproval;
      });

      const newState: PlanExecutionState = {
        steps: plan.steps,
        summary: plan.summary,
        results: {},
        currentStep: 0,
        status: requiresApproval ? "awaiting-approval" : "running",
      };
      setPlanState(newState);

      if (requiresApproval) {
        setFlowPhase("proposal");
      } else {
        setFlowPhase("executing");
        await runPlan(newState);
      }
    } catch {
      setMessages((prev) => prev.filter((m) => !m.thinking));
      addMessage({ role: "assistant", content: "Errore nella pianificazione. Riformula la richiesta.", agentName: "Orchestratore", timestamp: ts() });
      setFlowPhase("idle");
    }
  }, [addMessage, resetForNewMessage, runFlow, runLiveTool, runPlan, setExecSteps, setFlowPhase, setMessages, setPlanState, ts]);

  return { sendMessage, handleApprove, handleCancel, addAssistantMessage };
}
