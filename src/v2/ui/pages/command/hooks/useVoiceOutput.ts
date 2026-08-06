import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { createLogger } from "@/lib/log";
const log = createLogger("useVoiceOutput");

type AudioCtor = typeof AudioContext;

function getAudioContextCtor(): AudioCtor | null {
  if (typeof window === "undefined") return null;
  return window.AudioContext || (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext || null;
}

export function useVoiceOutput() {
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState<boolean>(() => localStorage.getItem("wca_voice_muted") === "1");
  // Web Audio API: riproduzione affidabile dell'MP3 ElevenLabs anche dentro
  // l'iframe di anteprima, dove l'elemento <audio> falliva con
  // "no supported source" e faceva ripiegare sulla voce nativa robotica.
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const playTokenRef = useRef(0);

  const getCtx = useCallback((): AudioContext | null => {
    if (ctxRef.current) return ctxRef.current;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;
    try {
      ctxRef.current = new Ctor();
    } catch {
      return null;
    }
    return ctxRef.current;
  }, []);

  /**
   * Fallback voce nativa del browser (Web Speech API). Usato quando la
   * generazione/riproduzione dell'audio ElevenLabs fallisce davvero (edge
   * non raggiungibile o decode impossibile). NON usato per blocchi autoplay,
   * altrimenti l'operatore sentirebbe la voce sintetica al posto di ElevenLabs.
   */
  const speakNative = useCallback((text: string) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth || typeof SpeechSynthesisUtterance === "undefined") return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "it-IT";
      u.rate = 1;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      synth.speak(u);
    } catch {
      /* ignore */
    }
  }, []);

  const cleanup = useCallback(() => {
    playTokenRef.current += 1;
    if (sourceRef.current) {
      try {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
      } catch {
        /* ignore */
      }
      try {
        sourceRef.current.disconnect();
      } catch {
        /* ignore */
      }
      sourceRef.current = null;
    }
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* ignore */
    }
    setSpeaking(false);
  }, []);

  /**
   * Sblocca l'AudioContext nel contesto di un gesto utente (click su "Invia",
   * click sul mic, qualsiasi pointerdown). Va chiamato SINCRONICAMENTE dentro
   * l'handler dell'evento. Idempotente.
   */
  const prime = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        /* ritenteremo al prossimo gesto */
      });
    }
  }, [getCtx]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      localStorage.setItem("wca_voice_muted", next ? "1" : "0");
      if (next) cleanup();
      return next;
    });
  }, [cleanup]);

  const speak = useCallback(
    async (text: string) => {
      if (muted || !text?.trim()) return;
      cleanup();
      const myToken = playTokenRef.current;
      try {
        setSpeaking(true);

        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          log.error("[tts] edge error", { error: response.status });
          // Fallback voce nativa: meglio una voce sintetica che il silenzio.
          speakNative(text);
          return;
        }

        const responseBuffer = await response.arrayBuffer();
        if (myToken !== playTokenRef.current) return; // superseded da una nuova speak

        const ctx = getCtx();
        if (!ctx) {
          speakNative(text);
          return;
        }
        if (ctx.state === "suspended") {
          await ctx.resume().catch(() => {
            /* ignore */
          });
        }

        const audioBuffer = await ctx.decodeAudioData(responseBuffer.slice(0));
        if (myToken !== playTokenRef.current) return; // superseded durante decode

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.onended = () => {
          if (sourceRef.current === source) {
            sourceRef.current = null;
            setSpeaking(false);
          }
        };
        sourceRef.current = source;
        setSpeaking(true);
        source.start(0);
      } catch (e) {
        log.error("[tts] failed", { error: e });
        cleanup();
        speakNative(text);
      }
    },
    [muted, cleanup, getCtx, speakNative],
  );

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return { speak, stop, speaking, muted, toggleMute, prime };
}
