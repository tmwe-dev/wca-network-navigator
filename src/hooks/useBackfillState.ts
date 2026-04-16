/**
 * useBackfillState — Query persistent cursor state for a channel
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type BackfillStateSummary = {
  totalChats: number;
  completedChats: number;
  totalImported: number;
  oldestMessageAt: string | null;
};

export function useBackfillState(channel: "whatsapp" | "linkedin") {
  return useQuery<BackfillStateSummary>({
    queryKey: ["backfill-state", channel],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channel_backfill_state")
        .select("reached_beginning, oldest_message_at, messages_imported")
        .eq("channel", channel);

      if (error || !data?.length) {
        return { totalChats: 0, completedChats: 0, totalImported: 0, oldestMessageAt: null };
      }

      let oldest: string | null = null;
      let totalImported = 0;
      let completed = 0;

      for (const row of data) {
        totalImported += row.messages_imported ?? 0;
        if (row.reached_beginning) completed++;
        if (row.oldest_message_at && (!oldest || row.oldest_message_at < oldest)) {
          oldest = row.oldest_message_at;
        }
      }

      return {
        totalChats: data.length,
        completedChats: completed,
        totalImported,
        oldestMessageAt: oldest,
      };
    },
    refetchInterval: 30_000,
  });
}
