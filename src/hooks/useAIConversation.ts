import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  page_context: string | null;
  updated_at: string;
}

/**
 * Shared hook for persisting AI conversations.
 * @param pageContext - e.g. 'intelliflow' | 'global'
 */
export function useAIConversation(pageContext: string) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load conversation list for this page context
  const loadList = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("ai_conversations")
      .select("id, title, messages, page_context, updated_at")
      .eq("user_id", user.id)
      .eq("page_context", pageContext)
      .order("updated_at", { ascending: false })
      .limit(30);
    if (data) setConversations(data as unknown as Conversation[]);
  }, [pageContext]);

  // Load most recent conversation on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data } = await supabase
        .from("ai_conversations")
        .select("id, title, messages, page_context, updated_at")
        .eq("user_id", user.id)
        .eq("page_context", pageContext)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setConversationId(data.id);
        setMessages((data.messages as unknown as ConversationMessage[]) || []);
      }
      await loadList();
      setLoading(false);
    })();
  }, [pageContext, loadList]);

  // Debounced save to DB
  const persistMessages = useCallback(
    (id: string, msgs: ConversationMessage[], title?: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        const update: Record<string, unknown> = {
          messages: structuredClone(msgs),
          updated_at: new Date().toISOString(),
        };
        if (title) update.title = title;
        await supabase.from("ai_conversations").update(update).eq("id", id);
      }, 800);
    },
    []
  );

  // Add messages and auto-persist
  const addMessages = useCallback(
    async (newMsgs: ConversationMessage[]) => {
      const updated = [...messages, ...newMsgs];
      setMessages(updated);

      // Auto-generate title from first user message
      const firstUser = updated.find((m) => m.role === "user");
      const title = firstUser ? firstUser.content.slice(0, 60) : undefined;

      if (conversationId) {
        persistMessages(conversationId, updated, title);
      } else {
        // Create new conversation
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("ai_conversations")
          .insert([{
            user_id: user.id,
            page_context: pageContext,
            title: title || "Nuova conversazione",
            messages: structuredClone(updated),
          }])
          .select("id")
          .single();
        if (data) {
          setConversationId(data.id);
          loadList();
        }
      }
    },
    [messages, conversationId, pageContext, persistMessages, loadList]
  );

  // Start new conversation
  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  // Resume a specific conversation
  const resumeConversation = useCallback(
    async (id: string) => {
      const { data } = await supabase
        .from("ai_conversations")
        .select("id, title, messages, page_context, updated_at")
        .eq("id", id)
        .single();
      if (data) {
        setConversationId(data.id);
        setMessages((data.messages as unknown as ConversationMessage[]) || []);
      }
    },
    []
  );

  // Delete a conversation
  const deleteConversation = useCallback(
    async (id: string) => {
      await supabase.from("ai_conversations").delete().eq("id", id);
      if (conversationId === id) newConversation();
      loadList();
    },
    [conversationId, newConversation, loadList]
  );

  return {
    messages,
    setMessages,
    conversationId,
    conversations,
    addMessages,
    newConversation,
    resumeConversation,
    deleteConversation,
    loading,
    loadList,
  };
}
