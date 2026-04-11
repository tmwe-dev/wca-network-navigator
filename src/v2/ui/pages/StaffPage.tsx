/**
 * StaffPage — Staff Direzionale with AI chat canvas
 */
import * as React from "react";
import { useState } from "react";
import { useStaffV2 } from "@/v2/hooks/useStaffV2";
import { Button } from "../atoms/Button";
import { Bot, Send } from "lucide-react";

export function StaffPage(): React.ReactElement {
  const {
    agents, selectedAgent, agent, messages, sending,
    plans, switchAgent, sendMessage,
  } = useStaffV2();
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-56 border-r bg-card flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-bold text-foreground">Staff Direzionale</h2>
        </div>
        <nav className="p-2 space-y-1 flex-1">
          {agents.map((a) => (
            <button
              key={a.code}
              onClick={() => switchAgent(a.code)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${selectedAgent === a.code ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50"}`}
            >
              {a.emoji} {a.name}
            </button>
          ))}
        </nav>
        {plans.length > 0 ? (
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
