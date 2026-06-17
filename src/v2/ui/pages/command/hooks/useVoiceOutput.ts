import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";


import { createLogger } from "@/lib/log";
const log = createLogger("useVoiceOutput");

// 1-frame WAV silenzioso (44 byte) usato per "sbloccare" l'autoplay policy del
// browser durante un gesto utente. Senza questo, i successivi audio.play()
// chiamati DOPO un await fetch (es. dentro useEffect su messages) vengono
// bloccati silenziosamente con NotAllowedError → la voce smette di partire.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

const AUDIO_MIME_BY_CONTENT_TYPE: ReadonlyArray<[RegExp, string]> = [
  [/mpeg|mp3/i, "audio/mpeg"],
  [/wav/i, "audio/wav"],
  [/ogg/i, "audio/ogg"],
];

export function useVoiceOutput() {
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState<boolean>(
    () => localStorage.getItem("wca_voice_muted") === "1",
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const primedRef = useRef(false);

  const cleanup = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    setSpeaking(false);
  }, []);

  /**
   * Sblocca la riproduzione audio nel contesto di un gesto utente (click su
   * "Invia", click sul mic, ecc.). Va chiamato SINCRONICAMENTE dentro
   * l'handler dell'evento, prima di qualsiasi await. Idempotente.
   */
  const prime = useCallback(() => {
    if (primedRef.current) return;
    try {
      const a = new Audio(SILENT_WAV);
      a.muted = true;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(() => {
          a.pause();
          a.currentTime = 0;
          primedRef.current = true;
        }).catch(() => { /* gesture mancante: ritenteremo al prossimo click */ });
      } else {
        primedRef.current = true;
      }
    } catch {
      /* ignore */
    }
  }, []);

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
      try {
        cleanup();
        setSpeaking(true);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token ?? ""}`,
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({ text }),
          },
        );

        if (!response.ok) {
          log.error("[tts] edge error", { error: response.status });
          setSpeaking(false);
          return;
        }

        const responseBuffer = await response.arrayBuffer();
        const bytes = new Uint8Array(responseBuffer.slice(0, 12));
        const signature = String.fromCharCode(...bytes);
        const contentType = response.headers.get("content-type") ?? "";
        const detectedType = signature.startsWith("ID3") || bytes[0] === 0xff
          ? "audio/mpeg"
          : signature.startsWith("RIFF")
            ? "audio/wav"
            : signature.startsWith("OggS")
              ? "audio/ogg"
              : AUDIO_MIME_BY_CONTENT_TYPE.find(([pattern]) => pattern.test(contentType))?.[1];
        if (!detectedType) {
          const detail = new TextDecoder().decode(responseBuffer).slice(0, 240);
          log.warn("[tts] unexpected non-audio response", { contentType, detail });
          cleanup();
          return;
        }

        const blob = new Blob([responseBuffer], { type: detectedType });
        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const audio = new Audio(url);
        audio.preload = "auto";
        audioRef.current = audio;
        audio.onended = () => cleanup();
        audio.onerror = () => cleanup();
        try {
          await audio.play();
        } catch (playErr) {
          // Autoplay bloccato (NotAllowedError): tipico quando speak() viene
          // chiamato da useEffect senza prime() preventivo. Logghiamo esplicito
          // così si vede in console invece di fallire in silenzio.
          log.warn("[tts] audio.play blocked (autoplay policy)", {
            error: playErr instanceof Error ? playErr.message : String(playErr),
            primed: primedRef.current,
          });
          cleanup();
        }
      } catch (e) {
        log.error("[tts] failed", { error: e });
        cleanup();
      }
    },
    [muted, cleanup],
  );

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return { speak, stop, speaking, muted, toggleMute, prime };
}
