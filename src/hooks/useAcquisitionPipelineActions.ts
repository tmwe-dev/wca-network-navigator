/**
 * Acquisition Pipeline — Actions (extracted from useAcquisitionPipeline)
 * Scan, start, pause, cancel, network exclusion handlers.
 */
import { useCallback } from "react";
import { getPartnersByCountries } from "@/data/partners";
import { toast } from "@/hooks/use-toast";
import { scanDirectory, enrichQueueWithNetworks, loadPartnerPreview } from "@/lib/acquisition/scanDirectory";
import { updateDownloadJob, createDownloadJob } from "@/data/downloadJobs";
import type { useAcquisitionPipelineState } from "./useAcquisitionPipelineState";
import type { LiveStats } from "./useAcquisitionPipelineState";
import { EMPTY_STATS } from "./useAcquisitionPipelineState";

type State = ReturnType<typeof useAcquisitionPipelineState>;

export function useAcquisitionPipelineActions(
  state: State,
  deps: {
    extensionAvailable: boolean;
    waitForExtension: (ms?: number) => Promise<boolean>;
    verifySession: () => Promise<{ success: boolean; authenticated?: boolean }>;
    runExtensionLoop: (jobId: string, items: Record<string, unknown>[], startFrom?: number) => Promise<LiveStats>;
  }
) {
  const { extensionAvailable: _extensionAvailable, waitForExtension, verifySession, runExtensionLoop } = deps;

  const handleScan = useCallback(async () => {
    if (state.selectedCountries.length === 0) {
      toast({ title: "Seleziona almeno un paese", variant: "destructive" });
      return;
    }
    state.setPipelineStatus("scanning");
    state.setScanStats(null);
    state.setQueue([]);

    try {
      const result = await scanDirectory(state.selectedCountries, state.selectedNetworks);
      state.setScanStats(result.scanStats);
      state.setQueue(result.queue);
      state.setSelectedIds(result.selectedIds);

      const wcaIdToNetworks = await enrichQueueWithNetworks(result.queue);
      if (Object.keys(wcaIdToNetworks).length > 0) {
        state.setQueue(prev => prev.map(q =>
          wcaIdToNetworks[q.wca_id] ? { ...q, networks: wcaIdToNetworks[q.wca_id] } : q
        ));
      }
      state.setPipelineStatus("idle");
    } catch (err: unknown) {
      toast({ title: "Errore scansione", description: (err instanceof Error ? err.message : String(err)), variant: "destructive" });
      state.setPipelineStatus("idle");
    }
  }, [state.selectedCountries, state.selectedNetworks]);

  const startPipeline = useCallback(async () => {
    const extReady = await waitForExtension(10000);
    if (!extReady) {
      toast({ title: "Estensione Chrome non trovata", description: "Installa o ricarica l'estensione WCA Cookie Sync e riprova.", variant: "destructive" });
      return;
    }

    const sessionResult = await verifySession();
    if (!sessionResult.success || !sessionResult.authenticated) {
      toast({ title: "Sessione WCA non attiva", description: "Effettua il login su wcaworld.com e riprova.", variant: "destructive" });
      return;
    }

    state.setPipelineStatus("running");
    state.pauseRef.current = false;
    state.cancelRef.current = false;
    state.setCompletedCount(0);
    state.setQualityComplete(0);
    state.setQualityIncomplete(0);
    state.setNetworkStats({});
    state.setExcludedNetworks(new Set());
    state.excludedNetworksRef.current = new Set();
    state.setLiveStats(EMPTY_STATS);

    const items = state.queue.filter((q) => state.selectedIds.has(q.wca_id));

    let jobId = state.activeJobId;
    try {
      if (!jobId) {
        const countryCode = items[0]?.country_code || state.selectedCountries[0] || "";
        const countryPartners = await getPartnersByCountries([countryCode], "country_name");
        const countryName = String(countryPartners[0]?.country_name ?? countryCode);

        jobId = await createDownloadJob({
          country_code: countryCode,
          country_name: countryName,
          network_name: state.selectedNetworks.length > 0 ? state.selectedNetworks.join(", ") : "All Networks",
          wca_ids: items.map((i) => i.wca_id),
          total_count: items.length,
          delay_seconds: state.delaySeconds,
          status: "running",
          job_type: "acquisition",
        });
        state.setActiveJobId(jobId);
      } else {
        await updateDownloadJob(jobId, { status: "running", error_message: null });
      }
    } catch (err) {
      console.error("create/update acquisition job failed", err);
    }

    const localStats = await runExtensionLoop(jobId!, items as Record<string, unknown>[]);

    state.setCanvasPhase("idle");
    state.setCanvasData(null);

    if (state.cancelRef.current) {
      state.setPipelineStatus("idle");
      if (jobId) await updateDownloadJob(jobId, { status: "cancelled" }).catch(() => {});
      state.setActiveJobId(null);
      toast({
        title: "Acquisizione interrotta",
        description: `${localStats.processed} partner processati su ${items.length} selezionati`,
        variant: "destructive",
      });
    } else {
      state.setPipelineStatus("done");
      state.setActiveJobId(null);
      toast({
        title: "Acquisizione completata!",
        description: `${localStats.processed} partner processati — Completi: ${localStats.complete}, Incompleti: ${localStats.processed - localStats.complete}`,
      });
    }
  }, [state.queue, state.includeEnrich, state.includeDeepSearch, state.delaySeconds, state.selectedIds, state.activeJobId, state.selectedCountries, state.selectedNetworks, runExtensionLoop, waitForExtension, verifySession]);

  const handleExcludeNetwork = useCallback((network: string) => {
    state.setExcludedNetworks((prev) => {
      const next = new Set(prev);
      next.add(network);
      state.excludedNetworksRef.current = next;
      return next;
    });
    state.setQueue((prev) =>
      prev.map((q) => {
        if (q.status !== "pending" || !q.networks || q.networks.length === 0) return q;
        const updatedExcluded = new Set(state.excludedNetworksRef.current);
        updatedExcluded.add(network);
        const allExcluded = q.networks.every(n => updatedExcluded.has(n));
        return allExcluded ? { ...q, status: "done" as const, skippedNetwork: true } : q;
      })
    );
    toast({ title: `Network "${network}" escluso`, description: "I partner con solo questo network verranno saltati." });
  }, []);

  const handleReincludeNetwork = useCallback((network: string) => {
    state.setExcludedNetworks((prev) => {
      const next = new Set(prev);
      next.delete(network);
      state.excludedNetworksRef.current = next;
      return next;
    });
    state.setQueue((prev) =>
      prev.map((q) => {
        if (!q.skippedNetwork || !q.networks) return q;
        const updatedExcluded = new Set(state.excludedNetworksRef.current);
        updatedExcluded.delete(network);
        const stillAllExcluded = q.networks.every(n => updatedExcluded.has(n));
        return stillAllExcluded ? q : { ...q, status: "pending" as const, skippedNetwork: false };
      })
    );
    toast({ title: `Network "${network}" riattivato` });
  }, []);

  const handlePartnerClick = useCallback(async (wcaId: number) => {
    const preview = await loadPartnerPreview(wcaId);
    if (!preview) return;
    state.setCanvasData(preview);
    state.setCanvasPhase("complete");
    state.setIsAnimatingOut(false);
  }, []);

  const togglePause = useCallback(() => {
    state.pauseRef.current = !state.pauseRef.current;
    const newStatus = state.pauseRef.current ? "paused" : "running";
    state.setPipelineStatus(newStatus);
    if (state.activeJobId) {
      updateDownloadJob(state.activeJobId, { status: newStatus }).catch(() => {});
    }
  }, [state.activeJobId]);

  const cancelPipeline = useCallback(() => {
    state.cancelRef.current = true;
    state.setPipelineStatus("idle");
    if (state.activeJobId) {
      updateDownloadJob(state.activeJobId, { status: "cancelled" }).catch(() => {});
      state.setActiveJobId(null);
    }
  }, [state.activeJobId]);

  return {
    handleScan,
    startPipeline,
    handleExcludeNetwork,
    handleReincludeNetwork,
    handlePartnerClick,
    togglePause,
    cancelPipeline,
  };
}
