/**
 * CommandPage — AI Command Center.
 * Composition-only file. Logic in hooks/, UI in components/.
 * The AI agent (LUCA) drives the full conversation: plan → execute tools → comment + propose next.
 */
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import VoicePresence from "@/components/workspace/VoicePresence";
import FloatingDock from "@/components/layout/FloatingDock";
import { useGovernance } from "./command/hooks/useGovernance";
import { useVoiceInput } from "./command/hooks/useVoiceInput";
import { useVoiceOutput } from "./command/hooks/useVoiceOutput";
import { useCommandState } from "./command/hooks/useCommandState";
import { useCommandSubmit } from "./command/hooks/useCommandSubmit";
import { useAgentLoop } from "./command/hooks/useAgentLoop";
import CommandHeader from "./command/components/CommandHeader";
import CommandSuggestions from "./command/components/CommandSuggestions";
import CommandThread from "./command/components/CommandThread";
import CommandComposer from "./command/components/CommandComposer";
import CommandCanvas from "./command/components/CommandCanvas";
import AgentTimeline from "./command/components/AgentTimeline";

const MISSION_KEYWORDS = /\b(poi|quindi|dopo|successivamente|e poi|infine)\b/gi;

function isMissionPrompt(text: string): boolean {
  if (text.length < 80) return false;
  const matches = text.match(MISSION_KEYWORDS);
  return (matches?.length ?? 0) >= 2;
}

const CommandPage = () => {
  const s = useCommandState();
  const tts = useVoiceOutput();
  const governance = useGovernance(s.activeToolKey ?? undefined);
  const agent = useAgentLoop();
  const [missionMode, setMissionMode] = useState(false);

  const submit = useCommandSubmit({
    addMessage: s.addMessage,
    setMessages: s.setMessages,
    setCanvas: s.setCanvas,
    setFlowPhase: s.setFlowPhase,
    setShowTools: s.setShowTools,
    setToolPhase: s.setToolPhase,
    setChainHighlight: s.setChainHighlight,
    setExecSteps: s.setExecSteps,
    setExecProgress: s.setExecProgress,
    setLiveResult: s.setLiveResult,
    setPendingApproval: s.setPendingApproval,
    setPlanState: s.setPlanState,
    setActiveToolKey: s.setActiveToolKey,
    setVoiceSpeaking: s.setVoiceSpeaking,
    resetForNewMessage: s.resetForNewMessage,
    ts: s.ts,
    governance,
    ttsSpeak: tts.speak,
    messages: s.messages,
  });

  const voice = useVoiceInput({
    onTranscript: (text) => s.setInput(text),
    onAutoSubmit: (text) => {
      s.setInput("");
      submit.sendMessage(text);
    },
    silenceMs: 2000,
    lang: "it-IT",
  });

  // Stop TTS when user starts speaking
  useEffect(() => {
    if (voice.listening) tts.stop();
  }, [voice.listening, tts]);

  useEffect(() => {
    if (voice.error) toast.error(voice.error);
  }, [voice.error]);

  // Auto-scroll
  useEffect(() => {
    s.chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [s.messages]);

  const handleSendFromInput = useCallback(() => {
    const text = s.input.trim();
    if (!text) return;
    s.setInput("");

    // Auto-detect mission mode (long, multi-clause prompts) → use the autonomous agent loop
    if (missionMode || isMissionPrompt(text)) {
      s.addMessage({ role: "user", content: text, timestamp: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }) });
      agent.start(text);
    } else {
      submit.sendMessage(text);
    }
  }, [s.input, missionMode, agent, submit, s]);

  return (
    <div className="dark min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col">
      <CommandHeader
        flowPhase={s.flowPhase}
        lang={s.lang}
        onToggleLang={() => s.setLang(s.lang === "it" ? "en" : "it")}
      />

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* ─── CONVERSATION ─── */}
        <div className={`flex-1 flex flex-col transition-all duration-700 ease-out ${s.canvas || agent.state.running ? "max-w-[50%]" : ""}`}>
          {s.isEmpty && !agent.state.running ? (
            <CommandSuggestions onSend={submit.sendMessage} />
          ) : (
            <CommandThread
              messages={s.messages}
              activeToolKey={s.activeToolKey}
              showTools={s.showTools}
              flowPhase={s.flowPhase}
              toolPhase={s.toolPhase}
              chainHighlight={s.chainHighlight}
              planState={s.planState}
              execSteps={s.execSteps}
              execProgress={s.execProgress}
              governance={governance}
              chatEndRef={s.chatEndRef as React.RefObject<HTMLDivElement>}
              onCancel={submit.handleCancel}
              onApproveStep={() => s.planState && submit.handleApproveStep(s.planState, "")}
              onSuggestedAction={(prompt) => submit.sendMessage(prompt)}
            />
          )}

          {/* Voice presence */}
          <VoicePresence
            active={s.voiceSpeaking || voice.listening || tts.speaking}
            listening={voice.listening && !voice.speaking}
            speaking={voice.speaking || s.voiceSpeaking || tts.speaking}
          />

          <CommandComposer
            input={s.input}
            onInputChange={s.setInput}
            onSend={handleSendFromInput}
            inputFocused={s.inputFocused}
            onFocus={() => s.setInputFocused(true)}
            onBlur={() => s.setInputFocused(false)}
            voiceListening={voice.listening}
            voiceSupported={voice.supported}
            onVoiceToggle={voice.toggle}
            ttsMuted={tts.muted}
            onTtsMuteToggle={tts.toggleMute}
            missionMode={missionMode}
            onToggleMissionMode={() => setMissionMode((v) => !v)}
          />
        </div>

        {/* ─── AGENT TIMELINE ─── */}
        {(agent.state.running || agent.state.transcript.length > 0) && (
          <AgentTimeline
            state={agent.state}
            onStop={agent.stop}
            onApprove={agent.approveStep}
            onReject={agent.rejectStep}
            autonomousMode={agent.autonomousMode}
            onToggleAutonomous={agent.setAutonomousMode}
          />
        )}

        {/* ─── CANVAS ─── */}
        <CommandCanvas
          canvas={s.canvas}
          liveResult={s.liveResult}
          onClose={() => { s.setCanvas(null); s.setLiveResult(null); s.clearSelection(); }}
          selectedIds={s.selectedIds}
          toggleSelected={s.toggleSelected}
          selectAll={s.selectAll}
          clearSelection={s.clearSelection}
          onBulkAction={(action, ids) => {
            const filled = action.promptTemplate.replace("{ids}", ids.join(","));
            s.clearSelection();
            submit.sendMessage(filled);
          }}
        />
      </div>

      <FloatingDock />
    </div>
  );
};

export default CommandPage;
export { CommandPage };
