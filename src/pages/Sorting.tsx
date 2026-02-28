import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Send, X, Loader2 } from "lucide-react";
import { SortingList } from "@/components/sorting/SortingList";
import { SortingCanvas } from "@/components/sorting/SortingCanvas";
import { useSortingJobs, useBulkReview, useCancelJobs, useSendJob } from "@/hooks/useSortingJobs";
import type { SortingJob } from "@/hooks/useSortingJobs";
import { toast } from "sonner";

export default function Sorting() {
  const { data: jobs = [], isLoading } = useSortingJobs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ done: 0, total: 0 });

  const bulkReview = useBulkReview();
  const cancelJobs = useCancelJobs();
  const sendJob = useSendJob();

  const selectedJob = useMemo(() => jobs.find((j) => j.id === selectedId) || null, [jobs, selectedId]);

  const toggleCheck = useCallback((id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setCheckedIds(new Set(jobs.map((j) => j.id))), [jobs]);
  const selectNone = useCallback(() => setCheckedIds(new Set()), []);

  const checkedArr = useMemo(() => Array.from(checkedIds), [checkedIds]);
  const checkedReviewed = useMemo(() => jobs.filter((j) => checkedIds.has(j.id) && j.reviewed), [jobs, checkedIds]);

  const handleBulkSend = useCallback(async () => {
    if (!checkedReviewed.length) { toast.error("Nessun job rivisto selezionato"); return; }
    setSending(true);
    setSendProgress({ done: 0, total: checkedReviewed.length });
    for (let i = 0; i < checkedReviewed.length; i++) {
      try {
        await sendJob.mutateAsync(checkedReviewed[i]);
      } catch { /* already toasted */ }
      setSendProgress({ done: i + 1, total: checkedReviewed.length });
    }
    setSending(false);
    setCheckedIds(new Set());
  }, [checkedReviewed, sendJob]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - 40% */}
        <div className="w-[40%] min-w-[320px]">
          <SortingList
            jobs={jobs}
            selectedId={selectedId}
            selectedIds={checkedIds}
            onSelect={setSelectedId}
            onToggleCheck={toggleCheck}
            onSelectAll={selectAll}
            onSelectNone={selectNone}
          />
        </div>
        {/* Right panel - 60% */}
        <div className="flex-1">
          <SortingCanvas job={selectedJob} />
        </div>
      </div>

      {/* Batch action bar */}
      {checkedIds.size > 0 && (
        <div className="border-t border-border bg-muted/50 px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{checkedIds.size} selezionati</span>
          <Button size="sm" variant="outline" onClick={() => bulkReview.mutate(checkedArr)} disabled={bulkReview.isPending}>
            <CheckCircle2 className="w-4 h-4 mr-1" /> Approva selezionati
          </Button>
          <Button size="sm" onClick={handleBulkSend} disabled={sending || !checkedReviewed.length}>
            {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
            Invia selezionati ({checkedReviewed.length})
          </Button>
          <Button size="sm" variant="destructive" onClick={() => { cancelJobs.mutate(checkedArr); setCheckedIds(new Set()); }} disabled={cancelJobs.isPending}>
            <X className="w-4 h-4 mr-1" /> Scarta selezionati
          </Button>
          {sending && (
            <div className="flex-1 max-w-xs">
              <Progress value={(sendProgress.done / sendProgress.total) * 100} className="h-2" />
              <span className="text-xs text-muted-foreground">{sendProgress.done}/{sendProgress.total}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
