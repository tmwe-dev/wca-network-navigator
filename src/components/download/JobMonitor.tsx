import { useDownloadJobs, type DownloadJob } from "@/hooks/useDownloadJobs";
import { ActiveJobCard } from "./ActiveJobCard";
import { JobQueue } from "./JobQueue";
import { useTheme, t } from "./theme";
import { Activity } from "lucide-react";

export function JobMonitor() {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: jobs } = useDownloadJobs();
  const allJobs = jobs || [];

  const runningJob = allJobs.find(j => j.status === "running");
  const pendingJob = !runningJob ? allJobs.find(j => j.status === "pending") : null;
  const featuredJob = runningJob || pendingJob;

  const otherJobs = allJobs.filter(j => j.id !== featuredJob?.id);

  if (!featuredJob && otherJobs.length === 0) return null;

  return (
    <div className="space-y-3">
      {featuredJob && (
        <div>
          <p className={`text-sm font-medium mb-2 ${th.h2}`}>
            <Activity className="w-4 h-4 inline mr-1" />
            {featuredJob.status === "running" ? "Job Attivo" : "Prossimo in coda"}
          </p>
          <ActiveJobCard job={featuredJob} />
        </div>
      )}
      <JobQueue jobs={otherJobs} />
    </div>
  );
}
