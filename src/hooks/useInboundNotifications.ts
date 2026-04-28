/**
 * Real-time inbound email notifications hook
 * LOVABLE-93: notifiche real-time email inbound
 *
 * Subscribes to Supabase Realtime for INSERT events on channel_messages table.
 * Filters for inbound emails and shows toast notifications with sender/subject.
 * Maintains an unread count and provides markAsRead functionality.
 */

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("useInboundNotifications");

export type InboundNotificationMessage = {
  id: string;
  from_address: string | null;
  subject: string | null;
  created_at: string;
  channel: string;
  direction: string;
};

interface InboundNotificationsState {
  unreadCount: number;
  latestInbound: InboundNotificationMessage | null;
}

/**
 * Hook for real-time inbound email notifications.
 * Subscribes to channel_messages table for new inbound emails.
 * Shows toast notifications and tracks unread count.
 */
export function useInboundNotifications() {
  const queryClient = useQueryClient();
  const [state, setState] = useState<InboundNotificationsState>({
    unreadCount: 0,
    latestInbound: null,
  });
  const subscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const shownIdsRef = useRef<Set<string>>(new Set());

  // Initialize: fetch initial unread count
  useEffect(() => {
    const fetchInitialCount = async () => {
      try {
        const { count, error } = await supabase
          .from("channel_messages")
          .select("id", { count: "planned", head: true })
          .eq("direction", "inbound")
          .eq("channel", "email")
          .is("read_at", null);

        if (error) {
          log.warn("failed to fetch initial unread count", { error: error.message });
          return;
        }

        setState((prev) => ({
          ...prev,
          unreadCount: count || 0,
        }));
      } catch (err) {
        log.warn("error fetching initial unread count", {
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };

    fetchInitialCount();
  }, []);

  // Realtime subscription for new inbound emails
  useEffect(() => {
    const channelName = "channel_messages_inbound_notifications";

    const sub = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "channel_messages",
          filter: "direction=eq.inbound",
        },
        (payload) => {
          const newMessage = payload.new as { id: string; channel?: string; subject?: string; body_text?: string | null; sender_email?: string | null; sender_name?: string | null };

          // Filter for email channel only
          if (newMessage.channel !== "email") {
            return;
          }

          // Avoid duplicate notifications (e.g., race conditions during sync)
          if (shownIdsRef.current.has(newMessage.id)) {
            return;
          }
          shownIdsRef.current.add(newMessage.id);

          // Increment unread count
          setState((prev) => ({
            ...prev,
            unreadCount: prev.unreadCount + 1,
            latestInbound: {
              id: newMessage.id,
              from_address: newMessage.from_address,
              subject: newMessage.subject,
              created_at: newMessage.created_at,
              channel: newMessage.channel,
              direction: newMessage.direction,
            },
          }));

          // Show toast notification
          const sender = newMessage.from_address || "Mittente sconosciuto";
          const subject = newMessage.subject || "(nessun oggetto)";
          const displaySubject = subject.length > 50 ? subject.substring(0, 47) + "..." : subject;

          toast({
            title: "Nuovo messaggio email",
            description: `Da: ${sender}\n${displaySubject}`,
          });

          log.debug("inbound email notification shown", {
            id: newMessage.id,
            from: sender,
            subject: subject,
          });

          // Invalidate unread count queries
          queryClient.invalidateQueries({ queryKey: queryKeys.email.count });
          queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.unread("email") });
        }
      )
      .subscribe((status) => {
        if (status === "CLOSED") {
          log.debug("realtime subscription closed");
        } else if (status === "CHANNEL_ERROR") {
          log.warn("realtime subscription error");
        }
      });

    subscriptionRef.current = sub;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [queryClient]);

  const markAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("channel_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", messageId);

      if (error) throw error;

      // Decrement unread count if it was unread
      setState((prev) => ({
        ...prev,
        unreadCount: Math.max(0, prev.unreadCount - 1),
      }));

      // Invalidate cache
      queryClient.invalidateQueries({ queryKey: queryKeys.email.count });
      queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.unread("email") });

      log.debug("message marked as read", { messageId });
    } catch (err) {
      log.warn("failed to mark message as read", {
        messageId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return {
    unreadCount: state.unreadCount,
    latestInbound: state.latestInbound,
    markAsRead,
  };
}
