import { useState, useMemo, useRef, useEffect } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  MessageCircle, RefreshCw, Loader2, Search, Wifi, WifiOff, Play, Pause,
  Zap, Eye, Radio, Send,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChannelMessages, useMarkAsRead, type ChannelMessage } from "@/hooks/useChannelMessages";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ChatThread = {
  contact: string;
  lastMessage: ChannelMessage;
  unreadCount: number;
  messages: ChannelMessage[];
};

const LEVEL_CONFIG = {
  0: { label: "Idle", color: "bg-muted text-muted-foreground", icon: Eye, desc: "Scan ogni ~75s" },
  3: { label: "Alert", color: "bg-yellow-500/20 text-yellow-700", icon: Zap, desc: "Scan ogni ~15s" },
  6: { label: "Live", color: "bg-green-500/20 text-green-700", icon: Radio, desc: "Scan ogni ~4s" },
} as const;

export function WhatsAppInboxView() {
  const [search, setSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useChannelMessages("whatsapp");
  const markAsRead = useMarkAsRead();
  const { sendWhatsApp } = useWhatsAppExtensionBridge();
  const {
    level, enabled, toggle, isReading, isAvailable, focusedChat, focusOn, readNow,
  } = useWhatsAppAdaptiveSync();

  const levelCfg = LEVEL_CONFIG[level];
  const LevelIcon = levelCfg.icon;

  // Group messages by contact
  const threads = useMemo(() => {
    const map = new Map<string, ChannelMessage[]>();
    messages.forEach(msg => {
      const contact = msg.direction === "inbound"
        ? (msg.from_address || "Sconosciuto")
        : (msg.to_address || "Sconosciuto");
      if (!map.has(contact)) map.set(contact, []);
      map.get(contact)!.push(msg);
    });

    const result: ChatThread[] = [];
    map.forEach((msgs, contact) => {
      const sorted = msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      result.push({
        contact,
        lastMessage: sorted[0],
        unreadCount: sorted.filter(m => m.direction === "inbound" && !m.read_at).length,
        messages: msgs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
      });
    });

    return result.sort((a, b) =>
      new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime()
    );
  }, [messages]);

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t =>
      t.contact.toLowerCase().includes(q) ||
      t.lastMessage.body_text?.toLowerCase().includes(q)
    );
  }, [threads, search]);

  const selectedThread = selectedContact ? threads.find(t => t.contact === selectedContact) : null;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (selectedThread) {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [selectedThread?.messages.length]);

  const handleSelectThread = (thread: ChatThread) => {
    setSelectedContact(thread.contact);
    focusOn(thread.contact);
    thread.messages.forEach(msg => {
      if (msg.direction === "inbound" && !msg.read_at) {
        markAsRead.mutate(msg.id);
      }
    });
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedContact || isSending) return;
    const text = replyText.trim();
    setIsSending(true);
    setReplyText("");

    try {
      const result = await sendWhatsApp(selectedContact, text);
      if (!result.success) {
        toast.error(`Invio fallito: ${result.error || "Errore sconosciuto"}`);
        setReplyText(text); // restore text on failure
        return;
      }

      // Save outbound message to DB
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("channel_messages").insert({
          user_id: user.id,
          channel: "whatsapp",
          direction: "outbound",
          to_address: selectedContact,
          body_text: text,
          message_id_external: `wa_out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        });
      }

      toast.success("Messaggio inviato");
    } catch (err: any) {
      toast.error(`Errore: ${err.message}`);
      setReplyText(text);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  return (
    <div className="flex h-full">
      {/* Left: contact list */}
      <div className={cn(
        "flex flex-col border-r border-border",
        selectedThread ? "w-[300px]" : "flex-1"
      )}>
        <div className="flex-shrink-0 p-3 space-y-2 border-b border-border">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              onClick={() => readNow()}
              disabled={isReading || !isAvailable}
              className="gap-1.5"
            >
              {isReading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Leggi ora
            </Button>

            <Button
              size="sm"
              variant={enabled ? "default" : "outline"}
              onClick={toggle}
              disabled={!isAvailable}
              className="gap-1.5"
            >
              {enabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {enabled ? "Auto ON" : "Auto OFF"}
            </Button>

            <Badge variant={isAvailable ? "default" : "destructive"} className="text-[10px] gap-1 h-5">
              {isAvailable ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isAvailable ? "Connesso" : "Offline"}
            </Badge>

            {enabled && (
              <Badge className={cn("text-[10px] gap-1 h-5 border-0", levelCfg.color)}>
                <LevelIcon className={cn("w-3 h-3", level === 6 && "animate-pulse")} />
                {levelCfg.label}
              </Badge>
            )}
          </div>

          {focusedChat && enabled && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Radio className="w-3 h-3 text-green-500" />
              <span>Focus: <strong>{focusedChat}</strong></span>
              <span className="text-muted-foreground/50">· {levelCfg.desc}</span>
            </div>
          )}

          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca contatto..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 px-4">
              <MessageCircle className="w-8 h-8" />
              <p className="text-sm">Nessuna conversazione</p>
              <p className="text-xs text-center">
                {isAvailable
                  ? 'Clicca "Leggi ora" o attiva "Auto" per importare i messaggi'
                  : "Installa l'estensione WhatsApp per iniziare"
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredThreads.map(thread => {
                const isSelected = thread.contact === selectedContact;
                const isFocused = thread.contact === focusedChat;
                return (
                  <button
                    key={thread.contact}
                    onClick={() => handleSelectThread(thread)}
                    className={cn(
                      "w-full text-left p-3 hover:bg-muted/50 transition-colors",
                      isSelected && "bg-muted",
                      thread.unreadCount > 0 && "bg-primary/5",
                      isFocused && enabled && "ring-1 ring-green-500/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0",
                        isFocused && enabled ? "bg-green-500/30" : "bg-green-500/20"
                      )}>
                        {isFocused && enabled ? (
                          <Radio className="w-4 h-4 text-green-600 animate-pulse" />
                        ) : (
                          <MessageCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn("text-sm truncate", thread.unreadCount > 0 ? "font-semibold" : "font-normal")}>
                            {thread.contact}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {format(new Date(thread.lastMessage.created_at), "dd/MM HH:mm", { locale: it })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {thread.lastMessage.direction === "outbound" && "Tu: "}
                          {thread.lastMessage.body_text?.slice(0, 60) || "(media)"}
                        </p>
                      </div>
                      {thread.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                          {thread.unreadCount}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Right: chat conversation */}
      {selectedThread && (
        <div className="flex-1 flex flex-col min-w-0 bg-muted/10">
          <div className="flex-shrink-0 p-3 border-b border-border flex items-center justify-between bg-background">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <span className="text-sm font-medium">{selectedThread.contact}</span>
                {focusedChat === selectedThread.contact && enabled && (
                  <p className="text-[10px] text-green-600 flex items-center gap-1">
                    <Radio className="w-2.5 h-2.5 animate-pulse" /> Monitoraggio attivo
                  </p>
                )}
              </div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedContact(null)} className="text-xs">
              Chiudi
            </Button>
          </div>

          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2 max-w-lg mx-auto">
              {selectedThread.messages.map(msg => {
                const isOutbound = msg.direction === "outbound";
                return (
                  <div key={msg.id} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                      isOutbound
                        ? "bg-green-500 text-white rounded-br-sm"
                        : "bg-background border border-border rounded-bl-sm"
                    )}>
                      <p className="whitespace-pre-wrap break-words">{msg.body_text || "(media)"}</p>
                      <p className={cn(
                        "text-[10px] mt-1 text-right",
                        isOutbound ? "text-green-100" : "text-muted-foreground"
                      )}>
                        {format(new Date(msg.created_at), "HH:mm", { locale: it })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
          </ScrollArea>

          {/* Reply input */}
          <div className="flex-shrink-0 p-3 border-t border-border bg-background">
            <div className="flex items-center gap-2 max-w-lg mx-auto">
              <Input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi un messaggio..."
                className="flex-1 text-sm"
                disabled={isSending || !isAvailable}
              />
              <Button
                size="icon"
                onClick={handleSendReply}
                disabled={!replyText.trim() || isSending || !isAvailable}
                className="bg-green-500 hover:bg-green-600 text-white h-9 w-9"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
