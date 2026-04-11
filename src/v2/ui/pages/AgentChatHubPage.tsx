/**
 * AgentChatHubPage — Chat with AI agents
 */
import * as React from "react";
import { useState } from "react";
import { useAgentsV2 } from "@/v2/hooks/useAgentsV2";
import { useAgentChatV2 } from "@/v2/hooks/useAgentChatV2";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Send, Bot } from "lucide-react";

export function AgentChatHubPage(): React.ReactElement {
  const { data: agents } = useAgentsV2();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { agent, messages, sendMessage, isLoading, clearMessages } = useAgentChatV2(selectedAgentId);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input);
    setInput("");
  };

  return (
    <div className="h-full flex gap-4 p-4">
      {/* Agent sidebar */}
      <Card className="w-64 shrink-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" /> Agenti</CardTitle>
        </CardHeader>
        <CardContent className="p-2">
          <ScrollArea className="h-[calc(100vh-200px)]">
            <div className="space-y-1">
              {(agents ?? []).map((a) => (
                <button
                  key={a.id}
                  onClick={() => { setSelectedAgentId(a.id); clearMessages(); }}
                  className={`w-full text-left p-2 rounded-lg text-sm transition-colors ${
                    selectedAgentId === a.id ? "bg-primary/10 text-primary" : "hover:bg-muted"
                  }`}
                >
                  <span className="mr-2">{a.avatarEmoji}</span>
                  {a.name}
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            {agent ? `${agent.avatar_emoji} ${agent.name}` : "Seleziona un agente"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col p-0">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-lg p-3 text-sm ${
                    msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-lg p-3 text-sm animate-pulse">Sto pensando...</div>
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-4 border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={selectedAgentId ? "Scrivi un messaggio..." : "Seleziona un agente"}
              disabled={!selectedAgentId}
            />
            <Button onClick={handleSend} disabled={!selectedAgentId || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
