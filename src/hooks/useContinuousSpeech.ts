import { useState, useRef, useCallback, useEffect } from "react";
import { createLogger } from "@/lib/log";

const log = createLogger("useContinuousSpeech");

/**
 * Continuous Speech-to-Text hook.
 * Keeps microphone active until manually stopped.
 * Auto-restarts on Chrome timeout (~60s).
 * Accumulates text with interim results shown live.
 */
export function useContinuousSpeech(onFinalText?: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [finalText, setFinalText] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API instance
  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef(false);
  const accumulatedRef = useRef("");

  const hasSpeechAPI =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const createRecognition = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Web Speech API not in TS lib
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return null;

    const recognition = new SR();
    recognition.lang = "it-IT";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SpeechRecognition event
    recognition.onresult = (e: any) => {
      let interim = "";
      let final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          final += transcript + " ";
        } else {
          interim += transcript;
        }
      }
      if (final) {
        accumulatedRef.current += final;
        setFinalText(accumulatedRef.current);
        onFinalText?.(accumulatedRef.current.trim());
      }
      setInterimText(interim);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SpeechRecognition error event
    recognition.onerror = (e: any) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      log.warn("speech error", { error: e.error });
    };

    recognition.onend = () => {
      // Auto-restart if user hasn't stopped manually (Chrome ~60s timeout)
      if (shouldListenRef.current) {
        try {
          recognition.start();
        } catch (e) {
          log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
          // already started
        }
      } else {
        setListening(false);
      }
    };

    return recognition;
  }, [onFinalText]);

  const start = useCallback(() => {
    if (!hasSpeechAPI) return;
    shouldListenRef.current = true;
    accumulatedRef.current = "";
    setFinalText("");
    setInterimText("");

    const recognition = createRecognition();
    if (!recognition) return;
    recognitionRef.current = recognition;

    try {
      recognition.start();
      setListening(true);
    } catch (e) {
      log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
      // already started
    }
  }, [hasSpeechAPI, createRecognition]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    setInterimText("");
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldListenRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    listening,
    interimText,
    finalText,
    fullText: (accumulatedRef.current + interimText).trim(),
    toggle,
    start,
    stop,
    hasSpeechAPI,
    reset: () => {
      accumulatedRef.current = "";
      setFinalText("");
      setInterimText("");
    },
  };
}
