import { useMemo } from "react";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";

export interface ActiveProcess {
  id: string;
  type: "download" | "alias" | "deep_search" | "email_queue";
  label: string;
  status: "running" | "pending" | "paused";
  progress?: number; // 0-100
  detail?: string;
}

/**
 * Centralized hook to track all active background processes.
 * Used by the global header indicator.
 */
export function useActiveProcesses() {
  const { data: downloadJobs } = useDownloadJobs();

  const processes = useMemo<ActiveProcess[]>(() => {
    const result: ActiveProcess[] = [];

    // Download jobs
    (downloadJobs || []).forEach((job) => {
      if (job.status === "running" || job.status === "pending" || job.status === "paused") {
        const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
        result.push({
          id: `dl-${job.id}`,
          type: "download",
          label: `Download ${job.country_name}`,
          status: job.status === "paused" ? "paused" : job.status === "running" ? "running" : "pending",
          progress,
          detail: `${job.current_index}/${job.total_count}`,
        });
      }
    });

    return result;
  }, [downloadJobs]);

  const hasActive = processes.length > 0;
  const runningCount = processes.filter((p) => p.status === "running").length;
  const totalCount = processes.length;

  return { processes, hasActive, runningCount, totalCount };
}
