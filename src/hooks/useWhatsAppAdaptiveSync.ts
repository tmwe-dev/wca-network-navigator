/**
 * useWhatsAppAdaptiveSync — Manual-only WhatsApp sync.
 * No polling, no timers, no auto-sync. Download happens only on user click.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useWhatsAppDomLearning } from "@/hooks/useWhatsAppDomLearning";
import { buildDeterministicId } from "@/lib/messageDedup";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { markSessionExpired } from "@/lib/inbox/sessionTracker";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("useWhatsAppAdaptiveSync");

// Keep type export for backward compat but it's unused now
export type AttentionLevel = 0 | 3 | 6;

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /auth|session|login|expired|unauthorized|qr|logout/i.test(msg);
}

const OUTBOUND_PREFIXES = ["tu: ", "you: ", "tú: ", "du: ", "vous: ", "вы: ", "あなた: "];

function detectDirection(text: string): { direction: "inbound" | "outbound"; cleanText: string } {
  const lower = text.toLowerCase();
  for (const prefix of OUTBOUND_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return { direction: "outbound", cleanText: text.slice(prefix.length) };
    }
  }
  return { direction: "inbound", cleanText: text };
}

function normalizeWhatsAppTimestamp(rawValue: string): string | null {
  const value = rawValue.trim();
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  const hhmmMatch = value.match(/^(\d{1,2}):(\d{2})$/);
  if (hhmmMatch) {
    const date = new Date();
    date.setHours(Number(hhmmMatch[1]), Number(hhmmMatch[2]), 0, 0);
    return date.toISOString();
  }
  return null;
}

interface WhatsAppSidebarMessage {
  contact?: string;
  from?: string;
  time?: string;
  timestamp?: string;
  lastMessage?: string;
  text?: string;
  unreadCount?: number;
  isVerify?: boolean;
  direction?: "inbound" | "outbound";
}

function isSidebarPreviewMessage(msg: WhatsAppSidebarMessage) {
  return Object.prototype.hasOwnProperty.call(msg, "lastMessage") ||
    Object.prototype.hasOwnProperty.call(msg, "unreadCount");
}

function shouldSkipSidebarMessage(msg: WhatsAppSidebarMessage, text: string, rawTime: string) {
  if (msg.isVerify === true) return true;
  if (!isSidebarPreviewMessage(msg)) return false;
  if (!text.trim()) return true;
  return rawTime.trim().length === 0;
}

export function useWhatsAppAdaptiveSync() {
  const [isReading, setIsReading] = useState(false);
  const [focusedChat, setFocusedChat] = useState<string | null>(null);

  const { isAvailable, isAuthenticated, readUnread, readThread, onSidebarChanged: _onSidebarChanged } = useWhatsAppExtensionBridge();
  const { forceRelearn, isStale: domIsStale, lastLearnedAt } = useWhatsAppDomLearning();
  const queryClient = useQueryClient();

  const focusedChatRef = useRef<string | null>(null);
  const readingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => { focusedChatRef.current = focusedChat; }, [focusedChat]);
  useEffect(() => { readingRef.current = isReading; }, [isReading]);

  // ── Save messages to DB ──
  const saveMessages = useCallback(async (messages: WhatsAppSidebarMessage[], sessionUserId: string) => {
    // Resolve operator_id for this user
    const { data: opRow } = await supabase
      .from("operators")
      .select("id")
      .eq("user_id", sessionUserId)
      .maybeSingle();
    const operatorId = opRow?.id ?? null;
    if (!operatorId) {
      // No operator found for user, skipping save
      return { newCount: 0 };
    }

    let newCount = 0;
    for (const msg of messages) {
      const contact = String(msg.contact || msg.from || "").trim();
      if (!contact) continue;
      const rawTime = String(msg.time || msg.timestamp || "");
      const rawText = String(msg.lastMessage || msg.text || "");
      if (shouldSkipSidebarMessage(msg, rawText, rawTime)) continue;
      const { direction: detectedDir, cleanText } = detectDirection(rawText);
      const finalDirection = msg.direction || detectedDir;
      const text = cleanText.trim();
      if (!text) continue;
      const timestamp = normalizeWhatsAppTimestamp(rawTime) || new Date().toISOString();
      const extId = buildDeterministicId("wa", contact, text, rawTime || timestamp);
      const row = {
        user_id: sessionUserId,
        operator_id: operatorId,
        channel: "whatsapp",
        direction: finalDirection,
        from_address: finalDirection === "outbound" ? undefined : contact,
        to_address: finalDirection === "outbound" ? contact : undefined,
        body_text: text,
        message_id_external: extId,
        raw_payload: JSON.parse(JSON.stringify(msg)) as Record<string, string>,
        created_at: timestamp,
      };
      const { error, status } = await supabase
        .from("channel_messages")
        .upsert([row], { onConflict: "message_id_external", ignoreDuplicates: true });
      if (!error && status === 201) newCount++;
    }
    return { newCount };
  }, []);

  // ── Sidebar scan ──
  const sidebarScan = useCallback(async () => {
    if (readingRef.current) return;
    if (!mountedRef.current) return;
    setIsReading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const result = await readUnread();
      if (!result.success) return;
      const messages = ((result as Record<string, unknown>).messages || []) as WhatsAppSidebarMessage[];
      if (!messages.length) return;
      const { newCount } = await saveMessages(messages, session.user.id);
      if (newCount > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
        queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
        toast.success(`📱 ${newCount} nuovi messaggi WhatsApp`, { duration: 2000 });
        window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "whatsapp" } }));
      }
    } catch (err: unknown) {
      log.warn("sidebar_scan.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) setIsReading(false);
    }
  }, [readUnread, saveMessages, queryClient]);

  // ── Thread scan (when focused on a chat) ──
  const threadScan = useCallback(async () => {
    if (readingRef.current || !focusedChatRef.current) return;
    if (!mountedRef.current) return;
    setIsReading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const result = await readThread(focusedChatRef.current, 20);
      if (!result.success) return;
      const messages = ((result as Record<string, unknown>).messages || []) as WhatsAppSidebarMessage[];
      if (!messages.length) return;
      const { newCount } = await saveMessages(messages, session.user.id);
      if (newCount > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
      }
    } catch (err: unknown) {
      log.warn("thread_scan.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
    } finally {
      if (mountedRef.current) setIsReading(false);
    }
  }, [readThread, saveMessages, queryClient]);

  // ── Manual focus on a chat ──
  const focusOn = useCallback((contact: string) => {
    setFocusedChat(contact);
  }, []);

  // ── Manual read now — the ONLY way to trigger sync ──
  const readNow = useCallback(async () => {
    if (!isAvailable) {
      toast.error("Estensione WhatsApp non rilevata. Verifica che sia installata e la pagina ricaricata.");
      return;
    }
    if (!isAuthenticated) {
      toast.error("WhatsApp Web non autenticato. Apri web.whatsapp.com e scansiona il QR code.");
      return;
    }
    if (focusedChatRef.current) {
      await threadScan();
    } else {
      await sidebarScan();
    }
  }, [sidebarScan, threadScan, isAvailable, isAuthenticated]);

  return {
    isReading,
    isAvailable,
    isAuthenticated,
    focusedChat,
    focusOn,
    readNow,
    domIsStale,
    lastLearnedAt,
    forceRelearn,
  };
}
