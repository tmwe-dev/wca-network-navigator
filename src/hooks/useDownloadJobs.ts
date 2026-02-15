import { useEffect, useState } from "react";
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
}

export function useDownloadJobs() {
  const queryClient = useQueryClient();

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

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel("download-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "download_jobs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return query;
}

export function useActiveJobCount() {
  const { data: jobs } = useDownloadJobs();
  return (jobs || []).filter(j => j.status === "running" || j.status === "pending").length;
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
      const { data, error } = await supabase
        .from("download_jobs")
        .insert({
          country_code: params.country_code,
          country_name: params.country_name,
          network_name: params.network_name,
          wca_ids: params.wca_ids as any,
          total_count: params.wca_ids.length,
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
        await supabase.from("download_jobs").update({ status: "running", error_message: null }).eq("id", jobId);
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

export function useResumeAllJobs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data: jobs } = await supabase
        .from("download_jobs")
        .select("id, current_index, total_count")
        .eq("status", "cancelled");

      const incomplete = (jobs || []).filter(j => j.current_index < j.total_count);
      if (incomplete.length === 0) return 0;

      const ids = incomplete.map(j => j.id);
      const { error } = await supabase
        .from("download_jobs")
        .update({ status: "running", error_message: null })
        .in("id", ids);

      if (error) throw error;
      return incomplete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      if (count && count > 0) {
        toast({ title: "▶️ Riavviati", description: `${count} job rimessi in esecuzione` });
      }
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });
}

export function useEmergencyStop() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Get all active jobs
      const { data: activeJobs } = await supabase
        .from("download_jobs")
        .select("id, terminal_log")
        .in("status", ["running", "pending"]);

      if (!activeJobs || activeJobs.length === 0) return 0;

      // Update all to cancelled with EMERGENCY STOP message
      const { error } = await supabase
        .from("download_jobs")
        .update({ status: "cancelled", error_message: "EMERGENCY STOP" })
        .in("status", ["running", "pending"]);

      if (error) throw error;

      // Append emergency stop to terminal logs
      const ts = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      for (const job of activeJobs) {
        const log = [...((job.terminal_log as any[]) || []), { ts, type: "STOP", msg: "🛑 EMERGENCY STOP attivato dall'utente" }].slice(-100);
        await supabase.from("download_jobs").update({ terminal_log: log as any }).eq("id", job.id);
      }

      return activeJobs.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      if (count && count > 0) {
        toast({ title: "🛑 EMERGENCY STOP", description: `${count} job bloccati immediatamente`, variant: "destructive" });
      }
    },
    onError: (err) => {
      toast({ title: "Errore Emergency Stop", description: err.message, variant: "destructive" });
    },
  });
}
