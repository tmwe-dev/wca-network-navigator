import { useState, useRef, useCallback, useEffect } from "react";
import type { Msg } from "./useAiAssistantChat";
import { parseStructuredMessage } from "./useAiAssistantChat";
import { createLogger } from "@/lib/log";

const log = createLogger("useAiVoice");

const TTS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`;

export const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", lang: "🇺🇸" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", lang: "🇮🇹" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", lang: "🇬🇧" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", lang: "🇬🇧" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", lang: "🇬🇧" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", lang: "🇺🇸" },
];

export function useAiVoice(messages: Msg[], isLoading: boolean) {
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(VOICES[1].id);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSpokenIdxRef = useRef(-1);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const hasSpeechAPI = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);

  const stopSpeaking = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsSpeaking(false);
  }, []);

  const playTTS = useCallback(async (text: string) => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    setIsSpeaking(true);
    try {
      const response = await fetch(TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ text: text.slice(0, 2000), voiceId: selectedVoice }),
      });
      if (!response.ok) { setIsSpeaking(false); return; }
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); audioRef.current = null; };
      audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); audioRef.current = null; };
      await audio.play();
    } catch (e) { log.warn("operation failed, state reset", { error: e instanceof Error ? e.message : String(e) }); setIsSpeaking(false); }
  }, [selectedVoice]);

  useEffect(() => {
    if (!voiceEnabled || isLoading || messages.length === 0) return;
    const lastIdx = messages.length - 1;
    const last = messages[lastIdx];
    if (last.role !== "assistant" || lastIdx <= lastSpokenIdxRef.current) return;
    lastSpokenIdxRef.current = lastIdx;
    const { text } = parseStructuredMessage(last.content);
    if (!text || text.startsWith("⚠️")) return;
    const cleanText = text.replace(/[#*_`~\[\]()>|]/g, "").replace(/\n{2,}/g, ". ").replace(/\n/g, " ").trim();
    if (cleanText.length < 5) return;
    playTTS(cleanText);
  }, [messages, isLoading, voiceEnabled, playTTS]);

  const toggleListening = useCallback((onTranscript: (text: string) => void) => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const recognition = new SR();
    recognition.lang = "it-IT";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event: any) => { const transcript = event.results[0][0].transcript; if (transcript) onTranscript(transcript); };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening]);

  const resetSpoken = useCallback(() => { lastSpokenIdxRef.current = -1; }, []);

  return {
    voiceEnabled, setVoiceEnabled,
    selectedVoice, setSelectedVoice,
    isSpeaking, stopSpeaking,
    isListening, toggleListening,
    hasSpeechAPI, resetSpoken,
  };
}
