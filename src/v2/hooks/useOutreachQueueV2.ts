/**
 * useOutreachQueueV2 — Email campaign queue
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchOutreachQueue } from "@/v2/io/supabase/queries/outreach-queue";
import { enqueueOutreach, dequeueOutreach } from "@/v2/io/supabase/mutations/outreach-queue";
import { isOk } from "@/v2/core/domain/result";
import type { OutreachQueueItem } from "@/v2/core/domain/entities";
import type { Database } from "@/integrations/supabase/types";
import { queryKeys } from "@/lib/queryKeys";

export function useOutreachQueueV2(status?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.v2.outreachQueue(status ?? "all"),
    queryFn: async (): Promise<readonly OutreachQueueItem[]> => {
      const result = await fetchOutreachQueue(status);
      return isOk(result) ? result.value : [];
    },
  });

  const enqueueMut = useMutation({
    mutationFn: (items: Database["public"]["Tables"]["email_campaign_queue"]["Insert"][]) =>
      enqueueOutreach(items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.v2.outreachQueue() }),
  });

  const dequeueMut = useMutation({
    mutationFn: (itemId: string) => dequeueOutreach(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.v2.outreachQueue() }),
  });

  return { ...query, enqueue: enqueueMut.mutate, dequeue: dequeueMut.mutate };
}
