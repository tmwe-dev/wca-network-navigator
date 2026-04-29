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
import { useCallback, useState } from "react";
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

  const conversation = useConversation({
    onConnect: () => setPhase("connected"),
    onDisconnect: () => setPhase("disconnected"),
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn("realtime voice error", { error: msg });
      setError(msg);
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
      const token = (data as { token?: string } | null)?.token;
      if (!token) throw new Error("Token ElevenLabs non ricevuto");

      await conversation.startSession({
        conversationToken: token,
        connectionType: "webrtc",
      });
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