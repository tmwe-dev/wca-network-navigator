/**
 * useSherlock — hook React per orchestrare un'indagine Sherlock con UI feedback.
 */
import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listPlaybooks,
  getPlaybookByLevel,
  createInvestigation,
  updateInvestigation,
  sherlockKeys,
} from "@/data/sherlockPlaybooks";
import { runAgenticSherlock } from "@/v2/services/sherlock/agenticEngine";
import { invalidateEnrichmentCaches } from "@/lib/enrichmentCacheInvalidation";
import type {
  SherlockLevel,
  SherlockStepResult,
  SherlockPlaybook,
} from "@/v2/services/sherlock/sherlockTypes";


import { createLogger } from "@/lib/log";
const log = createLogger("useSherlock");
export interface UseSherlockArgs {
  partnerId: string | null;
  contactId: string | null;
  targetLabel: string | null;
  vars: Record<string, string>;
}

export function useSherlock(args: UseSherlockArgs) {
  const [running, setRunning] = React.useState<SherlockLevel | null>(null);
  const [currentLevel, setCurrentLevel] = React.useState<SherlockLevel | null>(null);
  const [stepResults, setStepResults] = React.useState<SherlockStepResult[]>([]);
  const [consolidated, setConsolidated] = React.useState<Record<string, unknown>>({});
  const [summary, setSummary] = React.useState<string>("");
  const [investigationId, setInvestigationId] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const queryClient = useQueryClient();

  const playbooksQuery = useQuery({
    queryKey: sherlockKeys.playbooks,
    queryFn: listPlaybooks,
    staleTime: 60_000,
  });

  const stop = React.useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setRunning(null);
    if (investigationId) {
      updateInvestigation(investigationId, {
        status: "aborted",
        completed_at: new Date().toISOString(),
      }).catch(() => null);
    }
    invalidateEnrichmentCaches(queryClient, args.partnerId);
    toast.info("Indagine interrotta");
  }, [investigationId, queryClient, args.partnerId]);

  const reset = React.useCallback(() => {
    if (running) return;
    setStepResults([]);
    setConsolidated({});
    setSummary("");
    setInvestigationId(null);
  }, [running]);

  const start = React.useCallback(
    async (level: SherlockLevel) => {
      if (running) return;

      const { data: userData } = await supabase.auth.getSession().then(r => ({ data: { user: r.data.session?.user ?? null } }));
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("Sessione utente non disponibile");
        return;
      }

      setRunning(level);
      setCurrentLevel(level);
      setStepResults([]);
      setConsolidated({});
      setSummary("");

      const controller = new AbortController();
      abortRef.current = controller;

      // Persist investigation (best effort, non blocca se fallisce)
      let invId: string | null = null;
      try {
        // Recupera un playbook di riferimento solo per FK (legacy schema)
        const playbook = await getPlaybookByLevel(level).catch(() => null);
        const inv = await createInvestigation({
          user_id: userId,
          playbook_id: playbook?.id ?? null,
          level,
          partner_id: args.partnerId,
          contact_id: args.contactId,
          target_label: args.targetLabel,
          vars: args.vars,
        });
        invId = inv.id;
        setInvestigationId(inv.id);
      } catch (e) {
        log.warn("[sherlock] create investigation skipped", { error: e });
      }

      try {
        const result = await runAgenticSherlock({
          level,
          vars: args.vars,
          partnerId: args.partnerId,
          contactId: args.contactId,
          signal: controller.signal,
          onProgress: (ev) => {
            setStepResults((prev) => {
              const next = [...prev];
              const idx = next.findIndex((r) => r.order === ev.result.order);
              if (idx >= 0) next[idx] = ev.result;
              else next.push(ev.result);
              next.sort((a, b) => a.order - b.order);
              return next;
            });
            setConsolidated(ev.consolidated);
          },
        });
        setSummary(result.summary);
        setConsolidated(result.consolidated);
        setStepResults([...result.results].sort((a, b) => a.order - b.order));

        if (invId) {
          await updateInvestigation(invId, {
            status: controller.signal.aborted ? "aborted" : "completed",
            findings: result.consolidated,
            step_log: result.results,
            summary: result.summary,
            duration_ms: result.durationMs,
            completed_at: new Date().toISOString(),
          }).catch(() => null);
        }

        if (!controller.signal.aborted) {
          invalidateEnrichmentCaches(queryClient, args.partnerId);
          toast.success(`Indagine completata`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Errore sconosciuto";
        if (msg !== "Aborted") toast.error(`Indagine fallita: ${msg}`);
        if (invId) {
          await updateInvestigation(invId, {
            status: "failed",
            summary: msg,
            completed_at: new Date().toISOString(),
          }).catch(() => null);
        }
        invalidateEnrichmentCaches(queryClient, args.partnerId);
      } finally {
        abortRef.current = null;
        setRunning(null);
      }
    },
    [args.partnerId, args.contactId, args.targetLabel, args.vars, running, queryClient],
  );

  return {
    playbooks: (playbooksQuery.data ?? []) as SherlockPlaybook[],
    isLoadingPlaybooks: playbooksQuery.isLoading,
    running,
    currentLevel,
    stepResults,
    consolidated,
    summary,
    investigationId,
    start,
    stop,
    reset,
  };
}
