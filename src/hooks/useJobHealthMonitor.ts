import { useEffect, useRef } from "react";
import { useDownloadJobs } from "@/hooks/useDownloadJobs";
import { toast } from "@/hooks/use-toast";

/**
 * Proactive job health monitor.
 * Detects failed/stalled jobs and notifies the user automatically.
 * Mount once in AppLayout.
 *
 * 🤖 Claude Engine V8: non mostra toast per job già in pausa/falliti al mount iniziale.
 */
export function useJobHealthMonitor() {
  const { data: jobs = [] } = useDownloadJobs();
  const notifiedRef = useRef<Set<string>>(new Set());
  const stallCheckRef = useRef<Map<string, { index: number; since: number }>>(new Map());
  const initialLoadRef = useRef(true);
  const prevStatusRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    // Al primo render, registra lo stato attuale senza notificare
    if (initialLoadRef.current && jobs.length > 0) {
      initialLoadRef.current = false;
      for (const job of jobs) {
        prevStatusRef.current.set(job.id, job.status);
        // Segna come già notificati i job in stato terminale/pausa al mount
        if (job.status === "failed") notifiedRef.current.add(`fail-${job.id}`);
        if (job.status === "paused") notifiedRef.current.add(`pause-${job.id}`);
        if (job.status === "completed") notifiedRef.current.add(`done-${job.id}`);
      }
      return;
    }

    for (const job of jobs) {
      const _prevStatus = prevStatusRef.current.get(job.id);

      // 1. Notify on failure (solo se cambiato stato)
      if (job.status === "failed" && !notifiedRef.current.has(`fail-${job.id}`)) {
        notifiedRef.current.add(`fail-${job.id}`);
        toast({
          title: `Download ${job.country_name} fallito`,
          description: job.error_message || "Errore durante l'elaborazione.",
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
            title: `Download ${job.country_name} bloccato`,
            description: `Nessun progresso da 3 minuti (${job.current_index}/${job.total_count}).`,
          });
        }
      } else {
        stallCheckRef.current.delete(job.id);
      }

      // 3. Notify on pause (solo se transizione da running/pending a paused)
      if (job.status === "paused" && !notifiedRef.current.has(`pause-${job.id}`)) {
        notifiedRef.current.add(`pause-${job.id}`);
        toast({
          title: `Download ${job.country_name} in pausa`,
          description: job.error_message || "Verifica e riprendi dalla pagina Network.",
          variant: "destructive",
        });
      }

      // 4. Notify on completion
      if (job.status === "completed" && !notifiedRef.current.has(`done-${job.id}`)) {
        notifiedRef.current.add(`done-${job.id}`);
        toast({
          title: `Download ${job.country_name} completato`,
          description: `${job.contacts_found_count} contatti trovati, ${job.contacts_missing_count} mancanti`,
        });
      }

      prevStatusRef.current.set(job.id, job.status);
    }
  }, [jobs]);
}
