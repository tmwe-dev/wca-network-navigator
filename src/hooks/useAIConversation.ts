import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  findConversations,
  getConversation,
  createConversation,
  updateConversation,
  deleteConversation as dalDeleteConversation,
  parseConversationMessages,
} from "@/data/aiConversations";

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

export function useAIConversation(pageContext: string) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async () => {
    const {
      data: { session: __s },
    } = await supabase.auth.getSession();
    const user = __s?.user ?? null;
    if (!user) return;
    const data = await findConversations(user.id, pageContext, 30);
    if (data) {
      setConversations(
        data.map((row) => ({
          id: row.id,
          title: row.title,
          messages: parseConversationMessages(row.messages),
          page_context: row.page_context,
          updated_at: row.updated_at,
        })),
      );
    }
  }, [pageContext]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const {
        data: { session: __s },
      } = await supabase.auth.getSession();
      const user = __s?.user ?? null;
      if (!user) {
        setLoading(false);
        return;
      }
      const list = await findConversations(user.id, pageContext, 1);
      if (list && list.length > 0) {
        const data = list[0];
        setConversationId(data.id);
        setMessages(parseConversationMessages(data.messages));
      }
      await loadList();
      setLoading(false);
    })();
  }, [pageContext, loadList]);

  const persistMessages = useCallback((id: string, msgs: ConversationMessage[], title?: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const update: Record<string, unknown> = { messages: structuredClone(msgs), updated_at: new Date().toISOString() };
      if (title) update.title = title;
      await updateConversation(id, update);
    }, 800);
  }, []);

  const addMessages = useCallback(
    async (newMsgs: ConversationMessage[]) => {
      const updated = [...messages, ...newMsgs];
      setMessages(updated);
      const firstUser = updated.find((m) => m.role === "user");
      const title = firstUser ? firstUser.content.slice(0, 60) : undefined;

      if (conversationId) {
        persistMessages(conversationId, updated, title);
      } else {
        const {
          data: { session: __s },
        } = await supabase.auth.getSession();
        const user = __s?.user ?? null;
        if (!user) return;
        const data = await createConversation({
          user_id: user.id,
          page_context: pageContext,
          title: title || "Nuova conversazione",
          messages: structuredClone(updated),
        });
        if (data) {
          setConversationId(data.id);
          loadList();
        }
      }
    },
    [messages, conversationId, pageContext, persistMessages, loadList],
  );

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
  }, []);

  const resumeConversation = useCallback(async (id: string) => {
    const data = await getConversation(id);
    if (data) {
      setConversationId(data.id);
      setMessages(parseConversationMessages(data.messages));
    }
  }, []);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await dalDeleteConversation(id);
      if (conversationId === id) newConversation();
      loadList();
    },
    [conversationId, newConversation, loadList],
  );

  return {
    messages,
    setMessages,
    conversationId,
    conversations,
    addMessages,
    newConversation,
    resumeConversation,
    deleteConversation: handleDeleteConversation,
    loading,
    loadList,
  };
}
