import { useState, useMemo, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JobList } from "@/components/campaigns/JobList";
import { JobCanvas } from "@/components/campaigns/JobCanvas";
import { useCampaignJobs, useUpdateCampaignJob } from "@/hooks/useCampaignJobs";
import { useContactsForPartners } from "@/hooks/useActivities";
import { toast } from "sonner";

export default function CampaignJobs() {
  const [searchParams] = useSearchParams();
  const batchId = searchParams.get("batch");
  const { data: jobs = [] } = useCampaignJobs(batchId);
  const updateJob = useUpdateCampaignJob();

  // Focus: which contact row was clicked (shows details in canvas)
  const [focusedContactId, setFocusedContactId] = useState<string | null>(null);
  // Bulk selection: checked contacts across all companies
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());

  // Collect unique partner IDs for contacts query
  const partnerIds = useMemo(() => [...new Set(jobs.map(j => j.partner_id))], [jobs]);
  const { data: contactsByPartner = {} } = useContactsForPartners(partnerIds);

  // All contacts flat
  const allContacts = useMemo(() => Object.values(contactsByPartner).flat(), [contactsByPartner]);

  // Find the job for a focused contact
  const focusedContact = useMemo(
    () => allContacts.find(c => c.id === focusedContactId) || null,
    [allContacts, focusedContactId]
  );
  const focusedJob = useMemo(
    () => (focusedContact ? jobs.find(j => j.partner_id === focusedContact.partner_id) : null) || null,
    [focusedContact, jobs]
  );
  const focusedJobContacts = focusedJob
    ? (contactsByPartner[focusedJob.partner_id] || [])
    : [];

  const pendingCount = jobs.filter(j => j.status === "pending" || j.status === "in_progress").length;

  // Selection handlers
  const toggleContact = useCallback((contactId: string) => {
    setSelectedContactIds(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedContactIds(new Set(allContacts.map(c => c.id)));
  }, [allContacts]);

  const selectAllWithEmail = useCallback(() => {
    setSelectedContactIds(new Set(allContacts.filter(c => c.email).map(c => c.id)));
  }, [allContacts]);

  const selectAllWithPhone = useCallback(() => {
    setSelectedContactIds(new Set(allContacts.filter(c => c.direct_phone || c.mobile).map(c => c.id)));
  }, [allContacts]);

  const deselectAll = useCallback(() => {
    setSelectedContactIds(new Set());
  }, []);

  // Bulk actions: find jobs for selected contacts
  const getJobsForSelectedContacts = useCallback(() => {
    const partnerIdsFromContacts = new Set(
      allContacts.filter(c => selectedContactIds.has(c.id)).map(c => c.partner_id)
    );
    return jobs.filter(j => partnerIdsFromContacts.has(j.partner_id));
  }, [allContacts, selectedContactIds, jobs]);

  const handleBulkSetType = useCallback(async (type: "email" | "call") => {
    const targetJobs = getJobsForSelectedContacts();
    await Promise.all(
      targetJobs.map(j => updateJob.mutateAsync({ id: j.id, job_type: type }))
    );
    toast.success(`${targetJobs.length} job impostati come ${type}`);
  }, [getJobsForSelectedContacts, updateJob]);

  const handleBulkComplete = useCallback(async () => {
    const targetJobs = getJobsForSelectedContacts().filter(j => j.status !== "completed" && j.status !== "skipped");
    await Promise.all(
      targetJobs.map(j => updateJob.mutateAsync({ id: j.id, status: "completed", completed_at: new Date().toISOString() }))
    );
    toast.success(`${targetJobs.length} job completati`);
  }, [getJobsForSelectedContacts, updateJob]);

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
          <JobList
            jobs={jobs}
            contactsByPartner={contactsByPartner}
            focusedContactId={focusedContactId}
            onFocusContact={setFocusedContactId}
            selectedContactIds={selectedContactIds}
            onToggleContact={toggleContact}
            onSelectAll={selectAll}
            onSelectAllWithEmail={selectAllWithEmail}
            onSelectAllWithPhone={selectAllWithPhone}
            onDeselectAll={deselectAll}
            totalContacts={allContacts.length}
          />
        </div>
        <div className="flex-1 min-h-0">
          <JobCanvas
            job={focusedJob}
            contacts={focusedJobContacts}
            focusedContactId={focusedContactId}
            selectedContactIds={selectedContactIds}
            onBulkSetType={handleBulkSetType}
            onBulkComplete={handleBulkComplete}
          />
        </div>
      </div>
    </div>
  );
}
