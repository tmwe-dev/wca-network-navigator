import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { findRAJobs, insertRAJob, updateRAJob, type RAJobDraft } from "@/data/reportAziende";
import type { RAScrapingJob } from "@/types/ra";

const RA_JOBS_KEY = ["ra-jobs"] as const;

export function useRAJobs(status?: RAScrapingJob["status"]) {
  return useQuery({
    queryKey: [...RA_JOBS_KEY, status],
    queryFn: () => findRAJobs(status),
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCreateRAJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (job: RAJobDraft) => insertRAJob(job),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_JOBS_KEY });
    },
  });
}

export function useUpdateRAJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: Partial<RAScrapingJob> & { id: string }) =>
      updateRAJob(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_JOBS_KEY });
    },
  });
}
