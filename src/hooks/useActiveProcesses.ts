import { useMemo, useContext, useState, useEffect, useRef } from "react";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DeepSearchContext } from "@/hooks/useDeepSearchRunner";

export interface ActiveProcess {
  id: string;
  type: "download" | "alias" | "deep_search" | "email_queue";
  label: string;
  status: "running" | "pending" | "paused";
  progress?: number; // 0-100
  detail?: string;
  errorMessage?: string;
  countdownLabel?: string;
}

/**
 * Centralized hook to track all active background processes.
 * Sources: download jobs, deep search, email queue.
 */
export function useActiveProcesses() {
  const { data: downloadJobs } = useDownloadJobs();
  const deepSearch = useContext(DeepSearchContext);
  const [countdowns, setCountdowns] = useState<Record<string, { seconds: number; type: string; at: number }>>({});
  const countdownTimers = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // Subscribe to countdown events via realtime
  useEffect(() => {
    const channel = supabase
      .channel("countdown-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "download_job_events", filter: "event_type=eq.countdown" },
        (payload) => {
          const row = payload.new as Record<string, unknown>;
          const jobId = row.job_id as string;
          const rowPayload = row.payload as Record<string, unknown> | null;
          const secs = (rowPayload?.seconds as number) || 0;
          const type = (rowPayload?.type as string) || "delay";
          
          setCountdowns((prev) => ({ ...prev, [jobId]: { seconds: secs, type, at: Date.now() } }));
          
          // Clear previous timer
          if (countdownTimers.current[jobId]) clearInterval(countdownTimers.current[jobId]);
          
          // Tick down every second
          let remaining = secs;
          countdownTimers.current[jobId] = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
              clearInterval(countdownTimers.current[jobId]);
              delete countdownTimers.current[jobId];
              setCountdowns((prev) => {
                const next = { ...prev };
                delete next[jobId];
                return next;
              });
            } else {
              setCountdowns((prev) => ({
                ...prev,
                [jobId]: { seconds: remaining, type, at: prev[jobId]?.at || Date.now() },
              }));
            }
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      Object.values(countdownTimers.current).forEach(clearInterval);
    };
  }, []);

  // Global email queue count (pending + sending)
  const { data: emailQueueCounts } = useQuery({
    queryKey: ["email-queue-global-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaign_queue")
        .select("status", { count: "exact", head: false })
        .in("status", ["pending", "sending"]);
      if (error) return { pending: 0, sending: 0, total: 0 };
      const pending = (data || []).filter((r) => r.status === "pending").length;
      const sending = (data || []).filter((r) => r.status === "sending").length;
      return { pending, sending, total: pending + sending };
    },
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const processes = useMemo<ActiveProcess[]>(() => {
    const result: ActiveProcess[] = [];

    // Deep Search
    if (deepSearch?.running && deepSearch.current) {
      const { index, total } = deepSearch.current;
      const progress = total > 0 ? Math.round((index / total) * 100) : 0;
      result.push({
        id: "deep-search",
        type: "deep_search",
        label: `Deep Search: ${deepSearch.current.companyName}`,
        status: "running",
        progress,
        detail: `${index}/${total}`,
      });
    }

    // Download jobs
    (downloadJobs || []).forEach((job) => {
      if (job.status === "running" || job.status === "pending" || job.status === "paused") {
        const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
        const cd = countdowns[job.id];
        const countdownLabel = cd ? `⏱ ${cd.seconds}s ${cd.type === "batch" ? "(pausa batch)" : ""}` : undefined;
        result.push({
          id: `dl-${job.id}`,
          type: "download",
          label: `Download ${job.country_name}`,
          status: job.status === "paused" ? "paused" : job.status === "running" ? "running" : "pending",
          progress,
          detail: `${job.current_index}/${job.total_count}`,
          errorMessage: job.error_message || undefined,
          countdownLabel,
        });
      }
    });

    // Email queue
    if (emailQueueCounts && emailQueueCounts.total > 0) {
      result.push({
        id: "email-queue",
        type: "email_queue",
        label: `Email in coda`,
        status: emailQueueCounts.sending > 0 ? "running" : "pending",
        detail: `${emailQueueCounts.sending} invio / ${emailQueueCounts.pending} attesa`,
      });
    }

    return result;
  }, [downloadJobs, deepSearch?.running, deepSearch?.current, emailQueueCounts, countdowns]);

  const hasActive = processes.length > 0;
  const runningCount = processes.filter((p) => p.status === "running").length;
  const totalCount = processes.length;

  // Overall progress (average of processes with progress)
  const overallProgress = useMemo(() => {
    const withProgress = processes.filter((p) => p.progress !== undefined);
    if (withProgress.length === 0) return undefined;
    return Math.round(withProgress.reduce((sum, p) => sum + (p.progress || 0), 0) / withProgress.length);
  }, [processes]);

  return { processes, hasActive, runningCount, totalCount, overallProgress };
}
