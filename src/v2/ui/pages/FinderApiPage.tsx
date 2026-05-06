/**
 * FinderApiPage — clone "snello" di Command, dedicato a interrogare
 * l'API TMWE/Findair via edge function `finder-api-chat`.
 *
 * Logica: tutta in `useFinderApi` (state + sendMessage + KB).
 * UI: riusa CommandHistory, CommandInput, CommandPageBackground/Header/BackButton.
 * Canvas: pannello laterale con risultati JSON e proposta KB.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { CommandHistory } from "./command/components/CommandHistory";
import { CommandInput } from "./command/components/CommandInput";
import { CommandPageBackButton } from "./command/components/CommandPageBackButton";
import { CommandPageHeader } from "./command/components/CommandPageHeader";
import { CommandPageBackground } from "./command/components/CommandPageBackground";
import FloatingDock from "@/components/layout/FloatingDock";
import { useFinderApi } from "./finder-api/useFinderApi";
import { FinderApiCanvas } from "./finder-api/FinderApiCanvas";

const FinderApiPage = () => {
  const f = useFinderApi();

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

  return (
    <div className="min-h-screen w-full bg-background text-foreground relative overflow-hidden flex flex-col">
      <CommandPageBackButton currentPath="/v2/finder-api" />
      <CommandPageBackground />
      <Link
        to="/v2/finder-api/schema"
        className="absolute top-3 right-3 z-20 text-[10px] uppercase tracking-wider text-muted-foreground/60 hover:text-foreground transition-colors"
        title="Schema map TMWE (pagina nascosta)"
      >
        schema
      </Link>
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

          <CommandInput
            input={f.input}
            onInputChange={f.setInput}
            onSend={() => handleSend()}
            onVoiceToggle={() => toast.info("Voice non attivo su Finder API")}
            onVolumeMute={() => {}}
            inputFocused={f.inputFocused}
            onFocus={() => f.setInputFocused(true)}
            onBlur={() => f.setInputFocused(false)}
            voiceSpeaking={false}
            voiceListening={false}
            voiceSupported={false}
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

      <FloatingDock />
    </div>
  );
};

export default FinderApiPage;
export { FinderApiPage };