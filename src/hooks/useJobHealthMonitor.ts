import { useEffect, useRef } from "react";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { toast } from "@/hooks/use-toast";

/**
 * Proactive job health monitor.
 * Detects failed/stalled jobs and notifies the user automatically.
 * Mount once in AppLayout.
 */
export function useJobHealthMonitor() {
  const { data: jobs = [] } = useDownloadJobs();
  const notifiedRef = useRef<Set<string>>(new Set());
  const stallCheckRef = useRef<Map<string, { index: number; since: number }>>(new Map());

  useEffect(() => {
    for (const job of jobs) {
      // 1. Notify on failure
      if (job.status === "failed" && !notifiedRef.current.has(`fail-${job.id}`)) {
        notifiedRef.current.add(`fail-${job.id}`);
        toast({
          title: `⚠️ Download ${job.country_name} fallito`,
          description: job.error_message || "Errore durante l'elaborazione. Verifica la sessione WCA.",
          variant: "destructive",
        });
      }

      // 2. Detect stalled jobs (running but no progress for 3 minutes)
      if (job.status === "running") {
        const prev = stallCheckRef.current.get(job.id);
        if (!prev || prev.index !== job.current_index) {
          stallCheckRef.current.set(job.id, { index: job.current_index, since: Date.now() });
        } else if (Date.now() - prev.since > 180_000 && !notifiedRef.current.has(`stall-${job.id}`)) {
          notifiedRef.current.add(`stall-${job.id}`);
          toast({
            title: `⏸️ Download ${job.country_name} bloccato`,
            description: `Nessun progresso da 3 minuti (${job.current_index}/${job.total_count}). Verifica la sessione.`,
          });
        }
      } else {
        stallCheckRef.current.delete(job.id);
      }

      // 3. Notify on completion
      if (job.status === "completed" && !notifiedRef.current.has(`done-${job.id}`)) {
        notifiedRef.current.add(`done-${job.id}`);
        toast({
          title: `✅ Download ${job.country_name} completato`,
          description: `${job.contacts_found_count} contatti trovati, ${job.contacts_missing_count} mancanti`,
        });
      }
    }
  }, [jobs]);
}
