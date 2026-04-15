/**
 * useDownloadJobs — thin wrapper around DAL with realtime subscription.
 */
import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import {
  findDownloadJobs, updateDownloadJob, deleteJobsByStatus, findJobByCountryAndNetwork,
  insertJobItems, insertJobEvent, findDeadPartnerIds, createDownloadJob,
  invalidateDownloadJobs, updateJobItemsByJobIdAndStatus,
  type DownloadJob,
} from "@/data/downloadJobs";

export type { DownloadJob };

const RT_KEY = '__dlJobsRealtimeState__';
interface RtState { refCount: number; channel: ReturnType<typeof supabase.channel> | null; queryClient: ReturnType<typeof useQueryClient> | null; }
function getRtState(): RtState {
  const w = window as unknown as Record<string, unknown>;
  if (!w[RT_KEY]) w[RT_KEY] = { refCount: 0, channel: null, queryClient: null };
  return w[RT_KEY] as RtState;
}

interface UseDownloadJobsOptions {
  enabled?: boolean;
}

export function useDownloadJobs(options: UseDownloadJobsOptions = {}) {
  const { enabled = true } = options;
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);

  const query = useQuery({
    queryKey: queryKeys.downloads.jobs,
    queryFn: () => findDownloadJobs(50),
    enabled,
  });

  useEffect(() => {
    if (!enabled) return;

    if (mountedRef.current) return;
    mountedRef.current = true;
    const rt = getRtState();
    rt.refCount++;
    rt.queryClient = queryClient;
    if (rt.refCount === 1 && !rt.channel) {
      rt.channel = supabase
        .channel("download-jobs-realtime-singleton")
        .on("postgres_changes", { event: "*", schema: "public", table: "download_jobs" }, () => {
          rt.queryClient?.invalidateQueries({ queryKey: queryKeys.downloads.jobs });
        })
        .subscribe();
    }
    return () => {
      mountedRef.current = false;
      const rtCleanup = getRtState();
      rtCleanup.refCount = Math.max(0, rtCleanup.refCount - 1);
      if (rtCleanup.refCount === 0 && rtCleanup.channel) {
        supabase.removeChannel(rtCleanup.channel);
        rtCleanup.channel = null;
      }
    };
  }, [enabled, queryClient]);

  return query;
}

export function useCreateDownloadJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      country_code: string; country_name: string; network_name: string;
      wca_ids: number[]; delay_seconds: number;
    }) => {
      const deadIds = await findDeadPartnerIds(params.wca_ids);
      const deadSet = new Set(deadIds);
      const filteredIds = params.wca_ids.filter(id => !deadSet.has(id));
      const skippedCount = params.wca_ids.length - filteredIds.length;
      if (skippedCount > 0) toast({ title: "Filtro applicato", description: `${skippedCount} profili non più presenti su WCA esclusi` });
      if (filteredIds.length === 0) {
        toast({ title: "Nessun profilo da scaricare", description: "Tutti i profili risultano già rimossi da WCA", variant: "destructive" });
        return null;
      }

      const existing = await findJobByCountryAndNetwork(params.country_code, params.network_name, ["pending", "running"]);
      if (existing) {
        const ageMs = Date.now() - new Date(existing.updated_at).getTime();
        if (ageMs > 120_000) {
          await updateDownloadJob(existing.id, { status: "stopped", error_message: "Sostituito da nuovo download" });
        } else {
          return existing.id;
        }
      }

      const { data: { user } } = await supabase.auth.getUser();
      const jobId = await createDownloadJob({
        country_code: params.country_code, country_name: params.country_name,
        network_name: params.network_name, wca_ids: filteredIds,
        total_count: filteredIds.length, delay_seconds: params.delay_seconds,
        status: "pending", user_id: user?.id,
      });

      const items = filteredIds.map((id, i) => ({ job_id: jobId, wca_id: id, position: i, status: "pending" }));
      await insertJobItems(items);
      await insertJobEvent({ job_id: jobId, event_type: "job_created", payload: { total: filteredIds.length } });
      return jobId;
    },
    onSuccess: () => { invalidateDownloadJobs(queryClient); toast({ title: "Job avviato", description: "Il download proseguirà in background" }); },
    onError: (err) => { toast({ title: "Errore", description: err.message, variant: "destructive" }); },
  });
}

export function usePauseResumeJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, action }: { jobId: string; action: "pause" | "resume" | "cancel" }) => {
      if (action === "pause") {
        await updateDownloadJob(jobId, { status: "paused" });
      } else if (action === "cancel") {
        await updateDownloadJob(jobId, { status: "cancelled" });
        await updateJobItemsByJobIdAndStatus(jobId, "pending", { status: "cancelled" });
      } else if (action === "resume") {
        await updateJobItemsByJobIdAndStatus(jobId, ["cancelled", "temporary_error"], { status: "pending" });
        await updateDownloadJob(jobId, { status: "pending", error_message: null });
      }
    },
    onSuccess: () => invalidateDownloadJobs(queryClient),
  });
}

export function useUpdateJobSpeed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, delay_seconds }: { jobId: string; delay_seconds: number }) => {
      await updateDownloadJob(jobId, { delay_seconds });
    },
    onSuccess: () => invalidateDownloadJobs(queryClient),
  });
}

export function useDeleteQueuedJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteJobsByStatus(["paused", "pending", "cancelled", "completed"]),
    onSuccess: (count) => {
      invalidateDownloadJobs(queryClient);
      if (count > 0) toast({ title: "🗑️ Eliminati", description: `${count} job rimossi` });
    },
    onError: (err) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });
}

export function usePurgeOldJobs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => deleteJobsByStatus(["cancelled", "completed"]),
    onSuccess: (count) => {
      invalidateDownloadJobs(queryClient);
      if (count > 0) toast({ title: "🧹 Cronologia pulita", description: `${count} job rimossi` });
    },
    onError: (err) => toast({ title: "Errore", description: err.message, variant: "destructive" }),
  });
}
