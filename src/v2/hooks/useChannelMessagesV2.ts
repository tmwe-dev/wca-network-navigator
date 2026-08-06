/**
 * useChannelMessagesV2 — Channel messages (email, whatsapp, linkedin)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchChannelMessages, fetchChannelMessagesFromView } from "@/v2/io/supabase/queries/channel-messages";
import { markMessageRead } from "@/v2/io/supabase/mutations/channel-messages";
import { isOk } from "@/v2/core/domain/result";
import type { ChannelMessage } from "@/v2/core/domain/entities";
import { queryKeys } from "@/lib/queryKeys";
import { createLogger } from "@/lib/log";

const log = createLogger("useChannelMessagesV2");

export function useChannelMessagesV2(direction?: string, limit = 100) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.v2.channelMessages(direction ?? "all", limit),
    queryFn: async (): Promise<readonly ChannelMessage[]> => {
      // B4.1 — primaria: view canonica `message_intelligence_v`.
      // Fallback trasparente su `channel_messages` in caso di errore.
      const viewResult = await fetchChannelMessagesFromView(limit, direction);
      if (isOk(viewResult)) return viewResult.value;
      log.warn("channel_messages_view_fallback", {
        reason: viewResult.error.code,
        direction: direction ?? "all",
        limit,
      });
      const legacy = await fetchChannelMessages(limit, direction);
      return isOk(legacy) ? legacy.value : [];
    },
  });

  const markReadMut = useMutation({
    mutationFn: (messageId: string) => markMessageRead(messageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.v2.channelMessages() }),
  });

  return { ...query, markRead: markReadMut.mutate };
}
