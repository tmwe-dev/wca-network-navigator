/**
 * Email action hooks: mark as read, unread count, message attachments.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";
import { queryKeys } from "@/lib/queryKeys";

const log = createLogger("useEmailActions");

export type EmailAttachment = {
  id: string;
  message_id: string;
  filename: string;
  content_type: string | null;
  size_bytes: number | null;
  storage_path: string;
  content_id: string | null;
  is_inline: boolean;
};

type MarkAsReadInput = {
  id: string;
  channel?: string | null;
  user_id?: string | null;
};

export function useMessageAttachments(messageId: string | null) {
  return useQuery({
    queryKey: queryKeys.email.attachments(messageId),
    queryFn: async () => {
      if (!messageId) return [];
      const { data, error } = await supabase
        .from("email_attachments")
        .select("id, message_id, filename, content_type, size_bytes, storage_path, content_id, is_inline")
        .eq("message_id", messageId);
      if (error) throw error;
      return (data || []) as EmailAttachment[];
    },
    enabled: !!messageId,
  });
}

export function useUnreadCount(channel?: string) {
  return useQuery({
    queryKey: ["channel-messages-unread", channel],
    queryFn: async () => {
      let q = supabase
        .from("channel_messages")
        .select("id", { count: "planned", head: true })
        .eq("direction", "inbound")
        .is("read_at", null);
      if (channel) q = q.eq("channel", channel);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: string | MarkAsReadInput) => {
      const messageId = typeof input === "string" ? input : input.id;
      const messageChannel = typeof input === "string" ? null : (input.channel ?? null);
      const messageUserId = typeof input === "string" ? null : (input.user_id ?? null);

      const { data: updatedMessage, error } = await supabase
        .from("channel_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", messageId)
        .select("id, channel, user_id")
        .maybeSingle();

      if (error) throw error;
      if (!updatedMessage) {
        log.warn("mark-as-read skipped: message not writable", {
          messageId,
          channel: messageChannel,
          userId: messageUserId,
        });
        return;
      }

      const resolvedChannel = messageChannel ?? updatedMessage.channel ?? null;
      const resolvedUserId = messageUserId ?? updatedMessage.user_id ?? null;

      if (resolvedChannel !== "email") return;

      // Fire-and-forget: sync \Seen flag to IMAP server
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (supabaseUrl) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return;
          if (resolvedUserId && resolvedUserId !== session.user.id) return;

          void fetch(`${supabaseUrl}/functions/v1/mark-imap-seen`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ message_id: messageId }),
          })
            .then(async (response) => {
              if (response.ok) return;
              const body = await response.text().catch(() => "");
              log.warn("mark-imap-seen sync failed", {
                messageId,
                status: response.status,
                body: body || undefined,
              });
            })
            .catch((err) => log.warn("mark-imap-seen sync failed", {
              messageId,
              message: err instanceof Error ? err.message : String(err),
            }));
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.unread });
    },
  });
}
