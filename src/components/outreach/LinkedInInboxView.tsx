import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Linkedin, RefreshCw, Loader2, Search, Wifi, WifiOff,
  Send, X, PanelLeftClose, PanelLeftOpen, Download, Square,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChannelMessages, useMarkAsRead, type ChannelMessage } from "@/hooks/useChannelMessages";
import { useLinkedInSync } from "@/hooks/useLinkedInSync";
import { useLinkedInMessagingBridge } from "@/hooks/useLinkedInMessagingBridge";
import { useLinkedInBackfill } from "@/hooks/useLinkedInBackfill";
import { toast } from "sonner";
import { sendLinkedIn as sendLinkedInUnified } from "@/lib/inbox/sendMessage";

type ChatThread = {
  contact: string;
  lastMessage: ChannelMessage;
  unreadCount: number;
  messages: ChannelMessage[];
};

export function LinkedInInboxView({ operatorUserId }: { operatorUserId?: string } = {}) {
  const [search, setSearch] = useState("");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useChannelMessages("linkedin", undefined, 0, operatorUserId);
  const markAsRead = useMarkAsRead();
  const { sendMessage, isFireScrapeAvailable } = useLinkedInMessagingBridge();
  const { isReading, isAvailable, readNow } = useLinkedInSync();
  const { progress: bfProgress, startBackfill, stopBackfill } = useLinkedInBackfill();

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
    const thread = threads.find(t => t.contact === contact);
    thread?.messages.forEach(msg => {
      if (msg.direction === "inbound" && !msg.read_at) {
        markAsRead.mutate(msg.id);
      }
    });
  }, [openTabs, threads, markAsRead]);

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

    // Extract threadUrl from messages — the extension needs a URL, not a name
    const threadUrl = activeThread?.messages
      ?.map(m => m.thread_id)
      .find(tid => tid && tid.startsWith("http"));

    if (!threadUrl) {
      toast.error("URL thread LinkedIn non trovato. Riprova dopo una sincronizzazione.");
      return;
    }

    setIsSending(true);
    setReplyText("");
    try {
      // Unified wrapper: rate limit + circuit breaker + persistence + session tracking
      const result = await sendLinkedInUnified(
        { recipient_url: threadUrl, text, thread_id: threadUrl },
        async (url, body) => sendMessage(url, body)
      );
      if (!result.success) {
        toast.error(`Invio fallito: ${result.error || "Errore sconosciuto"}`);
        setReplyText(text);
        return;
      }
      toast.success("Inviato ✓");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore invio");
      setReplyText(text);
    } finally {
      setIsSending(false);
    }
  };

  // No more auto-sync timer

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "flex flex-col border-r border-border bg-background shrink-0 transition-all duration-200",
        sidebarOpen ? "w-[280px] min-w-[280px]" : "w-[48px] min-w-[48px]"
      )}>
        {!sidebarOpen ? (
          <div className="flex flex-col items-center pt-2 gap-2">
            <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)} className="h-8 w-8" title="Apri contatti" aria-label="Visualizza">
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center">
              <Linkedin className="w-4 h-4 text-blue-600" />
            </div>
            {threads.some(t => t.unreadCount > 0) && (
              <span className="bg-destructive text-destructive-foreground text-[9px] rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                {threads.reduce((s, t) => s + t.unreadCount, 0)}
              </span>
            )}
          </div>
        ) : (
          <>
            <div className="flex-shrink-0 p-2 space-y-2 border-b border-border">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(false)} className="h-7 w-7" title="Chiudi lista" aria-label="Chiudi">
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </Button>
                <Button size="sm" variant="outline" onClick={readNow} disabled={isReading} className="gap-1 h-7 text-[11px] px-2">
                  {isReading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  Leggi
                </Button>
                <Badge variant={isAvailable ? "default" : "destructive"} className="text-[9px] gap-0.5 h-5 px-1.5">
                  {isAvailable ? <Wifi className="w-2.5 h-2.5" /> : <WifiOff className="w-2.5 h-2.5" />}
                  LI
                </Badge>
                <Badge variant={isFireScrapeAvailable ? "default" : "secondary"} className="text-[9px] gap-0.5 h-5 px-1.5" title="FireScrape">
                  {isFireScrapeAvailable ? "🔥" : "⭕"} FS
                </Badge>
                {bfProgress.status === "running" || bfProgress.status === "paused" ? (
                  <Button size="sm" variant="destructive" onClick={stopBackfill} className="gap-1 h-7 text-[11px] px-2">
                    <Square className="w-3 h-3" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={startBackfill} disabled={!isAvailable} className="gap-1 h-7 text-[11px] px-2" title="Recupera messaggi (1 thread)">
                    <Download className="w-3 h-3" /> Backfill
                  </Button>
                )}
              </div>

              {/* Backfill progress */}
              {(bfProgress.status === "running" || bfProgress.status === "paused") && (
                <div className="space-y-1.5 bg-muted/30 rounded-md p-2 border border-border">
                  <div className="text-[9px] text-muted-foreground space-y-0.5">
                    <p className="truncate">
                      {bfProgress.status === "paused" ? "⏸ " : "▶ "}
                      <span className="text-foreground font-medium">{bfProgress.currentThread || "Preparazione..."}</span>
                    </p>
                    {bfProgress.pauseReason && (
                      <p className="text-yellow-600 dark:text-yellow-400">⚠ {bfProgress.pauseReason}</p>
                    )}
                    <p>✓ {bfProgress.recoveredMessages} recuperati</p>
                    {bfProgress.lastError && (
                      <p className="text-red-400 truncate" title={bfProgress.lastError}>❌ {bfProgress.lastError}</p>
                    )}
                  </div>
                </div>
              )}
              {bfProgress.status === "done" && bfProgress.recoveredMessages > 0 && (
                <p className="text-[9px] text-green-600">✓ {bfProgress.recoveredMessages} messaggi recuperati</p>
              )}

              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..." className="h-7 pl-7 text-xs" />
              </div>
            </div>

            {/* Thread list */}
            <ScrollArea className="flex-1">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredThreads.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2 px-4">
                  <Linkedin className="w-8 h-8" />
                  <p className="text-xs text-center">Nessuna conversazione LinkedIn</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredThreads.map(thread => {
                    const isOpen = openTabs.includes(thread.contact);
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
                          <div className="w-9 h-9 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                            <Linkedin className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <span className={cn("text-sm truncate", thread.unreadCount > 0 ? "font-semibold" : "")}>
                                {thread.contact}
                              </span>
                              <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                {format(new Date(thread.lastMessage.created_at), "dd/MM HH:mm", { locale: it })}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {thread.lastMessage.direction === "outbound" && "Tu: "}
                              {thread.lastMessage.body_text?.slice(0, 50) || "(media)"}
                            </p>
                          </div>
                          {thread.unreadCount > 0 && (
                            <span className="bg-blue-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 flex-shrink-0">
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
          </>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {/* Tabs */}
        {openTabs.length > 0 && (
          <div className="flex-shrink-0 flex items-center border-b border-border bg-muted/30 overflow-x-auto">
            {openTabs.map(contact => {
              const thread = threads.find(t => t.contact === contact);
              const isActive = contact === activeTab;
              const unread = thread?.unreadCount || 0;
              return (
                <button
                  key={contact}
                  onClick={() => setActiveTab(contact)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border whitespace-nowrap transition-colors max-w-[180px]",
                    isActive
                      ? "bg-background text-foreground border-b-2 border-b-blue-500"
                      : "text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  <Linkedin className="w-3 h-3 text-blue-600 flex-shrink-0" />
                  <span className="truncate">{contact}</span>
                  {unread > 0 && (
                    <span className="bg-blue-500 text-white text-[9px] rounded-full min-w-[14px] h-[14px] flex items-center justify-center px-0.5 flex-shrink-0">
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
            <div className="flex-shrink-0 px-4 py-2 border-b border-border flex items-center justify-between bg-background">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                  <Linkedin className="w-4 h-4 text-blue-600" />
                </div>
                <span className="text-sm font-medium">{activeThread.contact}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{activeThread.messages.length} messaggi</span>
            </div>

            <ScrollArea className="flex-1 p-4">
              <div className="space-y-1.5 max-w-2xl mx-auto">
                {activeThread.messages.map(msg => {
                  const isOut = msg.direction === "outbound";
                  return (
                    <div key={msg.id} className={cn("flex", isOut ? "justify-end" : "justify-start")}>
                      <div className={cn(
                        "max-w-[75%] rounded-lg px-3 py-1.5 text-sm shadow-sm",
                        isOut
                          ? "bg-blue-600 text-white rounded-br-sm"
                          : "bg-card border border-border rounded-bl-sm"
                      )}>
                        <p className="whitespace-pre-wrap break-words">{msg.body_text || "(media)"}</p>
                        <p className={cn(
                          "text-[10px] mt-0.5 text-right",
                          isOut ? "text-blue-200" : "text-muted-foreground"
                        )}>
                          {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: it })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-background">
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  placeholder="Scrivi un messaggio LinkedIn..."
                  className="flex-1 text-sm h-9"
                  disabled={isSending || !isAvailable}
                />
                <Button
                  size="icon"
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending || !isAvailable}
                  className="bg-blue-600 hover:bg-blue-700 text-white h-9 w-9"
                  aria-label="Invia"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <Linkedin className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm">Seleziona una conversazione</p>
              <p className="text-xs">Le chat LinkedIn appariranno come tabs in alto</p>
              {enabled && <p className="text-[10px]">🔄 Sync automatico ogni 30 minuti</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
