import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { format, isToday, isYesterday, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import { Check, CheckCheck, Paperclip } from "lucide-react";
import {
  MessageCircle, RefreshCw, Loader2, Search, Wifi, WifiOff, Play, Pause,
  Zap, Eye, Radio, Send, X, PanelLeftClose, PanelLeftOpen, Download, Square,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { createLogger } from "@/lib/log";

const waLog = createLogger("WhatsAppInboxView");
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useChannelMessages, useMarkAsRead, type ChannelMessage } from "@/hooks/useChannelMessages";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useWhatsAppBackfill } from "@/hooks/useWhatsAppBackfill";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendWhatsApp as sendWhatsAppUnified } from "@/lib/inbox/sendMessage";

type ChatThread = {
  contact: string;
  lastMessage: ChannelMessage;
  unreadCount: number;
  messages: ChannelMessage[];
};

/** Extract a phone number from thread messages' raw_payload */
function extractPhoneFromThread(thread: ChatThread): string | null {
  for (const msg of thread.messages) {
    const payload = msg.raw_payload as Record<string, unknown> | null | undefined;
    if (!payload) continue;

    // Direct phone field
    if (typeof payload.phone === "string" && payload.phone.replace(/\D/g, "").length >= 5) {
      return payload.phone.replace(/\D/g, "");
    }

    // JID format: 391234567890@s.whatsapp.net
    if (typeof payload.jid === "string") {
      const match = payload.jid.match(/^(\d{5,})@/);
      if (match) return match[1];
    }

    // Sender field
    if (typeof payload.sender === "string") {
      const digits = payload.sender.replace(/\D/g, "");
      if (digits.length >= 5) return digits;
    }

    // from_address on the message itself (inbound)
    if (msg.direction === "inbound" && typeof msg.from_address === "string") {
      const digits = msg.from_address.replace(/\D/g, "");
      if (digits.length >= 5) return digits;
    }
  }

  // Last resort: check contact name for digits
  const contactDigits = thread.contact.replace(/\D/g, "");
  if (contactDigits.length >= 5) return contactDigits;

  return null;
}

function isSidebarGhostMessage(msg: ChannelMessage) {
  const payload = msg.raw_payload as Record<string, unknown> | null | undefined;
  if (!payload) return false;
  if (payload.isVerify === true) return true;

  const hasSidebarShape =
    Object.prototype.hasOwnProperty.call(payload, "contact") ||
    Object.prototype.hasOwnProperty.call(payload, "lastMessage") ||
    Object.prototype.hasOwnProperty.call(payload, "unreadCount");

  if (!hasSidebarShape) return false;

  const payloadLastMessage = typeof payload.lastMessage === "string" ? payload.lastMessage.trim() : "";
  const payloadText = typeof payload.text === "string" ? payload.text.trim() : "";
  const bodyText = msg.body_text?.trim() || "";

  return !bodyText && !payloadLastMessage && !payloadText;
}

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
  const { progress: bfProgress, startBackfill, stopBackfill } = useWhatsAppBackfill();

  const levelCfg = LEVEL_CONFIG[level];
  const LevelIcon = levelCfg.icon;

  // Group messages by contact
  const threads = useMemo(() => {
    const visibleMessages = messages.filter(msg => !isSidebarGhostMessage(msg));
    const map = new Map<string, ChannelMessage[]>();
    visibleMessages.forEach(msg => {
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
      // Normalize contact name: strip emoji and special chars
      const normalizedContact = activeTab
        .replace(/[\u{1F600}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '')
        .trim();
      const contactToSend = normalizedContact || activeTab.trim();

      // Bridge sender adapter: tries by contact name, then falls back to phone
      const bridgeSender = async (recipient: string, body: string) => {
        let r = await sendWhatsApp(recipient, body);
        if (!r.success && activeThread) {
          const phone = extractPhoneFromThread(activeThread);
          if (phone) {
            waLog.info("retry send with phone", { phone });
            r = await sendWhatsApp(phone, body);
          }
        }
        return r;
      };

      // Unified wrapper: rate limit + circuit breaker + persistence + session tracking
      const result = await sendWhatsAppUnified(
        { recipient: contactToSend, text },
        bridgeSender
      );

      if (!result.success) {
        toast.error(`Invio fallito: ${result.error || "Errore sconosciuto"}`);
        setReplyText(text);
        return;
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
      {/* Sidebar: collapsible contact list */}
      <div className={cn(
        "flex flex-col border-r border-border bg-background shrink-0 transition-all duration-200",
        sidebarOpen ? "w-[280px] min-w-[280px]" : "w-[48px] min-w-[48px]"
      )}>
        {/* Collapsed: just WA icon + toggle */}
        {!sidebarOpen ? (
          <div className="flex flex-col items-center pt-2 gap-2">
            <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(true)} className="h-8 w-8" title="Apri contatti">
              <PanelLeftOpen className="w-4 h-4" />
            </Button>
            <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
              <MessageCircle className="w-4 h-4 text-green-600" />
            </div>
            {threads.some(t => t.unreadCount > 0) && (
              <span className="bg-destructive text-destructive-foreground text-[9px] rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-0.5">
                {threads.reduce((s, t) => s + t.unreadCount, 0)}
              </span>
            )}
          </div>
        ) : (
          <>
            {/* Header controls */}
            <div className="flex-shrink-0 p-2 space-y-2 border-b border-border">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(false)} className="h-7 w-7" title="Chiudi lista">
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </Button>
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
                {/* Backfill button */}
                {bfProgress.status === "running" || bfProgress.status === "paused" ? (
                  <Button size="sm" variant="destructive" onClick={stopBackfill} className="gap-1 h-7 text-[11px] px-2">
                    <Square className="w-3 h-3" /> Stop
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={startBackfill} disabled={!isAvailable} className="gap-1 h-7 text-[11px] px-2" title="Recupera messaggi persi">
                    <Download className="w-3 h-3" /> Backfill
                  </Button>
                )}
              </div>
              {/* Backfill progress panel */}
              {(bfProgress.status === "running" || bfProgress.status === "paused") && (
                <div className="space-y-1.5 bg-muted/30 rounded-md p-2 border border-border">
                  <Progress value={bfProgress.totalChats > 0 ? (bfProgress.processedChats / bfProgress.totalChats) * 100 : 0} className="h-1.5" />
                  <div className="text-[9px] text-muted-foreground space-y-0.5">
                    <p className="truncate">
                      {bfProgress.status === "paused" ? "⏸ " : "▶ "}
                      <span className="text-foreground font-medium">{bfProgress.currentChat || "Preparazione..."}</span>
                      {" "}({bfProgress.processedChats}/{bfProgress.totalChats})
                    </p>
                    {bfProgress.nextChat && (
                      <p className="truncate">Prossima: {bfProgress.nextChat}</p>
                    )}
                    {bfProgress.status === "paused" && bfProgress.pauseReason && (
                      <p className="text-yellow-600 dark:text-yellow-400">⚠ {bfProgress.pauseReason}</p>
                    )}
                    {bfProgress.pauseEndsAt && (
                      <BackfillCountdown endsAt={bfProgress.pauseEndsAt} />
                    )}
                    <p>
                      ✓ {bfProgress.recoveredMessages} recuperati
                      {bfProgress.errors > 0 && <span className="text-red-500 ml-1">• {bfProgress.errors} errori</span>}
                    </p>
                    {bfProgress.lastError && (
                      <p className="text-red-400 truncate" title={bfProgress.lastError}>❌ {bfProgress.lastError}</p>
                    )}
                  </div>
                </div>
              )}
              {bfProgress.status === "done" && bfProgress.recoveredMessages > 0 && (
                <p className="text-[9px] text-green-600">✓ {bfProgress.recoveredMessages} messaggi recuperati</p>
              )}
              {bfProgress.status === "error" && bfProgress.lastError && (
                <p className="text-[9px] text-red-500">❌ {bfProgress.lastError}</p>
              )}
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
          </>
        )}
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
            {/* Chat header - enriched */}
            <div className="flex-shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between" style={{ background: "hsl(var(--muted) / 0.3)" }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <span className="text-sm font-semibold">{activeThread.contact}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(() => {
                      const phone = extractPhoneFromThread(activeThread);
                      return phone ? (
                        <span className="text-[10px] text-muted-foreground font-mono">+{phone}</span>
                      ) : null;
                    })()}
                    {focusedChat === activeThread.contact && enabled && (
                      <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                        <Radio className="w-2.5 h-2.5 animate-pulse" /> Online
                      </span>
                    )}
                    {activeThread.unreadCount > 0 && (
                      <Badge variant="default" className="text-[9px] h-4 px-1.5 bg-green-500 hover:bg-green-500">
                        {activeThread.unreadCount} non letti
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground">
                {activeThread.messages.length} messaggi
              </span>
            </div>

            {/* Messages with date separators, clustering, tails */}
            <ScrollArea className="flex-1" style={{ background: "hsl(var(--muted) / 0.15)" }}>
              <div className="max-w-2xl mx-auto px-4 py-3">
                {(() => {
                  const msgs = activeThread.messages;
                  const elements: React.ReactNode[] = [];
                  let lastDateStr = "";
                  let lastDirection = "";

                  msgs.forEach((msg, idx) => {
                    const date = new Date(msg.created_at);
                    const dateStr = format(date, "yyyy-MM-dd");
                    const isOut = msg.direction === "outbound";
                    const sameAsPrev = msg.direction === lastDirection;
                    const isFirstInCluster = !sameAsPrev;

                    // Date separator
                    if (dateStr !== lastDateStr) {
                      const label = isToday(date) ? "Oggi"
                        : isYesterday(date) ? "Ieri"
                        : format(date, "d MMMM yyyy", { locale: it });
                      elements.push(
                        <div key={`sep-${dateStr}`} className="flex items-center justify-center my-4">
                          <span className="text-[11px] px-3 py-1 rounded-full bg-card border border-border text-muted-foreground shadow-sm font-medium">
                            {label}
                          </span>
                        </div>
                      );
                      lastDateStr = dateStr;
                    }

                    const bodyText = msg.body_text?.trim();
                    const hasContent = !!bodyText;

                    elements.push(
                      <div
                        key={msg.id}
                        className={cn(
                          "flex",
                          isOut ? "justify-end" : "justify-start",
                          isFirstInCluster ? "mt-3" : "mt-0.5"
                        )}
                      >
                        <div
                          className={cn(
                            "relative max-w-[78%] px-3 py-1.5 text-sm shadow-sm",
                            isOut
                              ? "bg-green-700 text-white rounded-l-xl rounded-tr-xl"
                              : "bg-card border border-border text-foreground rounded-r-xl rounded-tl-xl",
                            // Tail on first message of cluster
                            isFirstInCluster && isOut && "rounded-br-sm",
                            isFirstInCluster && !isOut && "rounded-bl-sm",
                            !isFirstInCluster && "rounded-xl"
                          )}
                        >
                          {/* Sender label on first bubble in cluster */}
                          {isFirstInCluster && (
                            <p className={cn(
                              "text-[11px] font-bold mb-0.5",
                              isOut ? "text-green-200" : "text-green-600"
                            )}>
                              {isOut ? "Tu" : activeThread.contact}
                            </p>
                          )}

                          {/* Body */}
                          {hasContent ? (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{bodyText}</p>
                          ) : (
                            <p className="flex items-center gap-1 italic opacity-70">
                              <Paperclip className="w-3.5 h-3.5" /> Media
                            </p>
                          )}

                          {/* Timestamp + status */}
                          <div className={cn(
                            "flex items-center gap-1 justify-end mt-0.5",
                            isOut ? "text-green-300" : "text-muted-foreground"
                          )}>
                            <span className="text-[10px]">
                              {format(date, "HH:mm", { locale: it })}
                            </span>
                            {isOut && (
                              msg.read_at
                                ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                                : <Check className="w-3 h-3" />
                            )}
                          </div>
                        </div>
                      </div>
                    );

                    lastDirection = msg.direction;
                  });

                  return elements;
                })()}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            {/* Reply input */}
            <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-background">
              {!isAvailable && (
                <p className="text-[10px] text-yellow-600 dark:text-yellow-400 mb-1 text-center">
                  ⚠ Estensione WhatsApp non connessa — il messaggio verrà inviato quando disponibile
                </p>
              )}
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  placeholder="Scrivi un messaggio..."
                  className="flex-1 text-sm h-9"
                  disabled={isSending}
                />
                <Button
                  size="icon"
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || isSending}
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

/** Live countdown for backfill pauses */
function BackfillCountdown({ endsAt }: { endsAt: number }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = Math.max(0, endsAt - Date.now());
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return (
    <p className="text-yellow-600 dark:text-yellow-400 font-mono font-semibold">
      ⏱ Riprende tra: {remaining}
    </p>
  );
}
