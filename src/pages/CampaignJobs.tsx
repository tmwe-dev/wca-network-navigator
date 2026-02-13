import { useState, useMemo } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobList } from "@/components/campaigns/JobList";
import { JobCanvas } from "@/components/campaigns/JobCanvas";
import { useCampaignJobs, useUpdateCampaignJob } from "@/hooks/useCampaignJobs";
import { toast } from "sonner";

export default function CampaignJobs() {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get("batch");
  const { data: jobs = [] } = useCampaignJobs(batchId);
  const updateJob = useUpdateCampaignJob();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => jobs.find(j => j.id === selectedJobId) || null,
    [jobs, selectedJobId]
  );

  const pendingCount = jobs.filter(j => j.status === "pending" || j.status === "in_progress").length;

  const handleCompleteAll = () => {
    const pending = jobs.filter(j => j.status !== "completed" && j.status !== "skipped");
    Promise.all(
      pending.map(j => updateJob.mutateAsync({ id: j.id, status: "completed", completed_at: new Date().toISOString() }))
    ).then(() => toast.success(`${pending.length} job completati`));
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col -m-6">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-border bg-background flex-shrink-0">
        <Link to="/campaigns">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Campagne
          </Button>
        </Link>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">
          {jobs.length} job · {pendingCount} da fare
        </span>
        {pendingCount > 0 && (
          <Button size="sm" variant="outline" onClick={handleCompleteAll} className="gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Completa tutti
          </Button>
        )}
      </div>

      {/* Two-column layout */}
      <div className="flex-1 flex min-h-0">
        <div className="w-[40%] min-h-0">
          <JobList jobs={jobs} selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
        </div>
        <div className="flex-1 min-h-0">
          <JobCanvas job={selectedJob} />
        </div>
      </div>
    </div>
  );
}
