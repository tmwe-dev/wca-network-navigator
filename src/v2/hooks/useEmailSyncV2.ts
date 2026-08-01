/**
 * useEmailSyncV2 — Email sync jobs management
 */
import { useQuery } from "@tanstack/react-query";
import { fetchEmailSyncJobsRaw } from "@/v2/io/supabase/queries/email-sync";
import { queryKeys } from "@/lib/queryKeys";

interface EmailSyncJob {
  readonly id: string;
  readonly status: string;
  readonly downloadedCount: number;
  readonly errorCount: number;
  readonly skippedCount: number;
  readonly totalRemaining: number;
  readonly errorMessage: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
}

export function useEmailSyncV2() {
  return useQuery({
    queryKey: queryKeys.v2.emailSync(),
    queryFn: async (): Promise<readonly EmailSyncJob[]> => {
      const { data, error } = await fetchEmailSyncJobsRaw(20);
      if (error) return [];
      return (data ?? []).map((r) => ({
        id: r.id,
        status: r.status,
        downloadedCount: r.downloaded_count,
        errorCount: r.error_count,
        skippedCount: r.skipped_count,
        totalRemaining: r.total_remaining,
        errorMessage: r.error_message,
        startedAt: r.started_at,
        completedAt: r.completed_at,
      }));
    },
  });
}
