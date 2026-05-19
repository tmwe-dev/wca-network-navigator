/**
 * FinderApiPage — clone "snello" di Command, dedicato a interrogare
 * l'API TMWE/Findair via edge function `finder-api-chat`.
 *
 * Logica: tutta in `useFinderApi` (state + sendMessage + KB).
 * UI: riusa CommandHistory, CommandInput, CommandPageBackground/Header/BackButton.
 * Canvas: pannello laterale con risultati JSON e proposta KB.
 */
import { useEffect } from "react";
import { toast as sonnerToast } from "sonner";
import { CommandHistory } from "./command/components/CommandHistory";
import { CommandInput } from "./command/components/CommandInput";
import { CommandPageBackButton } from "./command/components/CommandPageBackButton";
import { CommandPageHeader } from "./command/components/CommandPageHeader";
import { CommandPageBackground } from "./command/components/CommandPageBackground";
import { useFinderApi } from "./finder-api/useFinderApi";
import { FinderApiCanvas } from "./finder-api/FinderApiCanvas";
import VoicePresence from "@/components/workspace/VoicePresence";
import { useVoiceInput } from "./command/hooks/useVoiceInput";
import { useVoiceOutput } from "./command/hooks/useVoiceOutput";
import { Plug } from "lucide-react";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";

const FinderApiPage = () => {
  const f = useFinderApi();
  const voiceOut = useVoiceOutput();

  useEffect(() => {
    f.chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [f.messages, f.chatEndRef]);

  const isEmpty = f.messages.length === 0;

  const handleSend = (text?: string) => {
    const content = (text ?? f.input).trim();
    if (!content) return;
    f.setInput("");
    void f.sendMessage(content);
  };

  const voice = useVoiceInput({
    onTranscript: (t) => f.setInput(t),
    onAutoSubmit: (t) => {
      f.setInput("");
      void f.sendMessage(t);
    },
    lang: "it-IT",
  });

  useEffect(() => {
    if (voice.error) sonnerToast.error(voice.error);
  }, [voice.error]);

  // Quando arriva la risposta dell'agente, leggila ad alta voce.
  const lastAssistantContent = (() => {
    for (let i = f.messages.length - 1; i >= 0; i -= 1) {
      const m = f.messages[i] as { role?: string; content?: string };
      if (m?.role === "assistant" && m.content) return m.content;
    }
    return null;
  })();

  useEffect(() => {
    if (lastAssistantContent && !voiceOut.muted) {
      voiceOut.speak(lastAssistantContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAssistantContent]);

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col">
      <PageTitleHeader icon={Plug} title="Finder API" subtitle="Interroga TMWE/Findair" />
      <CommandPageBackButton currentPath="/v2/finder-api" />
      <CommandPageBackground />
      <CommandPageHeader
        flowPhase={f.busy ? "executing" : "idle"}
        lang="it"
        onLangChange={() => {}}
        onOpenTraceConsole={() => {}}
      />

      <div className="flex-1 flex overflow-hidden relative z-10">
        <div className={`flex-1 flex flex-col transition-all duration-700 ease-out ${f.canvasOpen ? "max-w-[50%]" : ""}`}>
          <CommandHistory
            messages={f.messages}
            isEmpty={isEmpty}
            quickPrompts={[
              "Mostrami il mio profilo TMWE",
              "Tracking AWB 020-12345678",
              "Le mie ultime spedizioni",
              "Cerca SPL Cargo nella rubrica",
            ]}
            onQuickPrompt={(p) => handleSend(p)}
            chatEndRef={f.chatEndRef}
          />

          <VoicePresence
            active={voiceOut.speaking || voice.listening}
            listening={voice.listening && !voice.speaking}
            speaking={voice.speaking || voiceOut.speaking}
          />

          <CommandInput
            input={f.input}
            onInputChange={f.setInput}
            onSend={() => handleSend()}
            onVoiceToggle={() => voice.toggle()}
            onVolumeMute={() => voiceOut.toggleMute()}
            inputFocused={f.inputFocused}
            onFocus={() => f.setInputFocused(true)}
            onBlur={() => f.setInputFocused(false)}
            voiceSpeaking={voiceOut.speaking}
            voiceListening={voice.listening}
            voiceSupported={voice.supported}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
        </div>

        {f.canvasOpen && (
          <FinderApiCanvas
            results={f.lastResults}
            kbProposal={f.lastKbProposal}
            onSaveKb={() => void f.saveKbProposal()}
            onDismissKb={() => f.dismissKbProposal()}
            onClose={() => f.closeCanvas()}
          />
        )}
      </div>
    </div>
  );
};

export default FinderApiPage;
export { FinderApiPage };