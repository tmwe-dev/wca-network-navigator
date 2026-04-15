/**
 * useVoiceInput — Web Speech API hook for real-time voice transcription.
 * Chrome/Edge only. Auto-submits after configurable silence period.
 */
import { useEffect, useRef, useState, useCallback } from "react";

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
  onAutoSubmit?: (text: string) => void;
  silenceMs?: number;
  lang?: string;
}

interface UseVoiceInputReturn {
  listening: boolean;
  speaking: boolean;
  supported: boolean;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  error: string | null;
}

interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
}

export function useVoiceInput({
  onTranscript,
  onAutoSubmit,
  silenceMs = 2000,
  lang = "it-IT",
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalTranscriptRef = useRef<string>("");

  const SpeechRecognitionCtor =
    typeof window !== "undefined"
      ? (window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null)
      : null;

  const supported = Boolean(SpeechRecognitionCtor);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearSilenceTimer();
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
    setListening(false);
    setSpeaking(false);
  }, [clearSilenceTimer]);

  const start = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setError("Riconoscimento vocale non supportato dal browser. Usa Chrome o Edge.");
      return;
    }

    setError(null);
    finalTranscriptRef.current = "";

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      setSpeaking(true);
      clearSilenceTimer();

      let interim = "";
      let finalChunk = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalChunk += transcript;
        } else {
          interim += transcript;
        }
      }

      if (finalChunk) {
        finalTranscriptRef.current += finalChunk;
      }

      const full = (finalTranscriptRef.current + interim).trim();
      onTranscript(full);

      // Auto-submit after silence
      silenceTimerRef.current = setTimeout(() => {
        setSpeaking(false);
        const text = finalTranscriptRef.current.trim();
        if (text && onAutoSubmit) {
          onAutoSubmit(text);
        }
        stop();
      }, silenceMs);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const msg =
        event.error === "not-allowed"
          ? "Permesso microfono negato. Abilita il microfono nelle impostazioni del browser."
          : event.error === "no-speech"
            ? "Nessun audio rilevato."
            : `Errore riconoscimento vocale: ${event.error}`;
      setError(msg);
      stop();
    };

    recognition.onend = () => {
      setListening(false);
      setSpeaking(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Impossibile avviare il microfono";
      setError(msg);
      stop();
    }
  }, [SpeechRecognitionCtor, lang, onTranscript, onAutoSubmit, silenceMs, stop, clearSilenceTimer]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { listening, speaking, supported, start, stop, toggle, error };
}
