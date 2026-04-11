/**
 * StaffPage — Staff Direzionale with AI chat canvas
 */
import * as React from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../atoms/Button";
import { Bot, Send, Plus } from "lucide-react";

interface ChatMessage {
  readonly role: "user" | "assistant";
  readonly content: string;
}

const STAFF_AGENTS = [
  { code: "director", name: "Direttore", emoji: "🎯" },
  { code: "account_manager", name: "Account Manager", emoji: "🤝" },
  { code: "strategist", name: "Strategist", emoji: "📊" },
] as const;

export function StaffPage(): React.ReactElement {
  const [selectedAgent, setSelectedAgent] = useState(STAFF_AGENTS[0].code);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["v2-work-plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_work_plans")
        .select("id, title, status, current_step, created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.content })),
          context: `staff_direzionale_${selectedAgent}`,
        },
      });
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: data?.response ?? data?.message ?? "Risposta non disponibile",
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Errore nella comunicazione con l'AI." }]);
    } finally {
      setSending(false);
    }
  };

  const agent = STAFF_AGENTS.find((a) => a.code === selectedAgent) ?? STAFF_AGENTS[0];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-foreground">Staff Direzionale</h2>
        </div>
        <nav className="p-2 space-y-1 flex-1">
          {STAFF_AGENTS.map((a) => (
            <button
              key={a.code}
              onClick={() => { setSelectedAgent(a.code); setMessages([]); }}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedAgent === a.code ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
            >
              {a.emoji} {a.name}
            </button>
          ))}
        </nav>
        {plans && plans.length > 0 ? (
          <div className="p-3 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Work Plans</p>
            {plans.slice(0, 5).map((p) => (
              <div key={p.id} className="text-xs text-foreground truncate py-0.5">{p.title}</div>
            ))}
          </div>
        ) : null}
      </aside>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        <div className="px-4 py-3 border-b bg-card flex items-center gap-2">
          <span className="text-xl">{agent.emoji}</span>
          <span className="font-semibold text-foreground">{agent.name}</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Inizia una conversazione con {agent.name}</p>
            </div>
          ) : null}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t bg-card flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            placeholder={`Scrivi a ${agent.name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <Button onClick={handleSend} isLoading={sending} size="icon"><Send className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  );
}
