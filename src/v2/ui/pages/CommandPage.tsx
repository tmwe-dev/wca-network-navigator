import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Globe2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import ApprovalPanel from "@/components/workspace/ApprovalPanel";
import ExecutionFlow from "@/components/workspace/ExecutionFlow";
import ToolActivationBar from "@/components/workspace/ToolActivationBar";
import VoicePresence from "@/components/workspace/VoicePresence";
import ConversationSidebar from "./command/ConversationSidebar";
import FloatingDock from "@/components/layout/FloatingDock";
import { resolveTool, TOOLS } from "./command/tools/registry";
import type { ToolResult } from "./command/tools/types";
import { useGovernance } from "./command/hooks/useGovernance";
import { useVoiceInput } from "./command/hooks/useVoiceInput";
import { useConversation } from "./command/hooks/useConversation";
import { useCommandPageState } from "./command/hooks/useCommandPageState";
import { CommandHistory } from "./command/components/CommandHistory";
import { CommandInput } from "./command/components/CommandInput";
import { CommandOutput } from "./command/components/CommandOutput";
import { SCENARIOS, QUICK_PROMPTS, detectScenario } from "./command/scenarios";

const ease = [0.2, 0.8, 0.2, 1] as const;

const tableData = [
  { name: "TechBridge Japan", sector: "Technology", revenue: "€412k", days: "98", churn: 91 },
  { name: "Meridian Asia Pacific", sector: "Consulting", revenue: "€234k", days: "112", churn: 89 },
  { name: "SteelForge Srl", sector: "Manufacturing", revenue: "€187k", days: "105", churn: 85 },
  { name: "NovaPharma Group", sector: "Healthcare", revenue: "€156k", days: "93", churn: 82 },
  { name: "Apex Financial", sector: "Finance", revenue: "€298k", days: "88", churn: 76 },
  { name: "Orion Logistics", sector: "Logistics", revenue: "€143k", days: "120", churn: 71 },
];

const agentDots = [
  { agent: "Orchestratore", status: "done" },
  { agent: "CRM Core", status: "done" },
  { agent: "Partner Scout", status: "done" },
  { agent: "Outreach Runner", status: "running" },
  { agent: "Follow-up Watcher", status: "monitoring" },
  { agent: "Automation", status: "done" },
  { agent: "Governance", status: "monitoring" },
];

const CommandPage = () => {
  const nav = useNavigate();
  const pageState = useCommandPageState();
  const voice = useVoiceInput({
    onTranscript: (text) => pageState.setInput(text),
    onAutoSubmit: (text) => {
      pageState.setInput("");
      sendMessage(text);
    },
    silenceMs: 2000,
    lang: "it-IT",
  });

  useEffect(() => {
    if (voice.error) {
      toast.error(voice.error);
    }
  }, [voice.error]);

  const conv = useConversation();
  const governance = useGovernance(pageState.activeScenarioKey ?? undefined);
  const isEmpty = pageState.messages.length === 0 && conv.messages.length === 0;

  useEffect(() => {
    pageState.chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pageState.messages]);

  const runLiveTool = useCallback(
    async (prompt: string) => {
      const tool = await resolveTool(prompt);
      if (!tool) {
        pageState.addMessage({
          role: "assistant",
          content: "Non ho capito cosa vuoi fare. Puoi riformulare la richiesta?",
          timestamp: pageState.ts(),
          agentName: "Orchestratore",
        });
        return false;
      }

      pageState.setFlowPhase("thinking");
      pageState.setShowTools(true);
      pageState.setToolPhase("activating");
      pageState.setChainHighlight(0);
      pageState.setActiveScenarioKey("churn");

      pageState.addMessage({
        role: "assistant",
        content: "",
        timestamp: "",
        thinking: true,
      });

      const chainInterval = setInterval(() => {
        pageState.setChainHighlight((prev) => {
          if (prev === undefined || prev >= 2) return prev;
          return prev + 1;
        });
      }, 700);

      await new Promise((r) => setTimeout(r, 1500));
      clearInterval(chainInterval);

      pageState.setMessages((prev) => prev.filter((m) => !m.thinking));
      pageState.setToolPhase("active");
      pageState.setChainHighlight(3);

      const isCardGrid = tool.id === "followup-batch";
      const isTimeline = tool.id === "agent-report";
      const isFlow = tool.id === "campaign-status";
      const isComposer = tool.id === "compose-email";
      const agentLabel = isComposer
        ? "Email Composer"
        : isFlow
          ? "Campaign Manager"
          : isTimeline
            ? "Agent Monitor"
            : isCardGrid
              ? "Follow-up Watcher"
              : "Partner Scout";
      const queryLabel = isComposer
        ? "Preparazione Composer"
        : isFlow
          ? "Query Supabase · Campaign Jobs"
          : isTimeline
            ? "Query Supabase · Agents + Activities"
            : isCardGrid
              ? "Query Supabase · Search Contacts"
              : "Query Supabase · Search Partners";

      pageState.addMessage({
        role: "assistant",
        content: isComposer
          ? `Sto preparando il composer email...\n\nAnalisi del prompt per estrarre destinatario e oggetto.`
          : isFlow
            ? `Sto analizzando lo stato delle campagne usando **Campaign Jobs**...\n\nAggregazione batch in corso.`
            : isTimeline
              ? `Sto aggregando le attività degli agenti negli ultimi 7 giorni usando **Agents + Activities**...\n\nReport in preparazione.`
              : isCardGrid
                ? `Sto cercando contatti inattivi nel database usando **Search Contacts**...\n\nFiltro: nessuna interazione negli ultimi 30 giorni.`
                : `Sto cercando partner nel database WCA usando **Search Partners**...\n\nQuery in corso tramite il modulo partner management.`,
        agentName: agentLabel,
        timestamp: pageState.ts(),
        meta: isComposer
          ? "composer · generate-email + send-email · 2 edge fn"
          : isFlow
            ? "campaign-mgr · campaign_jobs · 1 modulo"
            : isTimeline
              ? "agent-monitor · agents+activities · 2 moduli"
              : isCardGrid
                ? "contact-db · search-contacts · 1 modulo"
                : "partner-mgmt · search-partners · 1 modulo",
        governance: `Ruolo: ${governance.role} · Permesso: ${governance.permission} · Policy: ${governance.policy}`,
      });

      pageState.setFlowPhase("executing");
      pageState.setChainHighlight(5);

      const liveSteps = [
        { label: "Interpretazione richiesta", status: "done" },
        { label: queryLabel, status: "running" },
        { label: "Rendering canvas", status: "pending" },
      ];
      pageState.setExecSteps(liveSteps);
      pageState.setExecProgress(33);

      try {
        const result = await tool.execute(prompt);

        if (result.kind === "approval") {
          pageState.setExecSteps([
            { label: "Interpretazione richiesta", status: "done" },
            { label: queryLabel, status: "done", detail: "Approvazione richiesta" },
            { label: "In attesa conferma utente", status: "running" },
          ]);
          pageState.setExecProgress(66);
          pageState.setLiveResult(result);
          pageState.setPendingApproval({
            toolId: result.toolId,
            payload: result.pendingPayload,
            prompt,
          });
          pageState.setFlowPhase("proposal");
          pageState.setCanvas("live-approval");
          pageState.setShowTools(false);

          pageState.addMessage({
            role: "assistant",
            content: `**${result.title}**\n${result.description}\n\nApprovazione richiesta prima dell'esecuzione.`,
            agentName: agentLabel,
            timestamp: pageState.ts(),
            meta: `governance · ${result.governance.permission}`,
            governance: `Ruolo: ${result.governance.role} · Permesso: ${result.governance.permission} · Policy: ${result.governance.policy}`,
          });
          return true;
        }

        if (result.kind === "result") {
          pageState.setExecSteps([
            { label: "Interpretazione richiesta", status: "done" },
            { label: queryLabel, status: "done" },
            { label: "Operazione completata", status: "done" },
          ]);
          pageState.setExecProgress(100);
          pageState.setFlowPhase("done");
          pageState.setShowTools(false);
          toast.success(result.message);
          pageState.addMessage({
            role: "assistant",
            content: `✅ **${result.title}**\n${result.message}`,
            agentName: agentLabel,
            timestamp: pageState.ts(),
            meta: result.meta?.sourceLabel,
          });
          return true;
        }

        if (result.kind === "report") {
          pageState.setExecSteps([
            { label: "Interpretazione richiesta", status: "done" },
            { label: queryLabel, status: "done", detail: `${result.sections.length} sezioni` },
            { label: "Rendering report", status: "done" },
          ]);
          pageState.setExecProgress(100);
          pageState.setLiveResult(result);
          pageState.setFlowPhase("done");
          pageState.setCanvas("live-report");
          pageState.setShowTools(false);
          pageState.addMessage({
            role: "assistant",
            content: `Report generato con **${result.sections.length} sezioni**.\n\nDati da: ${
              result.meta?.sourceLabel ?? "AI"
            }`,
            agentName: agentLabel,
            timestamp: pageState.ts(),
            meta: result.meta?.sourceLabel,
          });
          return true;
        }

        pageState.setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: queryLabel, status: "done", detail: `${result.meta?.count ?? 0} risultati` },
          { label: "Rendering canvas", status: "done" },
        ]);
        pageState.setExecProgress(100);
        pageState.setLiveResult(result);

        await new Promise((r) => setTimeout(r, 400));

        pageState.setFlowPhase("done");
        pageState.setChainHighlight(6);
        pageState.setCanvas(
          isComposer
            ? "live-composer"
            : isFlow
              ? "live-flow"
              : isTimeline
                ? "live-timeline"
                : isCardGrid
                  ? "live-card-grid"
                  : "live-table"
        );
        pageState.setShowTools(false);

        const countLabel = isComposer
          ? "Composer pronto"
          : isFlow
            ? `${result.meta?.count ?? 0} job in ${result.kind === "flow" ? result.nodes.length / 2 : 0} batch`
            : isTimeline
              ? `${result.meta?.count ?? 0} attività negli ultimi 7gg`
              : isCardGrid
                ? `${result.kind === "card-grid" ? result.cards.length : 0} contatti inattivi`
                : `${result.meta?.count ?? 0} risultati`;

        pageState.addMessage({
          role: "assistant",
          content: `Trovati **${countLabel}** nel database. Canvas aggiornato con i risultati live.\n\nDati da: ${
            result.meta?.sourceLabel ?? "Supabase"
          }`,
          agentName: agentLabel,
          timestamp: pageState.ts(),
          meta: `${result.meta?.sourceLabel ?? "Supabase"} · ${result.meta?.count ?? 0} record · LIVE`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        pageState.setExecSteps([
          { label: "Interpretazione richiesta", status: "done" },
          { label: queryLabel, status: "error", detail: "FAIL" },
          { label: "Rendering canvas", status: "pending" },
        ]);
        toast.error(msg);
        pageState.addMessage({
          role: "assistant",
          content: `Errore nella query: ${msg}`,
          agentName: agentLabel,
          timestamp: pageState.ts(),
        });
        pageState.setFlowPhase("idle");
        pageState.setShowTools(false);
      }

      return true;
    },
    [pageState, governance]
  );

  const runFlow = useCallback(
    (scenarioKey: string) => {
      const scenario = SCENARIOS[scenarioKey];
      if (!scenario) return;
      pageState.setActiveScenario(scenario);
      pageState.setActiveScenarioKey(scenarioKey);
      pageState.setFlowPhase("thinking");
      pageState.setShowTools(true);
      pageState.setToolPhase("activating");
      pageState.setChainHighlight(0);

      pageState.addMessage({
        role: "assistant",
        content: "",
        timestamp: "",
        thinking: true,
      });

      const chainInterval = setInterval(() => {
        pageState.setChainHighlight((prev) => {
          if (prev === undefined || prev >= 2) return prev;
          return prev + 1;
        });
      }, 700);

      setTimeout(() => {
        clearInterval(chainInterval);
        pageState.setToolPhase("active");
        pageState.setChainHighlight(3);
        pageState.setMessages((prev) => prev.filter((m) => !m.thinking));
        scenario.assistantMessages.forEach((am) => {
          pageState.addMessage({
            role: "assistant",
            content: am.content,
            timestamp: pageState.ts(),
            agentName: am.agentName,
            meta: am.meta,
            governance: am.governance,
          });
        });
        pageState.setCanvas(scenario.canvas);
        pageState.setFlowPhase(scenario.approval ? "proposal" : "done");

        if (scenario.autoVoice) {
          setTimeout(() => pageState.setVoiceSpeaking(true), 800);
        }
      }, 2200);
    },
    [pageState]
  );

  const handleApprove = useCallback(async () => {
    if (pageState.pendingApproval) {
      const tool = TOOLS.find((t) => t.id === pageState.pendingApproval!.toolId);
      if (!tool) return;
      pageState.setFlowPhase("executing");
      pageState.setCanvas(null);
      pageState.setPendingApproval(null);
      pageState.addMessage({
        role: "assistant",
        content: "Esecuzione in corso...",
        timestamp: pageState.ts(),
        agentName: "Automation",
      });
      try {
        const result = await tool.execute(pageState.pendingApproval.prompt, {
          confirmed: true,
          payload: pageState.pendingApproval.payload,
        });
        if (result.kind === "result") {
          toast.success(result.message);
          pageState.addMessage({
            role: "assistant",
            content: `✅ **${result.title}**\n${result.message}`,
            agentName: "Automation",
            timestamp: pageState.ts(),
            meta: result.meta?.sourceLabel,
          });
        }
        pageState.setFlowPhase("done");
        pageState.setLiveResult(null);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Errore";
        toast.error(msg);
        pageState.addMessage({
          role: "assistant",
          content: `❌ Errore: ${msg}`,
          agentName: "Automation",
          timestamp: pageState.ts(),
        });
        pageState.setFlowPhase("idle");
      }
      return;
    }
    if (!pageState.activeScenario) return;
    pageState.setFlowPhase("executing");
    pageState.setCanvas(null);
    pageState.setChainHighlight(5);

    pageState.addMessage({
      role: "assistant",
      content:
        "Esecuzione avviata. Automation Agent coordina gli step operativi. Governance Agent monitora ogni azione con audit trail completo.",
      timestamp: pageState.ts(),
      agentName: "Automation",
      meta: "Execution Engine · Governance · Audit Action · attivo",
    });

    if (pageState.activeScenario.executionSteps) {
      pageState.setExecSteps(pageState.activeScenario.executionSteps);
      pageState.setExecProgress(0);
      const steps = [...pageState.activeScenario.executionSteps];
      let progress = 0;
      const interval = setInterval(() => {
        progress += 12;
        if (progress > 100) progress = 100;
        pageState.setExecProgress(progress);
        const updated = steps.map((s, i) => {
          if (progress > ((i + 1) * 100) / steps.length)
            return { ...s, status: "done" as const, detail: s.detail || "✓" };
          if (progress > (i * 100) / steps.length)
            return { ...s, status: "running" as const };
          return s;
        });
        pageState.setExecSteps(updated);
        if (progress >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            pageState.setFlowPhase("done");
            pageState.setChainHighlight(6);
            pageState.setCanvas(pageState.activeScenario!.resultCanvas || null);
            pageState.setShowTools(false);
            pageState.setToolPhase("done");
            pageState.addMessage({
              role: "assistant",
              content:
                "Esecuzione completata. Tutti gli step verificati dal Governance Agent. Audit log aggiornato.\n\nVuoi salvare questo flusso come template operativo?",
              timestamp: pageState.ts(),
              agentName: "Orchestratore",
            });
          }, 600);
        }
      }, 700);
    }
  }, [pageState]);

  const handleCancel = useCallback(() => {
    pageState.resetFlow();
    toast("Azione annullata");
    pageState.addMessage({
      role: "assistant",
      content:
        "Operazione annullata. Nessuna azione eseguita. Audit Action: cancellazione registrata.",
      timestamp: pageState.ts(),
      agentName: "Orchestratore",
    });
  }, [pageState]);

  const sendMessage = async (text?: string) => {
    const content = text || pageState.input.trim();
    if (!content) return;
    pageState.addMessage({ role: "user", content, timestamp: pageState.ts() });
    pageState.resetForNewMessage();

    conv.addMessage({ role: "user", content });

    const history = conv.getHistory(10);
    const scenarioKey = await detectScenario(content);
    if (scenarioKey === null) {
      const tool = await resolveTool(content, history);
      if (!tool) {
        const noUnderstand =
          "Non ho capito cosa vuoi fare. Puoi riformulare la richiesta?";
        pageState.addMessage({
          role: "assistant",
          content: noUnderstand,
          timestamp: pageState.ts(),
          agentName: "Orchestratore",
        });
        conv.addMessage({ role: "assistant", content: noUnderstand });
        return;
      }
      await runLiveTool(content);
    } else {
      runFlow(scenarioKey);
    }
  };

  useEffect(() => {
    if (!conv.conversationId || conv.messages.length === 0) return;
    const last = [...conv.messages]
      .reverse()
      .find((m) => m.role === "tool" && m.tool_result);
    if (last?.tool_result) {
      pageState.setLiveResult(last.tool_result as ToolResult);
      const kind = (last.tool_result as ToolResult).kind;
      if (kind === "table") pageState.setCanvas("live-table");
      else if (kind === "card-grid") pageState.setCanvas("live-card-grid");
      else if (kind === "timeline") pageState.setCanvas("live-timeline");
      else if (kind === "flow") pageState.setCanvas("live-flow");
      else if (kind === "composer") pageState.setCanvas("live-composer");
      else if (kind === "report") pageState.setCanvas("live-report");
    }
  }, [conv.conversationId]);

  return (
    <div className="dark min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col">
      <motion.button
        onClick={() => nav("/v2")}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed top-6 left-6 z-50 flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] text-muted-foreground/80 hover:text-foreground hover:bg-white/5 transition-all backdrop-blur-md border border-white/[0.06]"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Dashboard</span>
      </motion.button>

      <div className="fixed inset-0 pointer-events-none z-0">
        <motion.div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsl(210 100% 66% / 0.012), transparent 70%)",
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="flex items-center justify-between px-6 py-3 relative z-10 flex-shrink-0">
        <div className="flex items-center gap-3 ml-28">
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-primary/95"
            animate={{ opacity: [0.5, 0.85, 0.5] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
          <span className="text-[11px] text-muted-foreground/98 font-light tracking-wide">
            Sessione attiva
          </span>
          {pageState.flowPhase !== "idle" && pageState.flowPhase !== "done" && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[9px] text-primary/92 font-mono ml-2"
            >
              {pageState.flowPhase === "thinking"
                ? "ELABORAZIONE"
                : pageState.flowPhase === "proposal"
                  ? "PROPOSTA"
                  : pageState.flowPhase === "approval"
                    ? "IN ATTESA"
                    : "ESECUZIONE"}
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 mr-2">
            {agentDots.map((a) => (
              <motion.div
                key={a.agent}
                className={`w-1.5 h-1.5 rounded-full ${
                  a.status === "done"
                    ? "bg-success/90"
                    : a.status === "running"
                      ? "bg-primary/95"
                      : "bg-muted-foreground/20"
                }`}
                animate={
                  a.status === "running"
                    ? { opacity: [0.55, 0.9, 0.55] }
                    : {}
                }
                transition={{ duration: 1.5, repeat: Infinity }}
                title={a.agent}
              />
            ))}
          </div>
          <span className="text-[8px] text-muted-foreground/100 font-mono tracking-wider">
            14 fonti · 12.8k contatti · 234 partner · 7 agenti
          </span>
          <motion.button
            onClick={() =>
              pageState.setLang(pageState.lang === "it" ? "en" : "it")
            }
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="ml-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(270_60%_60%)]/10 border border-[hsl(270_60%_60%)]/20 text-[hsl(270_60%_70%)] hover:bg-[hsl(270_60%_60%)]/15 transition-all duration-300"
            title="Cambia lingua"
          >
            <Globe2 className="w-3 h-3" />
            <span className="text-[9px] font-semibold tracking-wider uppercase">
              {pageState.lang === "it" ? "IT" : "EN"}
            </span>
          </motion.button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative z-10">
        <ConversationSidebar
          conversations={conv.conversations}
          activeId={conv.conversationId}
          onSelect={(id) => {
            conv.loadConversation(id);
            pageState.setMessages([]);
            pageState.setCanvas(null);
          }}
          onNew={() => {
            conv.newConversation();
            pageState.setMessages([]);
            pageState.setCanvas(null);
            pageState.setFlowPhase("idle");
          }}
          onArchive={(id) => conv.archive(id)}
        />
        <div
          className={`flex-1 flex flex-col transition-all duration-700 ease-out ${
            pageState.canvas ? "max-w-[50%]" : ""
          }`}
        >
          <CommandHistory
            messages={pageState.messages}
            isEmpty={isEmpty}
            quickPrompts={QUICK_PROMPTS}
            onQuickPrompt={sendMessage}
            chatEndRef={pageState.chatEndRef}
          />
          {!isEmpty && (
            <>
              <ToolActivationBar
                scenarioKey={pageState.activeScenarioKey}
                visible={pageState.showTools && pageState.flowPhase !== "idle"}
                phase={pageState.toolPhase}
                chainHighlight={pageState.chainHighlight}
              />

              {pageState.activeScenario?.approval &&
                (pageState.flowPhase === "proposal" ||
                  pageState.flowPhase === "approval") && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <ApprovalPanel
                      visible
                      title={pageState.activeScenario.approval.title}
                      description={
                        pageState.activeScenario.approval.description
                      }
                      details={pageState.activeScenario.approval.details}
                      governance={
                        pageState.activeScenario.approval.governance
                      }
                      onApprove={handleApprove}
                      onModify={() => {}}
                      onCancel={handleCancel}
                    />
                  </motion.div>
                )}

              <ExecutionFlow
                visible={pageState.flowPhase === "executing"}
                steps={pageState.execSteps}
                progress={pageState.execProgress}
              />
            </>
          )}

          <VoicePresence
            active={pageState.voiceSpeaking || voice.listening}
            listening={voice.listening && !voice.speaking}
            speaking={voice.speaking || pageState.voiceSpeaking}
          />

          <CommandInput
            input={pageState.input}
            onInputChange={pageState.setInput}
            onSend={() => sendMessage()}
            onVoiceToggle={() => voice.toggle()}
            onVolumeMute={() => pageState.setVoiceSpeaking(!pageState.voiceSpeaking)}
            inputFocused={pageState.inputFocused}
            onFocus={() => pageState.setInputFocused(true)}
            onBlur={() => pageState.setInputFocused(false)}
            voiceSpeaking={pageState.voiceSpeaking}
            voiceListening={voice.listening}
            voiceSupported={voice.supported}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          />
        </div>

        <CommandOutput
          canvas={pageState.canvas}
          liveResult={pageState.liveResult}
          activeScenarioKey={pageState.activeScenarioKey}
          tableData={tableData}
          onClose={() => {
            pageState.setCanvas(null);
            pageState.setLiveResult(null);
          }}
        />
      </div>

      <FloatingDock />
    </div>
  );
};

export default CommandPage;
export { CommandPage };
