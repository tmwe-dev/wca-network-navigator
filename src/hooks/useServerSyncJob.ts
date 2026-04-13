/**
 * Hook for managing server-side email sync jobs.
 * Provides start, pause, resume, and real-time status monitoring.
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SyncJobStatus = "running" | "paused" | "completed" | "error";

export interface SyncJob {
  id: string;
  user_id: string;
  status: SyncJobStatus;
  downloaded_count: number;
  skipped_count: number;
  total_remaining: number;
  last_batch_at: string | null;
  error_message: string | null;
  error_count: number;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

export function useServerSyncJob() {
  const queryClient = useQueryClient();

  // Get the current active job (most recent non-completed)
  const { data: activeJob, isLoading } = useQuery({
    queryKey: ["email-sync-job"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sync_jobs")
        .select("*")
        .in("status", ["running", "paused", "error"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as SyncJob) || null;
    },
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Get the last completed job
  const { data: lastCompletedJob } = useQuery({
    queryKey: ["email-sync-job-completed"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sync_jobs")
        .select("*")
        .eq("status", "completed")
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return (data as SyncJob) || null;
    },
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel("email-sync-jobs-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "email_sync_jobs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["email-sync-job"] });
          queryClient.invalidateQueries({ queryKey: ["email-sync-job-completed"] });
          queryClient.invalidateQueries({ queryKey: ["email-count"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Start a new sync job
  const startJob = useMutation({
    mutationFn: async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Non autenticato");

      // Cancel any existing running/paused jobs
      await supabase
        .from("email_sync_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("user_id", session.user.id)
        .in("status", ["running", "paused"]);

      // Create new job
      const { data, error } = await supabase
        .from("email_sync_jobs")
        .insert({ user_id: session.user.id, status: "running" })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-sync-job"] });
    },
  });

  // Pause the active job
  const pauseJob = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error("Nessun job attivo");
      const { error } = await supabase
        .from("email_sync_jobs")
        .update({ status: "paused" })
        .eq("id", activeJob.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-sync-job"] });
    },
  });

  // Resume a paused/error job
  const resumeJob = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error("Nessun job da riprendere");
      const { error } = await supabase
        .from("email_sync_jobs")
        .update({ status: "running", error_message: null })
        .eq("id", activeJob.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-sync-job"] });
    },
  });

  // Cancel and delete the active job
  const cancelJob = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error("Nessun job attivo");
      const { error } = await supabase
        .from("email_sync_jobs")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", activeJob.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-sync-job"] });
    },
  });

  return {
    activeJob: activeJob ?? null,
    lastCompletedJob: lastCompletedJob ?? null,
    isLoading,
    startJob,
    pauseJob,
    resumeJob,
    cancelJob,
  };
}
