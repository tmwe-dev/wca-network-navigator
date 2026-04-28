import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";


import { createLogger } from "@/lib/log";
const log = createLogger("useVoiceOutput");
export function useVoiceOutput() {
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState<boolean>(
    () => localStorage.getItem("wca_voice_muted") === "1",
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

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

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => cleanup();
        audio.onerror = () => cleanup();
        await audio.play();
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

  return { speak, stop, speaking, muted, toggleMute };
}
