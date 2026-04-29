/**
 * CommandPage — UNIFIED conversational orchestrator (single logic path).
 *
 * Flow: useCommandState (state) + useCommandSubmit (sendMessage).
 * - planExecution → planRunner → per-step approval (multi-step)
 * - Fast-lane direct ai-query for simple reads
 * - useResultCommentary speaks `spokenSummary` (conversational TTS), not raw results
 * - Composer uses Prompt Lab via generate-email pipeline (composeEmail tool)
 *
 * Legacy paths (resolveTool / useToolExecution / useScenarioFlow / useApprovalFlow /
 * useCommandPageState) are intentionally NOT used here. Doctrine: one logic per task,
 * everywhere.
 */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast as sonnerToast } from "sonner";
import VoicePresence from "@/components/workspace/VoicePresence";
import FloatingDock from "@/components/layout/FloatingDock";
import ConversationSidebar from "./command/ConversationSidebar";
import type { ToolResult, BulkAction } from "./command/tools/types";
import type { Message } from "./command/constants";
import { useGovernance } from "./command/hooks/useGovernance";
import { useVoiceInput } from "./command/hooks/useVoiceInput";
import { useVoiceOutput } from "./command/hooks/useVoiceOutput";
import { useConversation } from "./command/hooks/useConversation";
import { useCommandState } from "./command/hooks/useCommandState";
import { useCommandSubmit } from "./command/hooks/useCommandSubmit";
import { CommandHistory } from "./command/components/CommandHistory";
import { CommandInput } from "./command/components/CommandInput";
import { CommandOutput } from "./command/components/CommandOutput";
import { CommandPageBackButton } from "./command/components/CommandPageBackButton";
import { CommandPageHeader } from "./command/components/CommandPageHeader";
import { CommandPageBackground } from "./command/components/CommandPageBackground";
import CommandThread from "./command/components/CommandThread";
import { useRecentCommandPrompts } from "@/v2/hooks/useRecentCommandPrompts";

const CommandPage = () => {
  const nav = useNavigate();
  const state = useCommandState();
  const conv = useConversation();
  const governance = useGovernance(state.activeToolKey ?? undefined);
  const voiceOut = useVoiceOutput();

  const submit = useCommandSubmit({
    addMessage: state.addMessage,
    setMessages: state.setMessages,
    setCanvas: state.setCanvas,
    setFlowPhase: state.setFlowPhase,
    setShowTools: state.setShowTools,
    setToolPhase: state.setToolPhase,
    setChainHighlight: state.setChainHighlight,
    setExecSteps: state.setExecSteps,
    setExecProgress: state.setExecProgress,
    setLiveResult: state.setLiveResult,
    setPendingApproval: state.setPendingApproval,
    setPlanState: state.setPlanState,
    setActiveToolKey: state.setActiveToolKey,
    setVoiceSpeaking: state.setVoiceSpeaking,
    resetForNewMessage: state.resetForNewMessage,
    ts: state.ts,
    governance,
    ttsSpeak: (text: string) => voiceOut.speak(text),
    messages: state.messages,
    queryContext: state.queryContext,
    setQueryContext: state.setQueryContext,
  });

  const voice = useVoiceInput({
    onTranscript: (text) => state.setInput(text),
    onAutoSubmit: (text) => {
      state.setInput("");
      void submit.sendMessage(text);
    },
    silenceMs: 2000,
    lang: "it-IT",
  });

  const isEmpty = state.messages.length === 0 && conv.messages.length === 0;
  const { data: recentPrompts = [] } = useRecentCommandPrompts();

  useEffect(() => {
    if (voice.error) sonnerToast.error(voice.error);
  }, [voice.error]);

  useEffect(() => {
    state.chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.messages, state.chatEndRef]);

  // TTS: read ONLY the conversational commentary produced by the "Direttore"
  // (i.e. the message that comments on the actual result). Skip technical
  // chatter from "Automation", "Orchestratore", "Oracolo", "Communication",
  // etc. — the user does not want the assistant to read step recaps like
  // "🔧 Ricerca AI · 383".
  useEffect(() => {
    const last = state.messages[state.messages.length - 1];
    if (!last || last.role !== "assistant" || last.thinking) return;
    if (last.agentName !== "Direttore") return;
    const spoken = (last.spokenSummary ?? "").trim();
    if (spoken) {
      voiceOut.speak(spoken);
      return;
    }
    if (!last.content || !last.content.trim()) return;
    const clean = last.content
      .replace(/[*_`#>]/g, "")
      .replace(/\n+/g, ". ")
      .trim()
      .slice(0, 200);
    voiceOut.speak(clean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.messages.length]);

  // Rehydrate visible chat from a selected stored conversation.
  useEffect(() => {
    if (!conv.conversationId || conv.messages.length === 0) return;
    const visible: Message[] = conv.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m, idx) => ({
        id: idx + 1,
        role: m.role as "user" | "assistant",
        content: m.content,
        timestamp: new Date(m.created_at).toLocaleTimeString("it-IT", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        agentName: m.role === "assistant" ? "Direttore" : undefined,
      }));
    state.setMessages(visible);

    const last = [...conv.messages]
      .reverse()
      .find((m) => m.role === "tool" && m.tool_result);
    if (last?.tool_result) {
      const result = last.tool_result as ToolResult;
      state.setLiveResult(result);
      const kind = result.kind;
      if (kind === "table") state.setCanvas("live-table");
      else if (kind === "card-grid") state.setCanvas("live-card-grid");
      else if (kind === "timeline") state.setCanvas("live-timeline");
      else if (kind === "flow") state.setCanvas("live-flow");
      else if (kind === "composer") state.setCanvas("live-composer");
      else if (kind === "report") state.setCanvas("live-report");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv.conversationId, conv.messages.length]);

  const handleSend = (text?: string) => {
    const content = (text ?? state.input).trim();
    if (!content) return;
    state.setInput("");
    void submit.sendMessage(content);
  };

  return (
    <div className="dark min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col">
      <CommandPageBackButton onBack={() => nav("/v2")} />
      <CommandPageBackground />
      <CommandPageHeader
        flowPhase={state.flowPhase}
        lang={state.lang}
        onLangChange={() => state.setLang(state.lang === "it" ? "en" : "it")}
        onOpenTraceConsole={() => window.dispatchEvent(new CustomEvent("trace-console-open"))}
      />

      <div className="flex-1 flex overflow-hidden relative z-10">
        <ConversationSidebar
          conversations={conv.conversations}
          activeId={conv.conversationId}
          onSelect={(id) => {
            state.setCanvas(null);
            state.setLiveResult(null);
            state.setFlowPhase("idle");
            void conv.loadConversation(id);
          }}
          onNew={() => {
            conv.newConversation();
            state.setMessages([]);
            state.setCanvas(null);
            state.setFlowPhase("idle");
          }}
          onArchive={(id) => conv.archive(id)}
        />
        <div
          className={`flex-1 flex flex-col transition-all duration-700 ease-out ${
            state.canvas ? "max-w-[50%]" : ""
          }`}
        >
          {isEmpty ? (
            <CommandHistory
              messages={[]}
              isEmpty
              quickPrompts={recentPrompts}
              onQuickPrompt={(p) => handleSend(p)}
              chatEndRef={state.chatEndRef}
            />
          ) : (
            <CommandThread
              messages={state.messages}
              activeToolKey={state.activeToolKey}
              showTools={state.showTools}
              flowPhase={state.flowPhase}
              toolPhase={state.toolPhase}
              chainHighlight={state.chainHighlight}
              planState={state.planState}
              execSteps={state.execSteps}
              execProgress={state.execProgress}
              governance={governance}
              chatEndRef={state.chatEndRef}
              onCancel={() => submit.handleCancel()}
              onApproveStep={() => {
                if (!state.planState) return;
                const lastUser = [...state.messages].reverse().find((m: Message) => m.role === "user");
                void submit.handleApproveStep(state.planState, lastUser?.content ?? "");
              }}
              onSuggestedAction={(prompt) => handleSend(prompt)}
            />
          )}

          <VoicePresence
            active={voiceOut.speaking || voice.listening}
            listening={voice.listening && !voice.speaking}
            speaking={voice.speaking || voiceOut.speaking}
          />

          <CommandInput
            input={state.input}
            onInputChange={state.setInput}
            onSend={() => handleSend()}
            onVoiceToggle={() => voice.toggle()}
            onVolumeMute={() => voiceOut.toggleMute()}
            inputFocused={state.inputFocused}
            onFocus={() => state.setInputFocused(true)}
            onBlur={() => state.setInputFocused(false)}
            voiceSpeaking={voiceOut.speaking}
            voiceListening={voice.listening}
            voiceSupported={voice.supported}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
        </div>

        <CommandOutput
          canvas={state.canvas}
          liveResult={state.liveResult}
          activeScenarioKey={state.activeToolKey}
          onClose={() => {
            state.setCanvas(null);
            state.setLiveResult(null);
          }}
          selectedIds={state.selectedIds}
          onToggleId={state.toggleSelected}
          onSelectAll={state.selectAll}
          onClearSelection={state.clearSelection}
          onBulkAction={(action: BulkAction, ids: string[]) => {
            if (ids.length === 0) {
              sonnerToast.info("Seleziona almeno un elemento");
              return;
            }
            const prompt = action.promptTemplate.replace("{ids}", ids.join(", "));
            state.clearSelection();
            handleSend(prompt);
          }}
        />
      </div>

      <FloatingDock />
    </div>
  );
};

export default CommandPage;
export { CommandPage };
