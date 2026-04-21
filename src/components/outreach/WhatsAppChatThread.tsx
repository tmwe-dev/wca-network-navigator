/**
 * WhatsAppChatThread — area messaggi + reply + drag-drop allegati.
 * Scopo unico: visualizzare e rispondere a una conversazione WhatsApp (Documento 2 §2.4).
 */
import { useState, useRef, useEffect, useCallback } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { it } from "date-fns/locale";
import { Check, CheckCheck, Paperclip, Mic, Upload, Send, Loader2, Radio } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/log";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sendWhatsApp as sendWhatsAppUnified } from "@/lib/inbox/sendMessage";
import { useLogAction } from "@/hooks/useLogAction";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import type { ChatThread } from "./whatsappTypes";
import { extractPhoneFromThread, ACCEPTED_FILE_TYPES, MAX_FILE_SIZE } from "./whatsappTypes";

const log = createLogger("WhatsAppChatThread");

interface WhatsAppChatThreadProps {
  thread: ChatThread;
  focusedChat: string | null;
  syncEnabled: boolean;
  sendWhatsApp: (phone: string, text: string) => Promise<{ success: boolean; error?: string }>;
}

export function WhatsAppChatThread({ thread, focusedChat, syncEnabled, sendWhatsApp }: WhatsAppChatThreadProps) {
  const [replyText, setReplyText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const logAction = useLogAction();

  useEffect(() => {
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [thread.messages.length]);

  const normalizeContact = useCallback((contact: string) => {
    return contact.replace(/[\u{1F600}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim() || contact.trim();
  }, []);

  const createBridgeSender = useCallback((recipient: string) => {
    return async (_recipient: string, body: string) => {
      let r = await sendWhatsApp(_recipient, body);
      if (!r.success) {
        const phone = extractPhoneFromThread(thread);
        if (phone) {
          log.info("retry with phone", { phone });
          r = await sendWhatsApp(phone, body);
        }
      }
      return r;
    };
  }, [sendWhatsApp, thread]);

  const uploadAndSendFile = useCallback(async (file: File) => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
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
      const text = `📎 ${file.name}\n${urlData.publicUrl}`;
      const contactToSend = normalizeContact(thread.contact);
      const result = await sendWhatsAppUnified({ recipient: contactToSend, text }, createBridgeSender(contactToSend));
      if (!result.success) {
        toast.error(`Invio allegato fallito: ${result.error || "Errore"}`);
      } else {
        toast.success(`📎 ${file.name} inviato`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("file upload failed", { error: msg });
      toast.error(`Upload fallito: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  }, [thread, normalizeContact, createBridgeSender]);

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget === dropZoneRef.current) setIsDragging(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) uploadAndSendFile(files[0]);
  }, [uploadAndSendFile]);
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadAndSendFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [uploadAndSendFile]);

  const handleSendReply = async () => {
    if (!replyText.trim() || isSending) return;
    const text = replyText.trim();
    setIsSending(true);
    setReplyText("");
    try {
      const contactToSend = normalizeContact(thread.contact);
      const result = await sendWhatsAppUnified({ recipient: contactToSend, text }, createBridgeSender(contactToSend));
      if (!result.success) {
        toast.error(`Invio fallito: ${result.error || "Errore sconosciuto"}`);
        setReplyText(text);
        return;
      }
      toast.success("Inviato ✓");
      logAction.mutate({
        channel: "whatsapp",
        sourceType: "imported_contact",
        sourceId: crypto.randomUUID(),
        to: extractPhoneFromThread(thread) || thread.contact,
        title: `WhatsApp reply — ${thread.contact}`,
        subject: `Risposta WhatsApp a ${thread.contact}`,
        body: text,
        source: "manual",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("send reply failed", { error: msg });
      toast.error(msg);
      setReplyText(text);
    } finally {
      setIsSending(false);
    }
  };

  const phone = extractPhoneFromThread(thread);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden" ref={dropZoneRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="w-10 h-10" />
            <p className="text-sm font-medium">Rilascia qui per inviare</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WEBP, GIF, PDF (max 10MB)</p>
          </div>
        </div>
      )}

      {/* Chat header */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-border flex items-center justify-between" style={{ background: "hsl(var(--muted) / 0.3)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <span className="text-sm font-semibold">{thread.contact}</span>
            <div className="flex items-center gap-2 mt-0.5">
              {phone && <span className="text-[10px] text-muted-foreground font-mono">+{phone}</span>}
              {focusedChat === thread.contact && syncEnabled && (
                <span className="text-[10px] text-green-600 flex items-center gap-0.5">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> Online
                </span>
              )}
              {thread.unreadCount > 0 && (
                <Badge variant="default" className="text-[9px] h-4 px-1.5 bg-green-500 hover:bg-green-500">
                  {thread.unreadCount} non letti
                </Badge>
              )}
            </div>
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground">{thread.messages.length} messaggi</span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" style={{ background: "hsl(var(--muted) / 0.15)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          {(() => {
            const msgs = thread.messages;
            const elements: React.ReactNode[] = [];
            let lastDateStr = "";
            let lastDirection = "";
            msgs.forEach((msg) => {
              const date = new Date(msg.created_at);
              const dateStr = format(date, "yyyy-MM-dd");
              const isOut = msg.direction === "outbound";
              const isFirstInCluster = msg.direction !== lastDirection;
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
                        {isOut ? "Tu" : thread.contact}
                      </p>
                    )}
                    {bodyText ? (
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

      {/* Reply input */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-border bg-background">
        {isUploading && (
          <p className="text-[10px] text-primary mb-1 text-center flex items-center justify-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" /> Caricamento file in corso...
          </p>
        )}
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.pdf" className="hidden" onChange={handleFileSelect} />
          <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="h-9 w-9 text-muted-foreground hover:text-foreground" title="Allega file" aria-label="Carica">
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
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-9 w-9 text-muted-foreground/40 cursor-not-allowed" disabled aria-label="Dettatura vocale">
                  <Mic className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Messaggi vocali non ancora supportati</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button size="icon" onClick={handleSendReply} disabled={!replyText.trim() || isSending} className="bg-green-600 hover:bg-green-700 text-white h-9 w-9" aria-label="Invia">
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
