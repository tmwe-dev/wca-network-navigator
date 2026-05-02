/**
 * useCommandJobs — agenda persistente per il Command system.
 *
 * Espone i job aperti dell'operatore (sidebar WorkQueue) con realtime,
 * più helper per creare/aggiornare/riprendere un job e la possibilità
 * di registrare passi (`appendCommandJobStep`).
 *
 * Inspired by swiftpack-studio's `useImportQueue` + `WorkQueueV2` pattern.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isOk } from "@/v2/core/domain/result";
import { queryKeys } from "@/lib/queryKeys";
import { supabase } from "@/integrations/supabase/client";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import {
  fetchOpenCommandJobs,
  fetchCommandJob,
  fetchCommandJobSteps,
  type CommandJob,
  type CommandJobPhase,
  type CommandJobStatus,
} from "@/v2/io/supabase/queries/command-jobs";
import {
  createCommandJob,
  updateCommandJob,
  deleteCommandJob,
  type CreateCommandJobInput,
  type UpdateCommandJobPatch,
} from "@/v2/io/supabase/mutations/command-jobs";

export function useCommandJobs() {
  const { user } = useAuthV2();
  const userId = user?.id ?? null;
  const qc = useQueryClient();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const openJobsQ = useQuery({
    queryKey: queryKeys.commandJobs.open,
    queryFn: async () => {
      const res = await fetchOpenCommandJobs(25);
      return isOk(res) ? res.value : [];
    },
    enabled: !!userId,
    staleTime: 15_000,
  });

  // Realtime subscription so a job created in another tab/loop appears here.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`command-jobs-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "command_jobs" },
        () => {
          qc.invalidateQueries({ queryKey: queryKeys.commandJobs.all });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const openJobs: CommandJob[] = useMemo(
    () => openJobsQ.data ?? [],
    [openJobsQ.data],
  );

  const createJob = useCallback(
    async (input: Omit<CreateCommandJobInput, "user_id"> & { user_id?: string }) => {
      const uid = input.user_id ?? userId;
      if (!uid) return null;
      const res = await createCommandJob({ ...input, user_id: uid });
      if (!isOk(res)) return null;
      qc.invalidateQueries({ queryKey: queryKeys.commandJobs.all });
      return res.value;
    },
    [userId, qc],
  );

  const updateJob = useCallback(
    async (jobId: string, patch: UpdateCommandJobPatch) => {
      const res = await updateCommandJob(jobId, patch);
      if (!isOk(res)) return null;
      qc.invalidateQueries({ queryKey: queryKeys.commandJobs.all });
      qc.invalidateQueries({ queryKey: queryKeys.commandJobs.detail(jobId) });
      return res.value;
    },
    [qc],
  );

  const removeJob = useCallback(
    async (jobId: string) => {
      await deleteCommandJob(jobId);
      qc.invalidateQueries({ queryKey: queryKeys.commandJobs.all });
      if (activeJobId === jobId) setActiveJobId(null);
    },
    [qc, activeJobId],
  );

  const loadJob = useCallback(async (jobId: string) => {
    const res = await fetchCommandJob(jobId);
    if (!isOk(res) || !res.value) return null;
    return res.value;
  }, []);

  const loadJobSteps = useCallback(async (jobId: string) => {
    const res = await fetchCommandJobSteps(jobId);
    return isOk(res) ? res.value : [];
  }, []);

  const markPhase = useCallback(
    async (jobId: string, phase: CommandJobPhase, status?: CommandJobStatus) => {
      return updateJob(jobId, { phase, ...(status ? { status } : {}) });
    },
    [updateJob],
  );

  return {
    openJobs,
    isLoading: openJobsQ.isLoading,
    activeJobId,
    setActiveJobId,
    createJob,
    updateJob,
    removeJob,
    loadJob,
    loadJobSteps,
    markPhase,
    refresh: () => qc.invalidateQueries({ queryKey: queryKeys.commandJobs.all }),
  };
}