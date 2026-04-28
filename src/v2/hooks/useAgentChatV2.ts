/**
 * useAgentChatV2 — Agent chat hub logic
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { queryKeys } from "@/lib/queryKeys";

interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
  readonly timestamp: string;
}

export function useAgentChatV2(agentId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const agentQuery = useQuery({
    queryKey: queryKeys.v2.agentChat(agentId),
    queryFn: async () => {
      if (!agentId) return null;
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("id", agentId)
        .maybeSingle();
      if (error) return null;
      return data;
    },
    enabled: !!agentId,
  });

  const sendMessage = useCallback(async (content: string) => {
    if (!agentId) return;
    const userMsg: ChatMessage = { role: "user", content, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    try {
      const result = await invokeEdge<{ reply: string }>("unified-assistant", {
        body: { message: content, agentId, scope: "chat" },
        context: "agentChatV2",
      });
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.reply ?? "Nessuna risposta",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Errore nella comunicazione con l'agente.", timestamp: new Date().toISOString() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  return { agent: agentQuery.data, messages, sendMessage, isLoading, clearMessages: () => setMessages([]) };
}
