import { useMemo } from "react";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { AiOperationCard, type AiOperation } from "./AiOperationCard";

/**
 * Renders AiOperationCards with live progress from the database.
 * Merges static operations from AI response with real-time download_jobs data.
 */
export function LiveOperationCards({ operations }: { operations: AiOperation[] }) {
  const { data: jobs = [] } = useDownloadJobs();

  const mergedOps = useMemo(() => {
    return operations.map((op) => {
      if (!op.job_id || op.op_type !== "download") return op;

      const liveJob = jobs.find((j) => j.id === op.job_id);
      if (!liveJob) return op;

      const progress = liveJob.total_count > 0
        ? Math.round((liveJob.current_index / liveJob.total_count) * 100)
        : 0;

      const statusMap: Record<string, AiOperation["status"]> = {
        running: "running",
        pending: "queued",
        paused: "queued",
        completed: "completed",
        failed: "failed",
        cancelled: "failed",
      };

      return {
        ...op,
        status: statusMap[liveJob.status] || op.status,
        progress,
        count: liveJob.total_count,
        detail: liveJob.last_processed_company
          ? `${liveJob.current_index}/${liveJob.total_count} — ${liveJob.last_processed_company}`
          : op.detail,
      } satisfies AiOperation;
    });
  }, [operations, jobs]);

  if (!mergedOps.length) return null;

  return (
    <div className="space-y-1.5">
      {mergedOps.map((op, i) => (
        <AiOperationCard key={`${op.op_type}-${op.job_id || i}`} op={op} />
      ))}
    </div>
  );
}
