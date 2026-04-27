import { useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import ApprovalPanel from "@/components/workspace/ApprovalPanel";
import ExecutionFlow from "@/components/workspace/ExecutionFlow";
import ToolActivationBar from "@/components/workspace/ToolActivationBar";
import VoicePresence from "@/components/workspace/VoicePresence";
import ConversationSidebar from "./command/ConversationSidebar";
import FloatingDock from "@/components/layout/FloatingDock";
import { resolveTool } from "./command/tools/registry";
import type { ToolResult } from "./command/tools/types";
import { useGovernance } from "./command/hooks/useGovernance";
import { useVoiceInput } from "./command/hooks/useVoiceInput";
import { useConversation } from "./command/hooks/useConversation";
import { useCommandPageState } from "./command/hooks/useCommandPageState";
import { useToolExecution } from "./command/hooks/useToolExecution";
import { useScenarioFlow } from "./command/hooks/useScenarioFlow";
import { useApprovalFlow } from "./command/hooks/useApprovalFlow";
import { useVoiceOutput } from "./command/hooks/useVoiceOutput";
import { CommandHistory } from "./command/components/CommandHistory";
import { CommandInput } from "./command/components/CommandInput";
import { CommandOutput } from "./command/components/CommandOutput";
import { CommandPageBackButton } from "./command/components/CommandPageBackButton";
import { CommandPageHeader } from "./command/components/CommandPageHeader";
import { CommandPageBackground } from "./command/components/CommandPageBackground";
import { SCENARIOS, QUICK_PROMPTS, detectScenario } from "./command/scenarios";

const tableData = [
  { name: "TechBridge Japan", sector: "Technology", revenue: "€412k", days: "98", churn: 91 },
  { name: "Meridian Asia Pacific", sector: "Consulting", revenue: "€234k", days: "112", churn: 89 },
  { name: "SteelForge Srl", sector: "Manufacturing", revenue: "€187k", days: "105", churn: 85 },
  { name: "NovaPharma Group", sector: "Healthcare", revenue: "€156k", days: "93", churn: 82 },
  { name: "Apex Financial", sector: "Finance", revenue: "€298k", days: "88", churn: 76 },
  { name: "Orion Logistics", sector: "Logistics", revenue: "€143k", days: "120", churn: 71 },
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

  // Voice output (ElevenLabs TTS) — speaks every assistant reply unless muted.
  const voiceOut = useVoiceOutput();

  const conv = useConversation();
  const governance = useGovernance(pageState.activeScenarioKey ?? undefined);
  const isEmpty = pageState.messages.length === 0 && conv.messages.length === 0;

  useEffect(() => {
    if (voice.error) {
      const { toast: sonnerToast } = require("sonner");
      sonnerToast.error(voice.error);
    }
  }, [voice.error]);

  useEffect(() => {
    pageState.chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [pageState.messages]);

  // Speak the latest assistant message via ElevenLabs (skips thinking placeholders).
  useEffect(() => {
    const last = pageState.messages[pageState.messages.length - 1];
    if (!last || last.role !== "assistant" || last.thinking) return;
    if (!last.content || !last.content.trim()) return;
    // Strip markdown for cleaner speech.
    const clean = last.content
      .replace(/[*_`#>]/g, "")
      .replace(/\n+/g, ". ")
      .trim();
    voiceOut.speak(clean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageState.messages.length]);

  const runLiveTool = useToolExecution(pageState, governance);
  const runFlow = useScenarioFlow(pageState);
  const { handleApprove, handleCancel } = useApprovalFlow(pageState);

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
      <CommandPageBackButton onBack={() => nav("/v2")} />
      <CommandPageBackground />
      <CommandPageHeader
        flowPhase={pageState.flowPhase}
        lang={pageState.lang}
        onLangChange={() => pageState.setLang(pageState.lang === "it" ? "en" : "it")}
      />

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
            onVolumeMute={() => voiceOut.toggleMute()}
            inputFocused={pageState.inputFocused}
            onFocus={() => pageState.setInputFocused(true)}
            onBlur={() => pageState.setInputFocused(false)}
            voiceSpeaking={voiceOut.speaking}
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
