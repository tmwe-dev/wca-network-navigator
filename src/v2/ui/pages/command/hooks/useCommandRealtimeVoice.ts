/**
 * useCommandRealtimeVoice — Hybrid voice mode for Command.
 *
 * Default voice path uses TTS (`useVoiceOutput`) + browser STT
 * (`useVoiceInput`). This hook is the on-demand alternative that opens a
 * full-duplex Conversational session against an ElevenLabs Agent
 * (low-latency turn-taking).
 *
 * The agent and its prompt live entirely in the ElevenLabs dashboard. The
 * client only requests a short-lived WebRTC token from the
 * `elevenlabs-conversation-token` edge function and starts the session.
 */
import { useCallback, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

const log = createLogger("useCommandRealtimeVoice");

export interface CommandRealtimeVoice {
  readonly status: "disconnected" | "connecting" | "connected";
  readonly isSpeaking: boolean;
  readonly error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

export function useCommandRealtimeVoice(): CommandRealtimeVoice {
  const [phase, setPhase] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [error, setError] = useState<string | null>(null);
  const bridgeTokenRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const conversation = useConversation({
    onConnect: () => setPhase("connected"),
    onDisconnect: () => setPhase("disconnected"),
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn("realtime voice error", { error: msg });
      setError(msg);
    },
    /**
     * Client tool ask_brain — l'agente ElevenLabs lo chiama ogni volta che serve
     * intelligenza vera. La voce/persona vive in 11labs; logica/dati in Brain.
     * Va registrato anche nella dashboard ElevenLabs come tool con parametro `question`.
     */
    clientTools: {
      ask_brain: async (params: { question?: string }) => {
        const question = (params?.question || "").trim();
        if (!question) return "Domanda vuota.";
        try {
          const { data, error: err } = await supabase.functions.invoke(
            "command-ask-brain",
            {
              body: {
                question,
                bridge_token: bridgeTokenRef.current,
                conversation_id: conversationIdRef.current,
                language: "it",
              },
            },
          );
          if (err) {
            log.warn("ask_brain invoke error", { error: err.message });
            return "Brain non raggiungibile, riprova tra poco.";
          }
          return (
            (data as { answer?: string } | null)?.answer ||
            "Nessuna risposta dal Brain."
          );
        } catch (e) {
          log.warn("ask_brain failed", { error: e instanceof Error ? e.message : String(e) });
          return "Errore tecnico interrogando il Brain.";
        }
      },
    },
  });

  const start = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    try {
      // Microphone permission first — failing fast yields a better UX than a
      // generic ElevenLabs SDK error.
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const { data, error: invokeErr } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: {} },
      );
      if (invokeErr) throw invokeErr;
      const payload = data as { token?: string; bridge_token?: string } | null;
      const token = payload?.token;
      bridgeTokenRef.current = payload?.bridge_token || null;
      if (!token) throw new Error("Token ElevenLabs non ricevuto");

      await conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
      });
      try {
        conversationIdRef.current = conversation.getId() || null;
      } catch { /* noop */ }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn("realtime start failed", { error: msg });
      setError(msg);
      setPhase("disconnected");
    }
  }, [conversation]);

  const stop = useCallback(async () => {
    try {
      await conversation.endSession();
    } catch (e) {
      log.warn("realtime stop failed", { error: e instanceof Error ? e.message : String(e) });
    } finally {
      setPhase("disconnected");
    }
  }, [conversation]);

  return {
    status: phase,
    isSpeaking: conversation.isSpeaking,
    error,
    start,
    stop,
  };
}