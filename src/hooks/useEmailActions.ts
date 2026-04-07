/**
 * Email action hooks: mark as read, unread count, message attachments.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";

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

export function useMessageAttachments(messageId: string | null) {
  return useQuery({
    queryKey: ["email-attachments", messageId],
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
    mutationFn: async (messageId: string) => {
      const { error } = await supabase
        .from("channel_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", messageId);
      if (error) throw error;

      // Fire-and-forget: sync \Seen flag to IMAP server
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      if (projectId) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!session) return;
          fetch(`https://${projectId}.supabase.co/functions/v1/mark-imap-seen`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ message_id: messageId }),
          }).catch((err) => log.warn("mark-imap-seen sync failed", { message: err instanceof Error ? err.message : String(err) }));
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
    },
  });
}
