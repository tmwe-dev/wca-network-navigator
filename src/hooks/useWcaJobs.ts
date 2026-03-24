/**
 * useWcaJobs — Hook per gestione job download SERVER-SIDE
 * 🤖 Claude Engine V8 · Worker auto-retrigger su Vercel
 *
 * Usa il sistema job di wca-app: il worker gira server-side,
 * il frontend crea/pausa/riprende job e ne monitora lo stato.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import {
  wcaJobStart,
  wcaJobPause,
  wcaJobResume,
  wcaJobCancel,
  wcaJobStatus,
  wcaWorkerTrigger,
  type WcaJob,
  type JobStartResult,
  type JobStatusResult,
} from "@/lib/api/wcaAppApi";

export interface UseWcaJobsReturn {
  /** Job attivo (o ultimo) */
  job: WcaJob | null;
  /** Polling attivo */
  isPolling: boolean;
  /** Errore ultimo */
  error: string | null;
  /** Avvia download server-side per paesi */
  startJob: (countries: Array<{ code: string; name: string }>, options?: { networks?: string[]; searchTerm?: string; searchBy?: string }) => Promise<string | null>;
  /** Pausa job */
  pauseJob: (jobId: string) => Promise<void>;
  /** Riprendi job */
  resumeJob: (jobId: string) => Promise<void>;
  /** Cancella job */
  cancelJob: (jobId: string) => Promise<void>;
  /** Trigger manuale worker */
  triggerWorker: (jobId?: string) => Promise<void>;
  /** Refresh stato manuale */
  refreshStatus: (jobId?: string) => Promise<void>;
  /** Avvia polling automatico */
  startPolling: (jobId?: string, intervalMs?: number) => void;
  /** Ferma polling */
  stopPolling: () => void;
}

export function useWcaJobs(): UseWcaJobsReturn {
  const [job, setJob] = useState<WcaJob | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobIdRef = useRef<string | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const refreshStatus = useCallback(async (jobId?: string) => {
    try {
      const result = await wcaJobStatus(jobId || jobIdRef.current || undefined);
      if (result.success && result.job) {
        setJob(result.job);
        setError(null);
        // Auto-stop polling se job completato o errore
        if (["completed", "cancelled", "error"].includes(result.job.status)) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
            setIsPolling(false);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore status");
    }
  }, []);

  const startJob = useCallback(async (
    countries: Array<{ code: string; name: string }>,
    options?: { networks?: string[]; searchTerm?: string; searchBy?: string }
  ): Promise<string | null> => {
    try {
      setError(null);
      const result = await wcaJobStart(countries, options);
      if (result.success && result.jobId) {
        jobIdRef.current = result.jobId;
        // Refresh immediato + avvia polling
        await refreshStatus(result.jobId);
        startPolling(result.jobId);
        return result.jobId;
      }
      setError(result.error || "Job start fallito");
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore start");
      return null;
    }
  }, [refreshStatus]);

  const pauseJob = useCallback(async (jobId: string) => {
    try {
      await wcaJobPause(jobId);
      await refreshStatus(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore pausa");
    }
  }, [refreshStatus]);

  const resumeJob = useCallback(async (jobId: string) => {
    try {
      await wcaJobResume(jobId);
      await refreshStatus(jobId);
      startPolling(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore resume");
    }
  }, [refreshStatus]);

  const cancelJob = useCallback(async (jobId: string) => {
    try {
      stopPolling();
      await wcaJobCancel(jobId);
      await refreshStatus(jobId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore cancel");
    }
  }, [refreshStatus]);

  const triggerWorker = useCallback(async (jobId?: string) => {
    try {
      await wcaWorkerTrigger(jobId || jobIdRef.current || undefined);
    } catch (err) {
      console.warn("[WCA-JOBS] Worker trigger error:", err);
    }
  }, []);

  const startPolling = useCallback((jobId?: string, intervalMs = 5000) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (jobId) jobIdRef.current = jobId;
    setIsPolling(true);
    pollingRef.current = setInterval(() => {
      refreshStatus(jobId || jobIdRef.current || undefined);
    }, intervalMs);
  }, [refreshStatus]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setIsPolling(false);
  }, []);

  return {
    job,
    isPolling,
    error,
    startJob,
    pauseJob,
    resumeJob,
    cancelJob,
    triggerWorker,
    refreshStatus,
    startPolling,
    stopPolling,
  };
}
