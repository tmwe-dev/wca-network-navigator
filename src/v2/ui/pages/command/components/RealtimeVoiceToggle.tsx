/**
 * RealtimeVoiceToggle — small button that opens/closes the on-demand
 * ElevenLabs Conversational session for Command. Default voice (TTS+STT)
 * keeps working independently.
 */
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useCommandRealtimeVoice } from "../hooks/useCommandRealtimeVoice";
import { toast as sonnerToast } from "sonner";
import { useEffect } from "react";

export function RealtimeVoiceToggle() {
  const rt = useCommandRealtimeVoice();

  useEffect(() => {
    if (rt.error) sonnerToast.error(`Voce realtime: ${rt.error}`);
  }, [rt.error]);

  const active = rt.status === "connected";
  const busy = rt.status === "connecting";

  return (
    <button
      type="button"
      onClick={() => (active ? void rt.stop() : void rt.start())}
      disabled={busy}
      title={
        active
          ? "Termina conversazione vocale realtime"
          : "Avvia conversazione vocale realtime (ElevenLabs)"
      }
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
        <MicOff className="w-3 h-3" />
      ) : (
        <Mic className="w-3 h-3" />
      )}
      <span>{active ? "Realtime ON" : "Realtime"}</span>
    </button>
  );
}

export default RealtimeVoiceToggle;