import { useState, useCallback, useRef } from "react";
import { useConversation } from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { invokeEdge } from "@/lib/api/invokeEdge";
import VoicePresence from "@/components/intelliflow/VoicePresence";
import type { Agent } from "@/hooks/useAgents";
import { createLogger } from "@/lib/log";

const log = createLogger("AgentVoiceCall");

interface Props {
  agent: Agent;
  onClose: () => void;
}

export function AgentVoiceCall({ agent, onClose }: Props) {
  const [isConnecting, setIsConnecting] = useState(false);
  const bridgeTokenRef = useRef<string | null>(null);

  const conversation = useConversation({
    onConnect: () => setIsConnecting(false),
    onDisconnect: () => onClose(),
    onError: (err) => {
      log.error("voice call error", { message: String(err) });
      setIsConnecting(false);
    },
  });

  const isConnected = conversation.status === "connected";

  const startCall = useCallback(async () => {
    if (!agent.elevenlabs_agent_id) return;
    setIsConnecting(true);
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const data = await invokeEdge<{ token?: string; bridge_token?: string }>(
        "elevenlabs-conversation-token",
        {
          body: { agent_id: agent.elevenlabs_agent_id },
          context: "AgentVoiceCall.elevenlabs_conversation_token",
        }
      );
      if (!data?.token) throw new Error("No token received");

      // Store bridge token for the voice session
      bridgeTokenRef.current = data.bridge_token || null;

      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (e) {
      log.error("start voice call failed", {
        message: e instanceof Error ? e.message : String(e),
      });
      setIsConnecting(false);
    }
  }, [agent.elevenlabs_agent_id, conversation]);

  const endCall = useCallback(async () => {
    await conversation.endSession();
    onClose();
  }, [conversation, onClose]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md"
      >
        <motion.div
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          className="flex flex-col items-center gap-6 p-8 rounded-3xl bg-card border border-border/40 shadow-2xl max-w-sm w-full mx-4"
        >
          <div className="flex flex-col items-center gap-2">
            <span className="text-5xl">{agent.avatar_emoji}</span>
            <h3 className="text-lg font-semibold text-foreground">{agent.name}</h3>
            <span className="text-xs text-muted-foreground capitalize">{agent.role}</span>
          </div>

          <div className="text-sm text-muted-foreground">
            {isConnecting && (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Connessione in corso…
              </span>
            )}
            {isConnected && (
              <span className="text-emerald-500">
                {conversation.isSpeaking ? "Sta parlando…" : "In ascolto…"}
              </span>
            )}
            {!isConnected && !isConnecting && <span>Pronto per la chiamata</span>}
          </div>

          <VoicePresence
            active={isConnected}
            speaking={conversation.isSpeaking}
            listening={isConnected && !conversation.isSpeaking}
          />

          <div className="flex items-center gap-4">
            {!isConnected ? (
              <Button
                size="lg"
                onClick={startCall}
                disabled={isConnecting || !agent.elevenlabs_agent_id}
                className="rounded-full h-14 w-14 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isConnecting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Phone className="w-5 h-5" />
                )}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="destructive"
                onClick={endCall}
                className="rounded-full h-14 w-14"
              >
                <PhoneOff className="w-5 h-5" />
              </Button>
            )}
          </div>

          {!isConnected && (
            <button
              onClick={onClose}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Chiudi
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
