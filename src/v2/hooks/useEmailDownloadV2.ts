/**
 * useEmailDownloadV2 — Email download/sync job management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { queryKeys } from "@/lib/queryKeys";

interface EmailDownloadJob {
  readonly id: string;
  readonly status: string;
  readonly downloadedCount: number;
  readonly errorCount: number;
  readonly totalRemaining: number;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export function useEmailDownloadV2() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.v2.emailDownload(),
    queryFn: async (): Promise<readonly EmailDownloadJob[]> => {
      const { data, error } = await supabase
        .from("email_sync_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        downloadedCount: r.downloaded_count,
        errorCount: r.error_count,
        totalRemaining: r.total_remaining,
        startedAt: r.started_at,
        completedAt: r.completed_at,
      }));
    },
    refetchInterval: 5000,
  });

  const startSync = useMutation({
    mutationFn: () => invokeEdge("sync-emails", { context: "emailDownloadV2" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.v2.emailDownload() }),
  });

  return { ...query, startSync: startSync.mutate, isSyncing: startSync.isPending };
}
