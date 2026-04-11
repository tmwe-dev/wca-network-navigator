/**
 * MissionBuilderPage — Mission creation for AI agents
 */
import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../atoms/Button";
import { Crosshair, Send, Bot } from "lucide-react";
import { toast } from "sonner";

interface MissionMsg { readonly role: "user" | "assistant"; readonly content: string; }

export function MissionBuilderPage(): React.ReactElement {
  const [messages, setMessages] = useState<MissionMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const { data: agents } = useQuery({
    queryKey: ["v2-agents-for-mission"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agents").select("id, name, avatar_emoji, is_active").eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const userMsg: MissionMsg = { role: "user", content: input.trim() };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setSending(true);
    try {
      const { data } = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
          context: "mission_builder",
        },
      });
      setMessages([...newMsgs, { role: "assistant", content: data?.response ?? "Risposta non disponibile" }]);
    } catch {
      setMessages([...newMsgs, { role: "assistant", content: "Errore nella comunicazione." }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full">
      <aside className="w-56 border-r bg-card p-4 space-y-4">
        <h3 className="font-bold text-foreground flex items-center gap-2"><Crosshair className="h-4 w-4" />Missione</h3>
        <p className="text-xs text-muted-foreground">Descrivi la missione e l'AI creerà un piano strutturato.</p>
        {agents && agents.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Agenti disponibili</p>
            {agents.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm text-foreground">
                <span>{a.avatar_emoji}</span><span>{a.name}</span>
              </div>
            ))}
          </div>
        ) : null}
      </aside>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Crosshair className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Descrivi la tua missione per iniziare</p>
              <p className="text-xs text-muted-foreground mt-1">Es: "Contatta tutti i partner in Germania senza email"</p>
            </div>
          ) : null}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[70%] rounded-lg px-4 py-2 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {m.content}
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t bg-card flex gap-2">
          <input
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm text-foreground"
            placeholder="Descrivi la missione..."
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
