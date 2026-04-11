/**
 * Campaign Domain Rules — STEP 8
 * Pure business logic for campaign evaluation.
 */

import type { CampaignJob, CampaignJobStatus } from "../entities";

/** Counts jobs by status */
export function jobStatusCounts(
  jobs: readonly CampaignJob[],
): Readonly<Record<CampaignJobStatus, number>> {
  const counts: Record<CampaignJobStatus, number> = {
    pending: 0,
    in_progress: 0,
    completed: 0,
    skipped: 0,
  };
  for (const job of jobs) {
    counts[job.status] = (counts[job.status] ?? 0) + 1;
  }
  return counts;
}

/** Campaign completion percentage */
export function campaignCompletionPercent(jobs: readonly CampaignJob[]): number {
  if (jobs.length === 0) return 0;
  const done = jobs.filter((j) => j.status === "completed" || j.status === "skipped").length;
  return Math.round((done / jobs.length) * 100);
}

/** Whether campaign has remaining work */
export function hasRemainingWork(jobs: readonly CampaignJob[]): boolean {
  return jobs.some((j) => j.status === "pending" || j.status === "in_progress");
}
