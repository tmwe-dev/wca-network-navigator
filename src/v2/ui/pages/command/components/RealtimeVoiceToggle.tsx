/**
 * RealtimeVoiceToggle — small button that opens/closes the on-demand
 * ElevenLabs Conversational session for Command. Default voice (TTS+STT)
 * keeps working independently.
 */
import { Radio, Square, Loader2 } from "lucide-react";
import { useCommandRealtimeVoice } from "../hooks/useCommandRealtimeVoice";
import { toast as sonnerToast } from "sonner";
import { useEffect } from "react";

interface Props {
  compact?: boolean;
}

export function RealtimeVoiceToggle({ compact }: Props) {
  const rt = useCommandRealtimeVoice();

  useEffect(() => {
    if (rt.error) sonnerToast.error(`Voce realtime: ${rt.error}`);
  }, [rt.error]);

  const active = rt.status === "connected";
  const busy = rt.status === "connecting";

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => (active ? void rt.stop() : void rt.start())}
        disabled={busy}
        title={active ? "Termina conversazione vocale realtime" : "Avvia conversazione vocale realtime (ElevenLabs)"}
        aria-label="Voce realtime ElevenLabs"
        className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 flex-shrink-0 ${
          active ? "bg-primary/20 text-primary animate-pulse" : "text-muted-foreground hover:text-foreground"
        } ${busy ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : active ? (
          <Square className="w-4 h-4" />
        ) : (
          <Radio className="w-4 h-4" />
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => (active ? void rt.stop() : void rt.start())}
      disabled={busy}
      title={active ? "Termina conversazione vocale realtime" : "Avvia conversazione vocale realtime (ElevenLabs)"}
      aria-label="Voce realtime ElevenLabs"
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-300 text-[9px] font-semibold tracking-wider uppercase ${
        active
          ? "bg-primary/15 border-primary/30 text-primary"
          : "bg-accent/60 border-border text-muted-foreground hover:text-foreground hover:bg-accent"
      }`}
    >
      {busy ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : active ? (
        <Square className="w-3 h-3" />
      ) : (
        <Radio className="w-3 h-3" />
      )}
      <span>{active ? "Realtime ON" : "Realtime"}</span>
    </button>
  );
}

export default RealtimeVoiceToggle;
