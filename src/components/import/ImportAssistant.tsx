import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Loader2, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ImportAssistantProps {
  activeLogId: string | null;
  activeFileName?: string;
}

export function ImportAssistant({ activeLogId, activeFileName }: ImportAssistantProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("import-assistant", {
        body: {
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          context: {
            activeLogId,
            activeFileName,
          },
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Errore AI", description: data.error, variant: "destructive" });
        setMessages([...allMessages, { role: "assistant", content: `⚠️ ${data.error}` }]);
      } else {
        setMessages([...allMessages, { role: "assistant", content: data.content || "Nessuna risposta" }]);

        // Refresh data if the assistant modified something
        if (data.data_modified) {
          queryClient.invalidateQueries({ queryKey: ["import-logs"] });
          queryClient.invalidateQueries({ queryKey: ["imported-contacts"] });
          queryClient.invalidateQueries({ queryKey: ["import-errors"] });
          if (activeLogId) {
            queryClient.invalidateQueries({ queryKey: ["import-log", activeLogId] });
            queryClient.invalidateQueries({ queryKey: ["imported-contacts", activeLogId] });
            queryClient.invalidateQueries({ queryKey: ["import-errors", activeLogId] });
          }
          queryClient.invalidateQueries({ queryKey: ["partners"] });
          queryClient.invalidateQueries({ queryKey: ["activities"] });
        }
      }
    } catch (err) {
      console.error("Import assistant error:", err);
      setMessages([...allMessages, { role: "assistant", content: "❌ Errore di comunicazione con l'assistente." }]);
    } finally {
      setLoading(false);
    }
  }, [input, messages, loading, activeLogId, activeFileName, queryClient]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="fixed bottom-6 right-6 z-50 rounded-full h-12 w-12 p-0 shadow-lg"
      >
        <Bot className="w-5 h-5" />
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] max-w-[calc(100vw-48px)] bg-background border rounded-xl shadow-2xl flex flex-col" style={{ height: "min(600px, calc(100vh - 100px))" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30 rounded-t-xl">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">Assistente Import</span>
          {activeFileName && (
            <Badge variant="secondary" className="text-[10px] max-w-[160px] truncate">
              {activeFileName}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setOpen(false)}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-xs py-8 space-y-2">
            <Bot className="w-8 h-8 mx-auto opacity-40" />
            <p>Chiedimi qualsiasi cosa sugli import.</p>
            <p className="text-[10px]">Posso analizzare dati, trasferire contatti, creare attività, correggere errori.</p>
            <div className="flex flex-wrap gap-1 justify-center mt-3">
              {[
                "Quanti contatti ha l'ultimo import?",
                "Trasferisci tutti con email",
                "Mostra gli errori",
                "Statistiche globali",
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => { setInput(s); }}
                  className="text-[10px] px-2 py-1 rounded-full border hover:bg-accent transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_p]:my-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="text-muted-foreground text-xs">Elaborazione…</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t px-3 py-2 flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Chiedi o ordina un'azione…"
          className="min-h-[38px] max-h-[100px] resize-none text-sm"
          rows={1}
        />
        <Button
          size="sm"
          className="h-[38px] w-[38px] p-0 shrink-0"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
