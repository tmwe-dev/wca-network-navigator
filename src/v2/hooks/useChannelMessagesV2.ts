/**
 * useChannelMessagesV2 — Channel messages (email, whatsapp, linkedin)
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchChannelMessages } from "@/v2/io/supabase/queries/channel-messages";
import { markMessageRead } from "@/v2/io/supabase/mutations/channel-messages";
import { isOk } from "@/v2/core/domain/result";
import type { ChannelMessage } from "@/v2/core/domain/entities";

export function useChannelMessagesV2(direction?: string, limit = 100) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["v2", "channel-messages", direction ?? "all", limit],
    queryFn: async (): Promise<readonly ChannelMessage[]> => {
      const result = await fetchChannelMessages(limit, direction);
      return isOk(result) ? result.value : [];
    },
  });

  const markReadMut = useMutation({
    mutationFn: (messageId: string) => markMessageRead(messageId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["v2", "channel-messages"] }),
  });

  return { ...query, markRead: markReadMut.mutate };
}
