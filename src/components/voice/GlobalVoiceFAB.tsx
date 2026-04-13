/**
 * GlobalVoiceFAB — Floating action button per conversazione vocale AI.
 * STT locale (Web Speech API) + unified-assistant + ElevenLabs TTS.
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, Volume2, X } from "lucide-react";
import { useAppSettings } from "@/hooks/useAppSettings";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type VoiceState = "idle" | "listening" | "speaking";

interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } }; length: number };
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

function getSpeechRecognition(): (new () => SpeechRecognitionInstance) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

export default function GlobalVoiceFAB() {
  const { data: settings } = useAppSettings();
  const [state, setState] = useState<VoiceState>("idle");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef(false);

  const voiceId = settings?.["elevenlabs_default_voice_id"] || "JBFqnCBsd6RMkjVDRZzb";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current = true;
      recognitionRef.current?.abort();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const stopAll = useCallback(() => {
    abortRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState("idle");
  }, []);

  const speak = useCallback(
    async (text: string) => {
      if (abortRef.current) return;
      setState("speaking");

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token || "";

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ text: text.slice(0, 2000), voiceId }),
          },
        );

        if (!resp.ok || abortRef.current) {
          if (!abortRef.current) startListening();
          return;
        }

        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          if (!abortRef.current) startListening();
        };

        audio.onerror = () => {
          URL.revokeObjectURL(url);
          audioRef.current = null;
          if (!abortRef.current) startListening();
        };

        await audio.play();
      } catch {
        if (!abortRef.current) startListening();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voiceId],
  );

  const processTranscript = useCallback(
    async (transcript: string) => {
      if (!transcript.trim() || abortRef.current) return;
      setState("speaking");

      try {
        const result = await invokeEdge<{ content?: string; message?: string; reply?: string }>(
          "unified-assistant",
          {
            body: {
              message: transcript,
              scope: "strategic",
              mode: "conversational",
            },
            context: "GlobalVoiceFAB.unified_assistant",
          },
        );

        const reply = result?.content || result?.reply || result?.message || "";
        if (reply && !abortRef.current) {
          await speak(reply);
        } else if (!abortRef.current) {
          startListening();
        }
      } catch {
        if (!abortRef.current) startListening();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [speak],
  );

  const startListening = useCallback(() => {
    const SpeechRec = getSpeechRecognition();
    if (!SpeechRec) {
      console.warn("[GlobalVoiceFAB] Web Speech API not supported");
      setState("idle");
      return;
    }

    abortRef.current = false;
    setState("listening");

    const recognition = new SpeechRec();
    recognition.lang = "it-IT";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const last = e.results[e.results.length - 1];
      const transcript = last?.[0]?.transcript || "";
      processTranscript(transcript);
    };

    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      if (e.error === "not-allowed" || e.error === "service-not-available") {
        // Try en-US fallback
        if (recognition.lang === "it-IT") {
          recognition.lang = "en-US";
          try {
            recognition.start();
          } catch {
            setState("idle");
          }
          return;
        }
        setState("idle");
      } else if (e.error !== "aborted" && !abortRef.current) {
        // Restart on transient errors
        try {
          recognition.start();
        } catch {
          setState("idle");
        }
      }
    };

    recognition.onend = () => {
      // If still in listening state and not aborted, the result handler will take over
    };

    try {
      recognition.start();
    } catch {
      setState("idle");
    }
  }, [processTranscript]);

  const handleClick = useCallback(() => {
    if (state === "idle") {
      startListening();
    } else {
      stopAll();
    }
  }, [state, startListening, stopAll]);

  const stateConfig = {
    idle: {
      icon: Mic,
      bg: "bg-primary hover:bg-primary/90",
      ring: "",
    },
    listening: {
      icon: MicOff,
      bg: "bg-red-500 hover:bg-red-600",
      ring: "ring-2 ring-red-400 ring-offset-2 ring-offset-background animate-pulse",
    },
    speaking: {
      icon: Volume2,
      bg: "bg-green-500 hover:bg-green-600",
      ring: "",
    },
  };

  const config = stateConfig[state];
  const Icon = state === "idle" ? config.icon : state === "listening" ? X : config.icon;

  return (
    <div className="fixed bottom-20 right-6 z-50">
      {/* Agent badge */}
      <span className="absolute -top-2 -left-2 text-[10px] font-mono font-bold bg-background border border-border rounded-full px-1.5 py-0.5 z-10 select-none">
        LUCA
      </span>

      <button
        onClick={handleClick}
        className={cn(
          "relative rounded-full w-14 h-14 shadow-2xl flex items-center justify-center text-white transition-all duration-300",
          config.bg,
          config.ring,
          state === "idle" && "animate-pulse",
        )}
        aria-label={
          state === "idle"
            ? "Avvia conversazione vocale"
            : state === "listening"
              ? "Ferma ascolto"
              : "Ferma riproduzione"
        }
      >
        <Icon className="w-6 h-6" />
      </button>
    </div>
  );
}
