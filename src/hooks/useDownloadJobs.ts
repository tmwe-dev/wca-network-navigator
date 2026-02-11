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
