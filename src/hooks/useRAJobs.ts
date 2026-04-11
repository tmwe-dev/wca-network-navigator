import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { RAScrapingJob } from "@/types/ra";

const RA_JOBS_KEY = ["ra-jobs"] as const;

export function useRAJobs(status?: RAScrapingJob["status"]) {
  return useQuery({
    queryKey: [...RA_JOBS_KEY, status],
    queryFn: async () => {
      let q = untypedFrom("ra_scraping_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (status) q = q.eq("status", status);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as RAScrapingJob[];
    },
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCreateRAJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      job: Pick<
        RAScrapingJob,
        "job_type" | "ateco_codes" | "regions" | "provinces" | "min_fatturato" | "max_fatturato" | "delay_seconds" | "batch_size"
      >
    ) => {
      const { data, error } = await untypedFrom("ra_scraping_jobs")
        .insert({
          ...job,
          status: "pending",
          total_items: 0,
          processed_items: 0,
          saved_items: 0,
          error_count: 0,
        })
        .select()
        .single();
      if (error) throw error;
      return data as RAScrapingJob;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_JOBS_KEY });
    },
  });
}

export function useUpdateRAJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<RAScrapingJob> & { id: string }) => {
      const { error } = await untypedFrom("ra_scraping_jobs")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: RA_JOBS_KEY });
    },
  });
}
