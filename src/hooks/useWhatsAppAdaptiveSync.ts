/**
 * useWhatsAppAdaptiveSync — Unified WhatsApp sync from per-chat cursor.
 *
 * Single procedure:
 *   1. Per ogni chat in sidebar (letta o non), trova in DB l'ora dell'ultimo
 *      messaggio salvato per quel contact (cursor).
 *   2. Se sidebar.lastVisibleAt > cursor (o cursor null), apre il thread,
 *      legge i messaggi e salva quelli con timestamp > cursor.
 *   3. Letti/non letti non rilevano: il filtro è puramente temporale.
 *
 * API preservata per compat: readNow, isReading, isAvailable, isAuthenticated,
 * focusedChat, focusOn, domIsStale, lastLearnedAt, forceRelearn.
 */
import { useEffect, useRef, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useWhatsAppDomLearning } from "@/hooks/useWhatsAppDomLearning";
import { buildDeterministicId } from "@/lib/messageDedup";
import { parseWhatsAppTimestamp } from "@/lib/whatsappTimestamp";
import { toast } from "sonner";
import { createLogger } from "@/lib/log";
import { markSessionExpired } from "@/lib/inbox/sessionTracker";
import { queryKeys } from "@/lib/queryKeys";
import {
  getChannelContactCursor,
  getChannelContactCursors,
  upsertChannelMessageDedup,
} from "@/data/channelMessages";
import { tryAcquire, throttle, SyncGuardBusyError } from "@/lib/syncGuard";

const log = createLogger("useWhatsAppAdaptiveSync");

export type AttentionLevel = 0 | 3 | 6;

const OUTBOUND_PREFIXES = ["tu: ", "you: ", "tú: ", "du: ", "vous: ", "вы: ", "あなた: ", "io: "];
const WA_UI_LABELS = new Set([
  "gruppi", "da leggere", "ferie permessi malattie", "name", "group 1",
  "non letti", "preferiti", "archiviate", "tutti", "chat con lucchetto",
]);
const WA_GHOST_BODIES = new Set([
  "foto", "video", "audio", "sticker", "gif", "documento",
  "posizione", "contatto", "messaggio", "messaggio eliminato",
]);
const MAX_MESSAGES_PER_THREAD = 200;
const MAX_THREADS_PER_RUN = 40;

function isAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /auth|session|login|expired|unauthorized|qr|logout/i.test(msg);
}

function detectDirection(text: string): { direction: "inbound" | "outbound"; cleanText: string } {
  const lower = text.toLowerCase();
  for (const prefix of OUTBOUND_PREFIXES) {
    if (lower.startsWith(prefix)) {
      return { direction: "outbound", cleanText: text.slice(prefix.length) };
    }
  }
  return { direction: "inbound", cleanText: text };
}

interface SidebarChat {
  contact: string;
  lastMessage?: string;
  time?: string;
  unreadCount?: number;
  isVerify?: boolean;
}

interface ThreadMessage {
  contact?: string;
  from?: string;
  text?: string;
  lastMessage?: string;
  timestamp?: string;
  time?: string;
  direction?: string;
}

export function useWhatsAppAdaptiveSync() {
  const [isReading, setIsReading] = useState(false);
  const [focusedChat, setFocusedChat] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; newMessages: number } | null>(null);

  const { isAvailable, isAuthenticated, listSidebarChats, readThread, verifySession } = useWhatsAppExtensionBridge();
  const { forceRelearn, isStale: domIsStale, lastLearnedAt } = useWhatsAppDomLearning();
  const queryClient = useQueryClient();

  const readingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => { readingRef.current = isReading; }, [isReading]);

  // ── Load per-contact cursors (latest created_at per contact) ──
  const loadCursors = useCallback(async (userId: string): Promise<Map<string, number>> => {
    return getChannelContactCursors(userId, "whatsapp");
  }, []);

  // ── Save thread messages above cursor ──
  const saveThreadMessages = useCallback(async (
    contact: string,
    messages: ThreadMessage[],
    cursorMs: number,
    userId: string,
    operatorId: string,
  ): Promise<number> => {
    let newCount = 0;
    for (const msg of messages) {
      const rawText = String(msg.text || msg.lastMessage || "").trim();
      if (!rawText) continue;

      const { direction: detectedDir, cleanText } = detectDirection(rawText);
      const finalDirection = (msg.direction as "inbound" | "outbound") || detectedDir;
      const text = cleanText.trim();
      if (!text || text.length < 2) continue;
      const lowerText = text.toLowerCase();
      if (WA_GHOST_BODIES.has(lowerText)) continue;
      if (WA_UI_LABELS.has(contact.toLowerCase())) continue;

      const rawTime = String(msg.timestamp || msg.time || "");
      const parsedIso = parseWhatsAppTimestamp(rawTime);
      const timestamp = parsedIso || new Date().toISOString();
      const ts = new Date(timestamp).getTime();
      // Skip if already on/before cursor (delta semantics)
      if (cursorMs > 0 && ts <= cursorMs) continue;

      const extId = buildDeterministicId("wa", contact, text, rawTime || timestamp);
      const row = {
        user_id: userId,
        operator_id: operatorId,
        channel: "whatsapp",
        direction: finalDirection,
        from_address: finalDirection === "outbound" ? undefined : contact,
        to_address: finalDirection === "outbound" ? contact : undefined,
        body_text: text,
        message_id_external: extId,
        raw_payload: msg as never,
        created_at: timestamp,
      };
      try {
        const { inserted } = await upsertChannelMessageDedup(row as never);
        if (inserted) newCount++;
      } catch (err) {
        log.warn("upsert.failed", { contact, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return newCount;
  }, []);

  // ── The single, unified sync procedure ──
  const syncFromCursor = useCallback(async () => {
    if (readingRef.current) return;
    if (!mountedRef.current) return;

    let guard!: import("@/lib/syncGuard").GuardToken;
    try {
      guard = tryAcquire("whatsapp", "Sincronizza");
    } catch (e) {
      if (e instanceof SyncGuardBusyError) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sync-guard-blocked", { detail: { channel: "whatsapp" } }));
        }
        toast.warning("WhatsApp: un'operazione è già in corso, attendi.");
        return;
      }
      throw e;
    }
    setIsReading(true);
    setProgress(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const userId = session.user.id;

      const { data: opRow } = await supabase
        .from("operators")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      const operatorId = opRow?.id;
      if (!operatorId) {
        toast.error("Nessun operatore associato");
        return;
      }

      // 1. Snapshot sidebar (all chats, no unread filter)
      await throttle("whatsapp", "ping", "Ping estensione");
      const sidebarRes = await listSidebarChats();
      if (!sidebarRes.success) {
        toast.error(`WhatsApp: ${sidebarRes.error || "errore lettura sidebar"}`);
        return;
      }
      const rawChats = ((sidebarRes as Record<string, unknown>).messages || []) as SidebarChat[];
      const seenLower = new Set<string>();
      const chats: SidebarChat[] = [];
      for (const c of rawChats) {
        const name = String(c.contact || "").trim();
        if (!name) continue;
        if (c.isVerify) continue;
        const lower = name.toLowerCase();
        if (WA_UI_LABELS.has(lower)) continue;
        if (seenLower.has(lower)) continue;
        seenLower.add(lower);
        chats.push({ ...c, contact: name });
      }
      if (chats.length === 0) {
        toast.info("Nessuna chat rilevata in WhatsApp Web");
        return;
      }

      // 2. Load cursors
      const cursors = await loadCursors(userId);

      // 3. Decide which chats need a thread read
      const nowMs = Date.now();
      const toRead: Array<{ name: string; cursorMs: number }> = [];
      for (const c of chats) {
        const lower = c.contact.toLowerCase();
        const cursorMs = cursors.get(lower) ?? 0;
        const sidebarTs = c.time ? parseWhatsAppTimestamp(c.time) : null;
        const sidebarMs = sidebarTs ? new Date(sidebarTs).getTime() : nowMs;
        // If we never saw this chat, OR sidebar shows newer activity → read.
        if (cursorMs === 0 || sidebarMs > cursorMs + 60_000) {
          toRead.push({ name: c.contact, cursorMs });
        }
      }

      const focused = focusedChat;
      if (focused && !toRead.some((c) => c.name.toLowerCase() === focused.toLowerCase())) {
        const lower = focused.toLowerCase();
        toRead.unshift({ name: focused, cursorMs: cursors.get(lower) ?? 0 });
      }

      const queue = toRead.slice(0, MAX_THREADS_PER_RUN);
      if (queue.length === 0) {
        toast.success("WhatsApp: già aggiornato");
        return;
      }

      setProgress({ current: 0, total: queue.length, newMessages: 0 });

      // 4. Walk threads sequentially
      let totalNew = 0;
      for (let i = 0; i < queue.length; i++) {
        if (!mountedRef.current) break;
        const { name, cursorMs } = queue[i];
        try {
          await throttle("whatsapp", "open", `Apri chat: ${name}`);
          const threadRes = await readThread(name, MAX_MESSAGES_PER_THREAD);
          if (threadRes.success && Array.isArray(threadRes.messages)) {
            await throttle("whatsapp", "read", `Leggo messaggi: ${name}`);
            const newCount = await saveThreadMessages(
              name,
              threadRes.messages as ThreadMessage[],
              cursorMs,
              userId,
              operatorId,
            );
            totalNew += newCount;
          }
        } catch (err) {
          log.warn("thread_read.failed", { contact: name, error: err instanceof Error ? err.message : String(err) });
          if (isAuthError(err)) {
            await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
            break;
          }
        }
        setProgress({ current: i + 1, total: queue.length, newMessages: totalNew });
        if (i < queue.length - 1) {
          await throttle("whatsapp", "betweenThreads", "Pausa tra chat");
        }
      }

      if (totalNew > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
        queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
        toast.success(`📱 ${totalNew} nuovi messaggi WhatsApp da ${queue.length} chat`);
        window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "whatsapp" } }));
      } else {
        toast.info(`WhatsApp: ${queue.length} chat verificate, nessun nuovo messaggio`);
      }
      window.dispatchEvent(new CustomEvent("wa-sync-completed", {
        detail: { newMessages: totalNew, threads: queue.length, errors: 0 },
      }));
    } catch (err: unknown) {
      log.warn("sync.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
      toast.error(`WhatsApp sync: ${err instanceof Error ? err.message : String(err)}`);
      window.dispatchEvent(new CustomEvent("wa-sync-completed", {
        detail: { newMessages: 0, threads: 0, errors: 1 },
      }));
    } finally {
      if (mountedRef.current) {
        setIsReading(false);
        setProgress(null);
      }
      guard.release();
    }
  }, [listSidebarChats, readThread, loadCursors, saveThreadMessages, queryClient, focusedChat]);

  // ── Single-thread sync (Chat Mode) ──
  const syncSingleThread = useCallback(async (contact: string): Promise<number> => {
    if (!isAvailable || !isAuthenticated) return 0;
    if (readingRef.current) return 0;
    let guard!: import("@/lib/syncGuard").GuardToken;
    try {
      guard = tryAcquire("whatsapp", `Chat: ${contact}`);
    } catch (e) {
      if (e instanceof SyncGuardBusyError) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sync-guard-blocked", { detail: { channel: "whatsapp" } }));
        }
        return 0;
      }
      throw e;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return 0;
      const userId = session.user.id;
      const { data: opRow } = await supabase
        .from("operators")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      const operatorId = opRow?.id;
      if (!operatorId) return 0;

      // Cursor del solo contatto: prendi il created_at più recente in DB.
      const lower = contact.toLowerCase().trim();
      const cursorMs = await getChannelContactCursor(userId, "whatsapp", lower);

      await throttle("whatsapp", "open", `Apri chat: ${contact}`);
      const threadRes = await readThread(contact, 60);
      if (!threadRes.success || !Array.isArray(threadRes.messages)) return 0;
      await throttle("whatsapp", "read", `Leggo messaggi: ${contact}`);
      const newCount = await saveThreadMessages(
        contact,
        threadRes.messages as ThreadMessage[],
        cursorMs,
        userId,
        operatorId,
      );
      if (newCount > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
        queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
        window.dispatchEvent(new CustomEvent("wa-sync-completed", {
          detail: { newMessages: newCount, threads: 1, errors: 0, mode: "chat" },
        }));
      }
      return newCount;
    } catch (err) {
      log.warn("chat_mode.tick.failed", { error: err instanceof Error ? err.message : String(err) });
      if (isAuthError(err)) {
        await markSessionExpired("whatsapp", err instanceof Error ? err.message : String(err));
      }
      return 0;
    } finally {
      guard.release();
    }
  }, [isAvailable, isAuthenticated, readThread, saveThreadMessages, queryClient]);

  const focusOn = useCallback((contact: string | null) => {
    setFocusedChat(contact);
  }, []);

  const readNow = useCallback(async () => {
    if (!isAvailable) {
      toast.error("Estensione WhatsApp non rilevata. Verifica che sia installata e ricarica la pagina.");
      return;
    }
    if (!isAuthenticated) {
      // Try a fresh verifySession before giving up — l'auth heartbeat può essere stantio.
      const v = await verifySession();
      const ok = v.success === true && (v as { authenticated?: boolean }).authenticated === true;
      if (!ok) {
        toast.error("WhatsApp Web non autenticato. Apri web.whatsapp.com e scansiona il QR code.");
        return;
      }
      log.info("verifySession refreshed before sync");
    }
    await syncFromCursor();
  }, [syncFromCursor, isAvailable, isAuthenticated, verifySession]);

  return {
    isReading,
    isAvailable,
    isAuthenticated,
    focusedChat,
    focusOn,
    readNow,
    syncSingleThread,
    progress,
    domIsStale,
    lastLearnedAt,
    forceRelearn,
  };
}
