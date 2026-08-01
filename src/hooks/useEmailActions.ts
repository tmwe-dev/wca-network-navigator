/**
 * Email action hooks: mark as read, unread count, message attachments.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";
import { queryKeys } from "@/lib/queryKeys";
import {
  countUnreadInbound,
  markChannelMessageRead,
  findAttachmentsByMessage,
} from "@/data/channelMessages";

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
  mailbox_id?: string | null;
};

export function useMessageAttachments(messageId: string | null) {
  return useQuery({
    queryKey: queryKeys.email.attachments(messageId),
    queryFn: async () => {
      if (!messageId) return [];
      return (await findAttachmentsByMessage(messageId)) as EmailAttachment[];
    },
    enabled: !!messageId,
  });
}

export type MailboxFilter =
  | { kind: "personal" }
  | { kind: "shared"; id: string }
  | null
  | undefined;

function mailboxKeyOf(mb: MailboxFilter): string | undefined {
  if (!mb) return undefined;
  return mb.kind === "shared" ? `shared:${mb.id}` : "personal";
}

export function useUnreadCount(channel?: string, mailboxFilter?: MailboxFilter) {
  const mailboxKey = mailboxKeyOf(mailboxFilter);
  return useQuery({
    queryKey: queryKeys.channelMessages.unread(channel, undefined, mailboxKey),
    queryFn: async () => {
      return await countUnreadInbound({ channel, mailbox: mailboxFilter ?? null });
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
      const messageMailboxId = typeof input === "string" ? null : (input.mailbox_id ?? null);

      const updatedMessage = await markChannelMessageRead(messageId);
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
      const resolvedMailboxId =
        messageMailboxId ?? (updatedMessage as { mailbox_id?: string | null }).mailbox_id ?? null;

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
              ...(resolvedMailboxId ? { "x-mailbox-id": resolvedMailboxId } : {}),
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
      queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
      queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
    },
  });
}
