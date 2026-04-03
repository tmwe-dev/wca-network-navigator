import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useWhatsAppDomLearning } from "@/hooks/useWhatsAppDomLearning";
import { toast } from "sonner";

// ── Attention Levels ──
// 0 = Idle:          sidebar scan every 60-90s
// 3 = Alert:         sidebar scan every 10-20s (new message detected)
// 6 = Conversation:  thread scan every 3-5s (active reply exchange)
export type AttentionLevel = 0 | 3 | 6;

const INTERVALS: Record<AttentionLevel, number> = {
  0: 75_000,   // ~75s average (60-90)
  3: 15_000,   // ~15s average (10-20)
  6: 4_000,    // ~4s  (3-5)
};

// Jitter ±20% to look human
function jitter(base: number) {
  return base * (0.8 + Math.random() * 0.4);
}

// De-escalation timeouts
const DEESCALATE_6_TO_3 = 60_000;   // 60s no reply → drop from 6 to 3
const DEESCALATE_3_TO_0 = 180_000;  // 3min no new messages → drop to 0

function buildExternalId(contact: string, timestamp: string, text: string): string {
  const safeText = (text || "").slice(0, 50).replace(/[|]/g, "_");
  const safeContact = (contact || "unknown").replace(/[|]/g, "_");
  return `wa_${safeContact}_${timestamp}_${safeText}`;
}

export function useWhatsAppAdaptiveSync() {
  const [level, setLevel] = useState<AttentionLevel>(0);
  const [isReading, setIsReading] = useState(false);
  const [focusedChat, setFocusedChat] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const { isAvailable, readUnread, readThread } = useWhatsAppExtensionBridge();
  const { getSchema, forceRelearn, isStale: domIsStale, lastLearnedAt } = useWhatsAppDomLearning();
  const queryClient = useQueryClient();

  const levelRef = useRef<AttentionLevel>(0);
  const focusedChatRef = useRef<string | null>(null);
  const readingRef = useRef(false);
  const lastNewMsgAt = useRef(0);
  const lastReplyAt = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deescalateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => { levelRef.current = level; }, [level]);
  useEffect(() => { focusedChatRef.current = focusedChat; }, [focusedChat]);
  useEffect(() => { readingRef.current = isReading; }, [isReading]);

  // ── Escalate ──
  const escalate = useCallback((to: AttentionLevel) => {
    setLevel(prev => {
      if (to > prev) return to;
      return prev;
    });
  }, []);

  // ── De-escalate ──
  const deescalate = useCallback((to: AttentionLevel) => {
    setLevel(prev => {
      if (to < prev) return to;
      return prev;
    });
    if (to === 0) setFocusedChat(null);
  }, []);

  // ── Schedule de-escalation ──
  const scheduleDeescalation = useCallback(() => {
    if (deescalateTimerRef.current) clearTimeout(deescalateTimerRef.current);
    
    const currentLevel = levelRef.current;
    if (currentLevel === 0) return;

    const timeout = currentLevel === 6 ? DEESCALATE_6_TO_3 : DEESCALATE_3_TO_0;
    const targetLevel: AttentionLevel = currentLevel === 6 ? 3 : 0;

    deescalateTimerRef.current = setTimeout(() => {
      deescalate(targetLevel);
      // If we dropped to 3, schedule another de-escalation to 0
      if (targetLevel === 3) scheduleDeescalation();
    }, timeout);
  }, [deescalate]);

  // ── Save messages to DB ──
  const saveMessages = useCallback(async (messages: any[], sessionUserId: string) => {
    let newCount = 0;
    let verifyCount = 0;

    for (const msg of messages) {
      const contact = msg.contact || msg.from || "unknown";
      const rawTime = msg.time || msg.timestamp || "";
      const text = msg.lastMessage || msg.text || "";
      const isVerify = msg.isVerify === true;

      let timestamp: string;
      try {
        const parsed = new Date(rawTime);
        timestamp = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
      } catch { timestamp = new Date().toISOString(); }

      const extId = buildExternalId(contact, rawTime || timestamp, text);

      const { error, status } = await supabase
        .from("channel_messages")
        .upsert({
          user_id: sessionUserId,
          channel: "whatsapp",
          direction: msg.direction || "inbound",
          from_address: contact,
          body_text: text,
          message_id_external: extId,
          raw_payload: msg as any,
          created_at: timestamp,
        }, { onConflict: "message_id_external", ignoreDuplicates: true });

      if (!error && status === 201) {
        if (isVerify) verifyCount++;
        else newCount++;
      }
    }
    return { newCount, verifyCount };
  }, []);

  // ── Sidebar scan (Level 0 & 3) ──
  const sidebarScan = useCallback(async () => {
    if (readingRef.current) return;
    setIsReading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const result = await readUnread();
      if (!result.success) return;

      const messages = (result as any).messages || [];
      if (!messages.length) return;

      const { newCount } = await saveMessages(messages, session.user.id);

      if (newCount > 0) {
        lastNewMsgAt.current = Date.now();
        queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
        queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });

        // Escalate: new message → level 3
        if (levelRef.current === 0) {
          escalate(3);
          scheduleDeescalation();
        }

        // If we have a focused chat and it received a new msg → level 6
        if (focusedChatRef.current) {
          const hasReplyInFocused = messages.some(
            (m: any) => (m.contact || m.from || "").toLowerCase() === focusedChatRef.current!.toLowerCase() && !m.isVerify
          );
          if (hasReplyInFocused) {
            lastReplyAt.current = Date.now();
            escalate(6);
            scheduleDeescalation();
          }
        }

        // Auto-focus first unread if none focused
        if (!focusedChatRef.current && levelRef.current >= 3) {
          const firstUnread = messages.find((m: any) => !m.isVerify && (m.unreadCount || 0) > 0);
          if (firstUnread) {
            const contact = firstUnread.contact || firstUnread.from || "unknown";
            setFocusedChat(contact);
          }
        }

        if (newCount > 0) {
          toast.success(`📱 ${newCount} nuovi messaggi WhatsApp`, { duration: 2000 });
        }
      }
    } catch (_) {
    } finally {
      setIsReading(false);
    }
  }, [readUnread, saveMessages, queryClient, escalate, scheduleDeescalation]);

  // ── Thread scan (Level 6) ──
  const threadScan = useCallback(async () => {
    if (readingRef.current || !focusedChatRef.current) return;
    setIsReading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const result = await readThread(focusedChatRef.current, 20);
      if (!result.success) return;

      const messages = (result as any).messages || [];
      if (!messages.length) return;

      const { newCount } = await saveMessages(messages, session.user.id);

      if (newCount > 0) {
        lastReplyAt.current = Date.now();
        queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
        scheduleDeescalation(); // reset de-escalation timer
      }
    } catch (_) {
    } finally {
      setIsReading(false);
    }
  }, [readThread, saveMessages, queryClient, scheduleDeescalation]);

  // ── Main tick ──
  const tick = useCallback(async () => {
    if (levelRef.current === 6 && focusedChatRef.current) {
      await threadScan();
    } else {
      await sidebarScan();
    }
  }, [sidebarScan, threadScan]);

  // ── Adaptive timer ──
  useEffect(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    if (!enabled || !isAvailable) return;

    const schedule = () => {
      const interval = jitter(INTERVALS[level]);
      timerRef.current = setTimeout(async () => {
        await tick();
        schedule(); // re-schedule after tick completes
      }, interval);
    };

    // First tick immediately
    tick().then(() => schedule());

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, isAvailable, level, tick]);

  // Cleanup de-escalation timer
  useEffect(() => {
    return () => {
      if (deescalateTimerRef.current) clearTimeout(deescalateTimerRef.current);
    };
  }, []);

  // ── Manual focus on a chat ──
  const focusOn = useCallback((contact: string) => {
    setFocusedChat(contact);
    escalate(3);
    scheduleDeescalation();
  }, [escalate, scheduleDeescalation]);

  // ── Manual read now ──
  const readNow = useCallback(async () => {
    await sidebarScan();
  }, [sidebarScan]);

  const toggle = useCallback(() => setEnabled(prev => !prev), []);

  const levelLabel = useMemo(() => {
    switch (level) {
      case 0: return "Idle";
      case 3: return "Alert";
      case 6: return "Live";
    }
  }, [level]);

  return {
    level,
    levelLabel,
    enabled,
    toggle,
    setEnabled,
    isReading,
    isAvailable,
    focusedChat,
    focusOn,
    readNow,
    domIsStale,
    lastLearnedAt,
    forceRelearn,
  };
}
