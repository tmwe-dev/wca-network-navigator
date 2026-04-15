/**
 * CommandPage — AI Command Center.
 * Composition-only file. Logic in hooks/, UI in components/.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import VoicePresence from "@/components/workspace/VoicePresence";
import FloatingDock from "@/components/layout/FloatingDock";
import { useGovernance } from "./command/hooks/useGovernance";
import { useVoiceInput } from "./command/hooks/useVoiceInput";
import { useVoiceOutput } from "./command/hooks/useVoiceOutput";
import { useCommandState } from "./command/hooks/useCommandState";
import { useCommandSubmit } from "./command/hooks/useCommandSubmit";
import CommandHeader from "./command/components/CommandHeader";
import CommandSuggestions from "./command/components/CommandSuggestions";
import CommandThread from "./command/components/CommandThread";
import CommandComposer from "./command/components/CommandComposer";
import CommandCanvas from "./command/components/CommandCanvas";

const CommandPage = () => {
  const s = useCommandState();
  const tts = useVoiceOutput();
  const governance = useGovernance(s.activeScenarioKey ?? undefined);

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
    setActiveScenario: s.setActiveScenario,
    setActiveScenarioKey: s.setActiveScenarioKey,
    setVoiceSpeaking: s.setVoiceSpeaking,
    resetForNewMessage: s.resetForNewMessage,
    ts: s.ts,
    governance,
    ttsSpeak: tts.speak,
  });

  const handleSendFromInput = () => {
    const text = s.input.trim();
    if (!text) return;
    s.setInput("");
    submit.sendMessage(text);
  };

  return (
    <div className="dark min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col">
      <CommandHeader
        flowPhase={s.flowPhase}
        lang={s.lang}
        onToggleLang={() => s.setLang(s.lang === "it" ? "en" : "it")}
      />

      <div className="flex-1 flex overflow-hidden relative z-10">
        {/* ─── CONVERSATION ─── */}
        <div className={`flex-1 flex flex-col transition-all duration-700 ease-out ${s.canvas ? "max-w-[50%]" : ""}`}>
          {s.isEmpty ? (
            <CommandSuggestions onSend={submit.sendMessage} />
          ) : (
            <CommandThread
              messages={s.messages}
              activeScenarioKey={s.activeScenarioKey}
              showTools={s.showTools}
              flowPhase={s.flowPhase}
              toolPhase={s.toolPhase}
              chainHighlight={s.chainHighlight}
              activeScenario={s.activeScenario}
              planState={s.planState}
              execSteps={s.execSteps}
              execProgress={s.execProgress}
              governance={governance}
              chatEndRef={s.chatEndRef as React.RefObject<HTMLDivElement>}
              onApprove={() => submit.handleApprove(s.planState, s.pendingApproval, s.activeScenario)}
              onCancel={submit.handleCancel}
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
          />
        </div>

        {/* ─── CANVAS ─── */}
        <CommandCanvas
          canvas={s.canvas}
          liveResult={s.liveResult}
          activeScenarioKey={s.activeScenarioKey}
          onClose={() => { s.setCanvas(null); s.setLiveResult(null); }}
        />
      </div>

      <FloatingDock />
    </div>
  );
};

export default CommandPage;
export { CommandPage };
