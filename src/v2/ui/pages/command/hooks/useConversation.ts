/**
 * useConversation — multi-turn conversation persistence for /v2/command
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { isOk } from "@/v2/core/domain/result";
import {
  fetchConversations,
  fetchConversationMessages,
  type Conversation,
  type ConversationMessage,
} from "@/v2/io/supabase/queries/conversations";
import {
  createConversation,
  appendMessage,
  updateConversationTitle,
  archiveConversation,
} from "@/v2/io/supabase/mutations/conversations";

export function useConversation() {
  const { session } = useAuthV2();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const titleSetRef = useRef(false);

  // Load conversation list on mount
  useEffect(() => {
    if (!session?.user?.id) return;
    fetchConversations(30).then((res) => {
      if (isOk(res)) setConversations(res.value);
    });
  }, [session?.user?.id]);

  const ensureConversation = useCallback(
    async (firstUserPrompt?: string): Promise<string | null> => {
      if (conversationId) return conversationId;
      if (!session?.user?.id) return null;
      const title = firstUserPrompt
        ? firstUserPrompt.slice(0, 60)
        : "Nuova conversazione";
      const res = await createConversation(session?.session?.user?.id, title);
      if (!isOk(res)) return null;
      const newConv = res.value;
      setConversationId(newConv.id);
      setConversations((prev) => [newConv, ...prev]);
      titleSetRef.current = false;
      return newConv.id;
    },
    [conversationId, session?.user?.id],
  );

  const loadConversation = useCallback(async (id: string) => {
    setLoading(true);
    setConversationId(id);
    titleSetRef.current = true;
    const res = await fetchConversationMessages(id, 50);
    if (isOk(res)) setMessages(res.value);
    setLoading(false);
  }, []);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    titleSetRef.current = false;
  }, []);

  const addMessage = useCallback(
    async (msg: {
      role: "user" | "assistant" | "tool" | "system";
      content: string;
      tool_id?: string;
      tool_result?: unknown;
    }) => {
      const id = await ensureConversation(
        msg.role === "user" ? msg.content : undefined,
      );
      if (!id) return;
      const res = await appendMessage(id, msg);
      if (isOk(res)) setMessages((prev) => [...prev, res.value]);
    },
    [ensureConversation],
  );

  const archive = useCallback(
    async (id: string) => {
      await archiveConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        setConversationId(null);
        setMessages([]);
      }
    },
    [conversationId],
  );

  // Auto-rename after 4 messages
  useEffect(() => {
    if (messages.length >= 4 && !titleSetRef.current && conversationId) {
      const first = messages.find((m) => m.role === "user");
      if (first) {
        titleSetRef.current = true;
        updateConversationTitle(conversationId, first.content.slice(0, 60));
      }
    }
  }, [messages.length, messages, conversationId]);

  /** Build history array suitable for AI context */
  const getHistory = useCallback(
    (limit = 10) =>
      messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-limit)
        .map((m) => ({ role: m.role, content: m.content })),
    [messages],
  );

  return {
    conversationId,
    conversations,
    messages,
    loading,
    ensureConversation,
    loadConversation,
    newConversation,
    addMessage,
    archive,
    getHistory,
  };
}
