/**
 * Hook for managing server-side email sync jobs.
 * Provides start, pause, resume, and real-time status monitoring.
 */

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import {
  findActiveSyncJob,
  findLastCompletedSyncJob,
  closeOpenSyncJobs,
  createSyncJob,
  updateSyncJobStatus,
} from "@/data/emailSyncJobs";

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
    queryKey: queryKeys.email.syncJob,
    queryFn: async () => {
      return findActiveSyncJob<SyncJob>();
    },
    refetchInterval: 3000, // Poll every 3 seconds
  });

  // Get the last completed job
  const { data: lastCompletedJob } = useQuery({
    queryKey: queryKeys.email.syncJobCompleted,
    queryFn: async () => {
      return findLastCompletedSyncJob<SyncJob>();
    },
  });

  // Realtime subscription for instant updates
  useEffect(() => {
    const channel = supabase
      .channel("email-sync-jobs-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "email_sync_jobs" }, () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.email.syncJob });
        queryClient.invalidateQueries({ queryKey: queryKeys.email.syncJobCompleted });
        queryClient.invalidateQueries({ queryKey: queryKeys.email.count });
      })
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
      await closeOpenSyncJobs(session.user.id);

      // Create new job
      return createSyncJob(session.user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.email.syncJob });
    },
  });

  // Pause the active job
  const pauseJob = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error("Nessun job attivo");
      await updateSyncJobStatus(activeJob.id, { status: "paused" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.email.syncJob });
    },
  });

  // Resume a paused/error job
  const resumeJob = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error("Nessun job da riprendere");
      await updateSyncJobStatus(activeJob.id, { status: "running", error_message: null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.email.syncJob });
    },
  });

  // Cancel and delete the active job
  const cancelJob = useMutation({
    mutationFn: async () => {
      if (!activeJob) throw new Error("Nessun job attivo");
      await updateSyncJobStatus(activeJob.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.email.syncJob });
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
