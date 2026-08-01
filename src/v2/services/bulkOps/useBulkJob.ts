/**
 * Hook React per leggere lo stato di un job bulk (polling 2s).
 */
import { useQuery } from "@tanstack/react-query";
import { getBulkJob, type BulkJobRow } from "@/data/bulkJobs";

export function useBulkJob(jobId: string | null | undefined) {
  return useQuery<BulkJobRow | null>({
    queryKey: ["bulkOps", "job", jobId ?? "none"],
    queryFn: () => (jobId ? getBulkJob(jobId) : Promise.resolve(null)),
    enabled: !!jobId,
    refetchInterval: 2000,
  });
}