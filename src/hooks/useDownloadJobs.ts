import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface DownloadJob {
  id: string;
  country_code: string;
  country_name: string;
  network_name: string;
  status: string;
  job_type: string;
  wca_ids: number[];
  processed_ids: number[];
  current_index: number;
  total_count: number;
  delay_seconds: number;
  last_processed_wca_id: number | null;
  last_processed_company: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  contacts_found_count: number;
  contacts_missing_count: number;
  last_contact_result: string | null;
  failed_ids: number[];
}

/**
 * Singleton realtime subscription manager.
 */
const RT_KEY = '__dlJobsRealtimeState__';

interface RtState {
  refCount: number;
  channel: ReturnType<typeof supabase.channel> | null;
  queryClient: ReturnType<typeof useQueryClient> | null;
}

function getRtState(): RtState {
  if (!(window as any)[RT_KEY]) {
    (window as any)[RT_KEY] = { refCount: 0, channel: null, queryClient: null };
  }
  return (window as any)[RT_KEY];
}

export function useDownloadJobs() {
  const queryClient = useQueryClient();
  const mountedRef = useRef(false);

  const query = useQuery({
    queryKey: ["download-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("download_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as DownloadJob[];
    },
  });

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;

    const rt = getRtState();
    rt.refCount++;
    rt.queryClient = queryClient;

    if (rt.refCount === 1 && !rt.channel) {
      rt.channel = supabase
        .channel("download-jobs-realtime-singleton")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "download_jobs" },
          () => {
            rt.queryClient?.invalidateQueries({ queryKey: ["download-jobs"] });
          }
        )
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
  }, [queryClient]);

  return query;
}

export function useCreateDownloadJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      country_code: string;
      country_name: string;
      network_name: string;
      wca_ids: number[];
      delay_seconds: number;
    }) => {
      // ── Filter out WCA IDs already confirmed as non-existent ──
      const { data: deadIds } = await supabase
        .from("partners_no_contacts")
        .select("wca_id")
        .in("wca_id", params.wca_ids)
        .eq("resolved", false);

      const deadSet = new Set((deadIds || []).map(r => r.wca_id));
      const filteredIds = params.wca_ids.filter(id => !deadSet.has(id));
      const skippedCount = params.wca_ids.length - filteredIds.length;

      if (skippedCount > 0) {
        
        toast({ title: "Filtro applicato", description: `${skippedCount} profili non più presenti su WCA esclusi` });
      }

      if (filteredIds.length === 0) {
        toast({ title: "Nessun profilo da scaricare", description: "Tutti i profili risultano già rimossi da WCA", variant: "destructive" });
        return null;
      }

      // Guard anti-duplicato
      const { data: existing } = await supabase
        .from("download_jobs")
        .select("id")
        .eq("country_code", params.country_code)
        .eq("network_name", params.network_name)
        .in("status", ["pending", "running"])
        .limit(1);

      if (existing && existing.length > 0) {
        
        return existing[0].id;
      }

      const { data, error } = await supabase
        .from("download_jobs")
        .insert({
          country_code: params.country_code,
          country_name: params.country_name,
          network_name: params.network_name,
          wca_ids: filteredIds as any,
          total_count: filteredIds.length,
          delay_seconds: params.delay_seconds,
          status: "pending",
        })
        .select("id")
        .single();

      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      toast({ title: "Job avviato", description: "Il download proseguirà in background" });
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });
}

export function usePauseResumeJob() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, action }: { jobId: string; action: "pause" | "resume" | "cancel" }) => {
      if (action === "pause") {
        await supabase.from("download_jobs").update({ status: "paused" }).eq("id", jobId);
      } else if (action === "cancel") {
        await supabase.from("download_jobs").update({ status: "cancelled" }).eq("id", jobId);
      } else if (action === "resume") {
        await supabase.from("download_jobs").update({ status: "pending", error_message: null }).eq("id", jobId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
    },
  });
}

export function useUpdateJobSpeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ jobId, delay_seconds }: { jobId: string; delay_seconds: number }) => {
      const { error } = await supabase
        .from("download_jobs")
        .update({ delay_seconds })
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
    },
  });
}

export function useDeleteQueuedJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: jobs } = await supabase
        .from("download_jobs")
        .select("id")
        .in("status", ["paused", "pending", "cancelled", "completed"]);

      if (!jobs || jobs.length === 0) return 0;

      const { error } = await supabase
        .from("download_jobs")
        .delete()
        .in("status", ["paused", "pending", "cancelled", "completed"]);

      if (error) throw error;
      return jobs.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      if (count && count > 0) {
        toast({ title: "🗑️ Eliminati", description: `${count} job rimossi` });
      }
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });
}

export function usePurgeOldJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await supabase
        .from("download_jobs")
        .select("id")
        .in("status", ["cancelled", "completed"]);
      if (!data || data.length === 0) return 0;
      const { error } = await supabase
        .from("download_jobs")
        .delete()
        .in("status", ["cancelled", "completed"]);
      if (error) throw error;
      return data.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      if (count && count > 0) {
        toast({ title: "🧹 Cronologia pulita", description: `${count} job rimossi` });
      }
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });
}
