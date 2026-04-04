import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  MessageCircle, RefreshCw, Loader2, Search, Wifi, WifiOff, Play, Pause,
  Zap, Eye, Radio, Send, X, PanelLeftClose, PanelLeftOpen,
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
  0: { label: "Idle", color: "bg-muted text-muted-foreground", icon: Eye },
  3: { label: "Alert", color: "bg-yellow-500/20 text-yellow-700", icon: Zap },
  6: { label: "Live", color: "bg-green-500/20 text-green-700", icon: Radio },
} as const;

export function WhatsAppInboxView() {
  const [search, setSearch] = useState("");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
      const sorted = [...msgs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      result.push({
        contact,
        lastMessage: sorted[0],
        unreadCount: sorted.filter(m => m.direction === "inbound" && !m.read_at).length,
        messages: [...msgs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
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

  const activeThread = activeTab ? threads.find(t => t.contact === activeTab) : null;

  // Auto-scroll on new messages
  useEffect(() => {
    if (activeThread) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  }, [activeThread?.messages.length, activeTab]);

  const openChat = useCallback((contact: string) => {
    if (!openTabs.includes(contact)) {
      setOpenTabs(prev => [...prev, contact]);
    }
    setActiveTab(contact);
    focusOn(contact);
    // Mark as read
    const thread = threads.find(t => t.contact === contact);
    thread?.messages.forEach(msg => {
      if (msg.direction === "inbound" && !msg.read_at) {
        markAsRead.mutate(msg.id);
      }
    });
  }, [openTabs, threads, focusOn, markAsRead]);

  const closeTab = useCallback((contact: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenTabs(prev => prev.filter(t => t !== contact));
    if (activeTab === contact) {
      const remaining = openTabs.filter(t => t !== contact);
      setActiveTab(remaining.length > 0 ? remaining[remaining.length - 1] : null);
    }
  }, [activeTab, openTabs]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeTab || isSending) return;
    const text = replyText.trim();
    setIsSending(true);
    setReplyText("");
    try {
      const result = await sendWhatsApp(activeTab, text);
      if (!result.success) {
        toast.error(`Invio fallito: ${result.error || "Errore sconosciuto"}`);
        setReplyText(text);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("channel_messages").insert({
          user_id: user.id,
          channel: "whatsapp",
          direction: "outbound",
          to_address: activeTab,
          body_text: text,
          message_id_external: `wa_out_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        });
      }
      toast.success("Inviato ✓");
    } catch (err: any) {
      toast.error(err.message);
      setReplyText(text);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Sidebar: contact list — always visible */}
      <div className="flex flex-col border-r border-border bg-background w-[280px] min-w-[280px] shrink-0">
        {/* Header controls */}
        <div className="flex-shrink-0 p-2 space-y-2 border-b border-border">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => readNow()} disabled={isReading || !isAvailable} className="gap-1 h-7 text-[11px] px-2">
              {isReading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Leggi
            </Button>
            <Button size="sm" variant={enabled ? "default" : "outline"} onClick={toggle} disabled={!isAvailable} className="gap-1 h-7 text-[11px] px-2">
              {enabled ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              {enabled ? "ON" : "OFF"}
            </Button>
            <Badge variant={isAvailable ? "default" : "destructive"} className="text-[9px] gap-0.5 h-5 px-1.5">
              {isAvailable ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
              {isAvailable ? "On" : "Off"}
            </Badge>
            {enabled && (
              <Badge className={cn("text-[9px] gap-0.5 h-5 px-1.5 border-0", levelCfg.color)}>
                <LevelIcon className="w-2.5 h-2.5" />
                L{level}
              </Badge>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." className="h-7 pl-7 text-xs" />
          </div>
        </div>

        {/* Contact list */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 px-4">
              <MessageCircle className="w-8 h-8" />
              <p className="text-xs text-center">Nessuna conversazione</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredThreads.map(thread => {
                const isOpen = openTabs.includes(thread.contact);
                const isFocused = thread.contact === focusedChat;
                return (
                  <button
                    key={thread.contact}
                    onClick={() => openChat(thread.contact)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors",
                      isOpen && "bg-primary/5",
                      thread.unreadCount > 0 && !isOpen && "bg-accent/30",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0",
                        isFocused && enabled ? "bg-green-500/30" : "bg-green-500/15"
                      )}>
                        {isFocused && enabled ? (
                          <Radio className="w-4 h-4 text-green-600 animate-pulse" />
                        ) : (
                          <MessageCircle className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn("text-sm truncate", thread.unreadCount > 0 ? "font-semibold" : "")}>
                            {thread.contact}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {format(new Date(thread.lastMessage.created_at), "HH:mm", { locale: it })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {thread.lastMessage.direction === "outbound" && "Tu: "}
                          {thread.lastMessage.body_text?.slice(0, 50) || "(media)"}
                        </p>
                      </div>
                      {thread.unreadCount > 0 && (
                        <span className="bg-green-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
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

      {/* Main area: tabs + conversation */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Horizontal tabs bar */}
        {openTabs.length > 0 && (
          <div className="flex-shrink-0 flex items-center border-b border-border bg-muted/30 overflow-x-auto">
            {openTabs.map(contact => {
              const thread = threads.find(t => t.contact === contact);
              const isActive = contact === activeTab;
              const unread = thread?.unreadCount || 0;
              return (
                <button
                  key={contact}
                  onClick={() => { setActiveTab(contact); focusOn(contact); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border whitespace-nowrap transition-colors max-w-[180px]",
                    isActive
                      ? "bg-background text-foreground border-b-2 border-b-green-500"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <MessageCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                  <span className="truncate">{contact}</span>
                  {unread > 0 && (
                    <span className="bg-green-500 text-white text-[9px] rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 flex-shrink-0">
                      {unread}
                    </span>
                  )}
                  <button
                    onClick={(e) => closeTab(contact, e)}
                    className="ml-0.5 p-0.5 rounded hover:bg-destructive/20 flex-shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </button>
              );
            })}
          </div>
        )}

        {/* Chat content */}
        {activeThread ? (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Chat header */}
            <div className="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between bg-background">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <span className="text-sm font-medium">{activeThread.contact}</span>
                  {focusedChat === activeThread.contact && enabled && (
                    <p className="text-[10px] text-green-600 flex items-center gap-1">
                      <Radio className="w-2.5 h-2.5 animate-pulse" /> Live
                    </p>
                  )}
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {activeThread.messages.length} messaggi
              </span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-1.5 max-w-2xl mx-auto">
                {activeThread.messages.map(msg => {
                  const isOut = msg.direction === "outbound";
                  return (
                    <div key={msg.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[75%] rounded-lg px-3 py-1.5 text-sm shadow-sm",
                        isOut
                          ? "bg-green-600 text-white rounded-br-sm"
                          : "bg-card border border-border rounded-bl-sm"
                      )}>
                        <p className="whitespace-pre-wrap break-words">{msg.body_text || "(media)"}</p>
                        <p className={cn(
                          "text-[10px] mt-0.5 text-right",
                          isOut ? "text-green-200" : "text-muted-foreground"
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
            <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-background">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  placeholder="Scrivi un messaggio..."
                  className="flex-1 text-sm h-9"
                  disabled={isSending || !isAvailable}
                />
                <Button
                  size="icon"
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending || !isAvailable}
                  className="bg-green-600 hover:bg-green-700 text-white h-9 w-9"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageCircle className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm">Seleziona una conversazione</p>
              <p className="text-xs">Le chat aperte appariranno come tabs in alto</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
