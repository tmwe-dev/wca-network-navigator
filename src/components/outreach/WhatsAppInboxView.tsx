import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { Check, CheckCheck, Paperclip, Mic, Upload } from "lucide-react";
import {
  MessageCircle, Loader2, Search, Radio, Send, X, PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { createLogger } from "@/lib/log";

const waLog = createLogger("WhatsAppInboxView");
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useChannelMessages, useMarkAsRead, type ChannelMessage } from "@/hooks/useChannelMessages";
import { useWhatsAppAdaptiveSync } from "@/hooks/useWhatsAppAdaptiveSync";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendWhatsApp as sendWhatsAppUnified } from "@/lib/inbox/sendMessage";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

type ChatThread = {
  contact: string;
  lastMessage: ChannelMessage;
  unreadCount: number;
  messages: ChannelMessage[];
};

function extractPhoneFromThread(thread: ChatThread): string | null {
  for (const msg of thread.messages) {
    const payload = msg.raw_payload as Record<string, unknown> | null | undefined;
    if (!payload) continue;
    if (typeof payload.phone === "string" && payload.phone.replace(/\D/g, "").length >= 5) return payload.phone.replace(/\D/g, "");
    if (typeof payload.jid === "string") { const m = payload.jid.match(/^(\d{5,})@/); if (m) return m[1]; }
    if (typeof payload.sender === "string") { const d = payload.sender.replace(/\D/g, ""); if (d.length >= 5) return d; }
    if (msg.direction === "inbound" && typeof msg.from_address === "string") { const d = msg.from_address.replace(/\D/g, ""); if (d.length >= 5) return d; }
  }
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

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

type WhatsAppInboxViewProps = {
  syncState?: { enabled: boolean; focusedChat: string | null; focusOn: (c: string) => void; isAvailable: boolean };
  backfillState?: unknown;
};

export function WhatsAppInboxView({ syncState }: WhatsAppInboxViewProps = {}) {
  const [search, setSearch] = useState("");
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useChannelMessages("whatsapp");
  const markAsRead = useMarkAsRead();
  const { sendWhatsApp } = useWhatsAppExtensionBridge();
  
  // Use passed-in sync state (from parent) or fall back to own hook
  const ownSync = useWhatsAppAdaptiveSync();
  const sync = syncState || ownSync;
  const { enabled, focusedChat, focusOn } = sync;

  // Group messages by contact
  const threads = useMemo(() => {
    const visibleMessages = messages.filter(msg => !isSidebarGhostMessage(msg));
    const map = new Map<string, ChannelMessage[]>();
    visibleMessages.forEach(msg => {
      const contact = msg.direction === "inbound" ? (msg.from_address || "Sconosciuto") : (msg.to_address || "Sconosciuto");
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
    return result.sort((a, b) => new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime());
  }, [messages]);

  const filteredThreads = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.toLowerCase();
    return threads.filter(t => t.contact.toLowerCase().includes(q) || t.lastMessage.body_text?.toLowerCase().includes(q));
  }, [threads, search]);

  const activeThread = activeTab ? threads.find(t => t.contact === activeTab) : null;

  useEffect(() => {
    if (activeThread) setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [activeThread?.messages.length, activeTab]);

  const openChat = useCallback((contact: string) => {
    if (!openTabs.includes(contact)) setOpenTabs(prev => [...prev, contact]);
    setActiveTab(contact);
    focusOn(contact);
    const thread = threads.find(t => t.contact === contact);
    thread?.messages.forEach(msg => {
      if (msg.direction === "inbound" && !msg.read_at) markAsRead.mutate(msg.id);
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

  // Upload file to storage and send link
  const uploadAndSendFile = useCallback(async (file: File) => {
    if (!activeTab) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Tipo file non supportato. Accettati: JPG, PNG, WEBP, GIF, PDF");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File troppo grande (max 10MB)");
      return;
    }

    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `wa/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: uploadError } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("chat-attachments").getPublicUrl(path);
      const fileUrl = urlData.publicUrl;

      const normalizedContact = activeTab.replace(/[\u{1F600}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim() || activeTab.trim();
      
      const text = `📎 ${file.name}\n${fileUrl}`;
      
      const bridgeSender = async (recipient: string, body: string) => {
        let r = await sendWhatsApp(recipient, body);
        if (!r.success && activeThread) {
          const phone = extractPhoneFromThread(activeThread);
          if (phone) r = await sendWhatsApp(phone, body);
        }
        return r;
      };

      const result = await sendWhatsAppUnified({ recipient: normalizedContact, text }, bridgeSender);
      if (!result.success) {
        toast.error(`Invio allegato fallito: ${result.error || "Errore"}`);
      } else {
        toast.success(`📎 ${file.name} inviato`);
      }
    } catch (err: any) {
      toast.error(`Upload fallito: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  }, [activeTab, activeThread, sendWhatsApp]);

  // Drag & drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeTab) setIsDragging(true);
  }, [activeTab]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === dropZoneRef.current) setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (!activeTab) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadAndSendFile(files[0]);
  }, [activeTab, uploadAndSendFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAndSendFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadAndSendFile]);

  const handleSendReply = async () => {
    if (!replyText.trim() || !activeTab || isSending) return;
    const text = replyText.trim();
    setIsSending(true);
    setReplyText("");
    try {
      const normalizedContact = activeTab.replace(/[\u{1F600}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();
      const contactToSend = normalizedContact || activeTab.trim();
      const bridgeSender = async (recipient: string, body: string) => {
        let r = await sendWhatsApp(recipient, body);
        if (!r.success && activeThread) {
          const phone = extractPhoneFromThread(activeThread);
          if (phone) { waLog.info("retry send with phone", { phone }); r = await sendWhatsApp(phone, body); }
        }
        return r;
      };
      const result = await sendWhatsAppUnified({ recipient: contactToSend, text }, bridgeSender);
      if (!result.success) { toast.error(`Invio fallito: ${result.error || "Errore sconosciuto"}`); setReplyText(text); return; }
      toast.success("Inviato ✓");
    } catch (err: any) { toast.error(err.message); setReplyText(text); } finally { setIsSending(false); }
  };

  return (
    <div className="flex h-full bg-background overflow-hidden" ref={dropZoneRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Drag overlay */}
      {isDragging && activeTab && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="w-10 h-10" />
            <p className="text-sm font-medium">Rilascia qui per inviare</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, GIF, PDF (max 10MB)</p>
          </div>
        </div>
      )}

      {/* Sidebar: clean — only search + contacts */}
      <div className={cn(
        "flex flex-col border-r border-border bg-background shrink-0 transition-all duration-200",
        sidebarOpen ? "w-[280px] min-w-[280px]" : "w-[48px] min-w-[48px]"
      )}>
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
            {/* Search only — controls moved to header */}
            <div className="flex-shrink-0 p-2 border-b border-border">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Button size="icon" variant="ghost" onClick={() => setSidebarOpen(false)} className="h-7 w-7" title="Chiudi lista">
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs font-medium text-muted-foreground">
                  {threads.length} chat
                  {threads.reduce((s, t) => s + t.unreadCount, 0) > 0 && (
                    <span className="text-green-600 ml-1">• {threads.reduce((s, t) => s + t.unreadCount, 0)} non letti</span>
                  )}
                </span>
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
          </>
        )}
      </div>

      {/* Main area: tabs + conversation */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
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
                  <button onClick={(e) => closeTab(contact, e)} className="ml-0.5 p-0.5 rounded hover:bg-destructive/20 flex-shrink-0">
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
                      return phone ? <span className="text-[10px] text-muted-foreground font-mono">+{phone}</span> : null;
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
              <span className="text-[10px] text-muted-foreground">{activeThread.messages.length} messaggi</span>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1" style={{ background: "hsl(var(--muted) / 0.15)" }}>
              <div className="max-w-2xl mx-auto px-4 py-3">
                {(() => {
                  const msgs = activeThread.messages;
                  const elements: React.ReactNode[] = [];
                  let lastDateStr = "";
                  let lastDirection = "";
                  msgs.forEach((msg) => {
                    const date = new Date(msg.created_at);
                    const dateStr = format(date, "yyyy-MM-dd");
                    const isOut = msg.direction === "outbound";
                    const sameAsPrev = msg.direction === lastDirection;
                    const isFirstInCluster = !sameAsPrev;
                    if (dateStr !== lastDateStr) {
                      const label = isToday(date) ? "Oggi" : isYesterday(date) ? "Ieri" : format(date, "d MMMM yyyy", { locale: it });
                      elements.push(
                        <div key={`sep-${dateStr}`} className="flex items-center justify-center my-4">
                          <span className="text-[11px] px-3 py-1 rounded-full bg-card border border-border text-muted-foreground shadow-sm font-medium">{label}</span>
                        </div>
                      );
                      lastDateStr = dateStr;
                    }
                    const bodyText = msg.body_text?.trim();
                    const hasContent = !!bodyText;
                    elements.push(
                      <div key={msg.id} className={cn("flex", isOut ? "justify-end" : "justify-start", isFirstInCluster ? "mt-3" : "mt-0.5")}>
                        <div className={cn(
                          "relative max-w-[78%] px-3 py-1.5 text-sm shadow-sm",
                          isOut ? "bg-green-700 text-white rounded-l-xl rounded-tr-xl" : "bg-card border border-border text-foreground rounded-r-xl rounded-tl-xl",
                          isFirstInCluster && isOut && "rounded-br-sm",
                          isFirstInCluster && !isOut && "rounded-bl-sm",
                          !isFirstInCluster && "rounded-xl"
                        )}>
                          {isFirstInCluster && (
                            <p className={cn("text-[11px] font-bold mb-0.5", isOut ? "text-green-200" : "text-green-600")}>
                              {isOut ? "Tu" : activeThread.contact}
                            </p>
                          )}
                          {hasContent ? (
                            <p className="whitespace-pre-wrap break-words leading-relaxed">{bodyText}</p>
                          ) : (
                            <p className="flex items-center gap-1 italic opacity-70"><Paperclip className="w-3.5 h-3.5" /> Media</p>
                          )}
                          <div className={cn("flex items-center gap-1 justify-end mt-0.5", isOut ? "text-green-300" : "text-muted-foreground")}>
                            <span className="text-[10px]">{format(date, "HH:mm", { locale: it })}</span>
                            {isOut && (msg.read_at ? <CheckCheck className="w-3.5 h-3.5 text-blue-300" /> : <Check className="w-3 h-3" />)}
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

            {/* Reply input with attachment support */}
            <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-background">
              {isUploading && (
                <p className="text-[10px] text-primary mb-1 text-center flex items-center justify-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> Caricamento file in corso...
                </p>
              )}
              <div className="flex items-center gap-2 max-w-2xl mx-auto">
                {/* Paperclip button */}
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf" className="hidden" onChange={handleFileSelect} />
                <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={!activeTab || isUploading} className="h-9 w-9 text-muted-foreground hover:text-foreground" title="Allega file">
                  <Paperclip className="w-4 h-4" />
                </Button>

                <Input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  placeholder="Scrivi un messaggio..."
                  className="flex-1 text-sm h-9"
                  disabled={isSending}
                />

                {/* Voice tooltip */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground/40 cursor-not-allowed" disabled>
                        <Mic className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Messaggi vocali non ancora supportati</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <Button size="icon" onClick={handleSendReply} disabled={!replyText.trim() || isSending} className="bg-green-600 hover:bg-green-700 text-white h-9 w-9">
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center space-y-2">
              <MessageCircle className="w-12 h-12 mx-auto opacity-30" />
              <p className="text-sm">Seleziona una conversazione</p>
              <p className="text-xs">Trascina foto o documenti nella chat per allegarli</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
