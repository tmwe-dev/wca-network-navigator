/**
 * useStaffV2 — Staff chat + work plans
 */
import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeAi } from "@/lib/ai/invokeAi";

interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

const STAFF_AGENTS = [
  { code: "director", name: "Direttore", emoji: "🎯" },
  { code: "account_manager", name: "Account Manager", emoji: "🤝" },
  { code: "strategist", name: "Strategist", emoji: "📊" },
] as const;

export function useStaffV2() {
  const [selectedAgent, setSelectedAgent] = useState<string>(STAFF_AGENTS[0].code);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["v2", "work-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_work_plans")
        .select("id, title, status, current_step, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return data ?? [];
    },
  });

  const switchAgent = useCallback((code: string) => {
    setSelectedAgent(code);
    setMessages([]);
  }, []);

  const sendMessage = useCallback(async (input: string) => {
    if (!input.trim() || sending) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setSending(true);
    try {
      const data = await invokeAi<{ response?: string; message?: string }>("ai-assistant", {
        scope: "staff",
        body: {
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
          staffAgent: selectedAgent,
        },
        context: { source: "useStaffV2", route: "/v2/staff", mode: `staff_${selectedAgent}` },
      });
      setMessages([...newMsgs, { role: "assistant", content: data?.response ?? data?.message ?? "Risposta non disponibile" }]);
    } catch {
      setMessages([...newMsgs, { role: "assistant", content: "Errore nella comunicazione con l'AI." }]);
    } finally {
      setSending(false);
    }
  }, [messages, sending, selectedAgent]);

  const agent = STAFF_AGENTS.find((a) => a.code === selectedAgent) ?? STAFF_AGENTS[0];

  return {
    agents: STAFF_AGENTS,
    selectedAgent,
    agent,
    messages,
    sending,
    plans: plansQuery.data ?? [],
    switchAgent,
    sendMessage,
  };
}

export type { ChatMessage };
