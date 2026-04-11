/**
 * useAcquisitionPipeline — Orchestrator hook.
 * State extracted to useAcquisitionPipelineState.
 * Actions extracted to useAcquisitionPipelineActions.
 * Loop logic remains here as it's tightly coupled to extension bridges.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import { QueueItem, CanvasData, ContactSource } from "@/components/acquisition/types";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { useScrapingSettings, getPatternPause } from "@/hooks/useScrapingSettings";
import { useAcquisitionResume } from "@/hooks/useAcquisitionResume";
import { useAcquisitionPipelineState, EMPTY_STATS } from "./useAcquisitionPipelineState";
import { useAcquisitionPipelineActions } from "./useAcquisitionPipelineActions";
import { updateDownloadJob } from "@/data/downloadJobs";
import { createLogger } from "@/lib/log";

import type { LiveStats } from "./useAcquisitionPipelineState";

const log = createLogger("useAcquisitionPipeline");

export type { PipelineStatus, SessionHealth, LiveStats, ScanStats } from "./useAcquisitionPipelineState";

export function useAcquisitionPipeline() {
  const state = useAcquisitionPipelineState();
  const { settings: scrapingSettings } = useScrapingSettings();

  const { isAvailable: extensionAvailable, checkAvailable: checkExtension, extractContacts: extensionExtract, verifySession } = useExtensionBridge();
  const { isAvailable: fsAvailable, scrapeUrl: fsScrapeUrl } = useFireScrapeExtensionBridge();

  const waitForExtension = useCallback(async (maxWaitMs = 10000): Promise<boolean> => {
    if (extensionAvailable) return true;
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const ok = await checkExtension();
      if (ok) return true;
      await new Promise(r => setTimeout(r, 500));
    }
    return false;
  }, [extensionAvailable, checkExtension]);

  // ── Resume from active job ──
  useAcquisitionResume({
    setActiveJobId: state.setActiveJobId, setQueue: state.setQueue,
    setSelectedIds: state.setSelectedIds, setCompletedCount: state.setCompletedCount,
    setLiveStats: state.setLiveStats, setPipelineStatus: state.setPipelineStatus,
    setResumeLoading: state.setResumeLoading,
    pauseRef: state.pauseRef, cancelRef: state.cancelRef,
  });

  // ── Extension-driven pipeline loop ──
  const runExtensionLoop = useCallback(async (jobId: string, items: QueueItem[], startFrom = 0): Promise<LiveStats> => {
    let localStats = { ...state.liveStats };
    let consecutiveEmpty = 0;
    const AUTO_EXCLUDE_THRESHOLD = scrapingSettings.excludeThreshold;

    const keepAliveInterval = setInterval(async () => {
      try { await updateDownloadJob(jobId, {}); } catch { /* non-blocking */ }
    }, scrapingSettings.keepAliveMs);

    const { data: currentJobData } = await supabase
      .from("download_jobs").select("processed_ids").eq("id", jobId).single();
    const processedSet = new Set<number>(((currentJobData?.processed_ids as number[]) || []));

    for (let i = startFrom; i < items.length; i++) {
      if (state.cancelRef.current) break;
      while (state.pauseRef.current) {
        await new Promise(r => setTimeout(r, 500));
        if (state.cancelRef.current) break;
      }
      if (state.cancelRef.current) break;

      const item = items[i];

      // Skip if all networks excluded
      if (state.excludedNetworksRef.current.size > 0 && item.networks?.length) {
        if (item.networks.every(n => state.excludedNetworksRef.current.has(n))) {
          state.setQueue(prev => prev.map(q => q.wca_id === item.wca_id ? { ...q, status: "done" as const, skippedNetwork: true } : q));
          processedSet.add(item.wca_id);
          continue;
        }
      }

      state.setActiveIndex(i);
      state.setQueue(prev => prev.map(q => q.wca_id === item.wca_id ? { ...q, status: "active" as const } : q));
      state.setCanvasPhase("downloading");

      // Ensure partner exists
      let partnerId: string | null = null;
      let partnerData: Record<string, unknown> | null = null;
      const { data: existingPartner } = await supabase.from("partners").select("*").eq("wca_id", item.wca_id).maybeSingle();

      if (existingPartner) {
        partnerId = existingPartner.id;
        partnerData = existingPartner;
      } else {
        const { data: newPartner } = await supabase.from("partners")
          .insert({ wca_id: item.wca_id, company_name: item.company_name || `WCA ${item.wca_id}`, country_code: item.country_code, country_name: item.country_code, city: item.city || "" })
          .select("*").single();
        if (newPartner) { partnerId = newPartner.id; partnerData = newPartner; }
      }

      const canvas: CanvasData = {
        company_name: (partnerData?.company_name as string) || item.company_name,
        city: (partnerData?.city as string) || item.city,
        country_code: (partnerData?.country_code as string) || item.country_code,
        country_name: (partnerData?.country_name as string) || "",
        logo_url: (partnerData?.logo_url as string) || undefined,
        contacts: [], services: [], key_markets: [], key_routes: [], networks: [],
        rating: partnerData?.rating ? Number(partnerData.rating) : undefined,
        website: (partnerData?.website as string) || undefined,
        profile_description: (partnerData?.profile_description as string) || undefined,
        linkedin_links: [], warehouse_sqm: undefined, employees: undefined,
        founded: undefined, fleet: undefined, contactSource: "none" as ContactSource,
      };

      if (partnerId) {
        const [{ data: nets }, { data: svcs }] = await Promise.all([
          supabase.from("partner_networks").select("network_name").eq("partner_id", partnerId),
          supabase.from("partner_services").select("service_category").eq("partner_id", partnerId),
        ]);
        canvas.networks = (nets || []).map(n => n.network_name);
        canvas.services = (svcs || []).map(s => s.service_category);
        if (canvas.networks.length > 0) {
          state.setQueue(prev => prev.map(q => q.wca_id === item.wca_id ? { ...q, networks: canvas.networks } : q));
        }
      }

      state.setCanvasData(canvas);
      state.setCanvasPhase("extracting");

      // Extension extraction
      if (extensionAvailable || await checkExtension()) {
        try {
          const bridgeResult = await extensionExtract(item.wca_id);
          const extResult = bridgeResult.extraction;
          if (!bridgeResult.bridgeHealthy || !extResult || extResult.state === "not_loaded") {
            localStats = { ...localStats, failedLoads: localStats.failedLoads + 1 };
            state.setLiveStats(localStats);
            processedSet.add(item.wca_id);
            state.setQueue(prev => prev.map(q => q.wca_id === item.wca_id ? { ...q, status: "done" as const } : q));
            await updateDownloadJob(jobId, {
              current_index: processedSet.size, last_processed_wca_id: item.wca_id,
              last_contact_result: "skipped", contacts_missing_count: localStats.empty + localStats.failedLoads,
            });
            if (i < items.length - 1 && !state.cancelRef.current) await new Promise(r => setTimeout(r, getPatternPause(i) * 1000));
            continue;
          }
          if (extResult.success && extResult.contacts?.length) {
            canvas.contacts = extResult.contacts.map((c: Record<string, string>) => ({
              name: c.name || c.title || "Sconosciuto", title: c.title,
              email: c.email, direct_phone: c.phone, mobile: c.mobile,
            }));
            canvas.contactSource = "extension";
            if (extResult.companyName && !extResult.companyName.startsWith("WCA ")) {
              canvas.company_name = extResult.companyName;
              if (partnerId) await supabase.from("partners").update({ company_name: extResult.companyName }).eq("id", partnerId);
            }
            state.setCanvasData({ ...canvas });
          }
        } catch (extErr) {
          log.warn("extension call failed", { wcaId: item.wca_id, message: extErr instanceof Error ? extErr.message : String(extErr) });
        }

        // Fallback: DB contacts
        if (canvas.contactSource !== "extension" && partnerId) {
          try {
            const { data: dbContacts } = await supabase.from("partner_contacts")
              .select("name, title, email, direct_phone, mobile").eq("partner_id", partnerId);
            if (dbContacts?.length && dbContacts.some(c => c.email || c.direct_phone || c.mobile)) {
              canvas.contacts = dbContacts.map(c => ({
                name: c.name, title: c.title || undefined, email: c.email || undefined,
                direct_phone: c.direct_phone || undefined, mobile: c.mobile || undefined,
              }));
              canvas.contactSource = "extension";
              state.setCanvasData({ ...canvas });
            }
          } catch { /* non-blocking */ }
        }
      } else {
        if (!state.extensionWarningShown.current) {
          state.extensionWarningShown.current = true;
          toast({ title: "Estensione Chrome necessaria", description: "Installa l'estensione WCA per estrarre i contatti.", variant: "destructive" });
        }
        state.pauseRef.current = true;
        state.setPipelineStatus("paused");
        await updateDownloadJob(jobId, { status: "paused", error_message: "Estensione Chrome non disponibile." });
        while (state.pauseRef.current) { await new Promise(r => setTimeout(r, 500)); if (state.cancelRef.current) break; }
        if (state.cancelRef.current) break;
        state.extensionWarningShown.current = false;
        await updateDownloadJob(jobId, { status: "running", error_message: null });
      }

      const hasAnyContact = canvas.contacts.some(c => c.email?.trim() || c.direct_phone?.trim() || c.mobile?.trim());
      if (!hasAnyContact) consecutiveEmpty++; else consecutiveEmpty = 0;

      // Enrich + Deep Search
      const parallelTasks: Promise<void>[] = [];
      if (state.includeEnrich && (partnerData as Record<string, unknown>)?.website && partnerId) {
        parallelTasks.push((async () => {
          try {
            const enrichBody: Record<string, unknown> = { partnerId };
            if (fsAvailable) {
              try {
                let url = ((partnerData as Record<string, unknown>).website as string).trim();
                if (!url.startsWith("http")) url = `https://${url}`;
                const r = await fsScrapeUrl(url);
                if (r.success && r.markdown?.length > 50) { enrichBody.markdown = r.markdown; enrichBody.sourceUrl = r.metadata?.url || url; }
              } catch { /* fallback */ }
            }
            const enrichResult = await invokeEdge<Record<string, unknown>>("enrich-partner-website", { body: enrichBody, context: "pipeline.enrich" });
            if (enrichResult?.enrichment) {
              const ed = enrichResult.enrichment as Record<string, unknown>;
              state.setCanvasData(prev => prev ? {
                ...prev,
                key_markets: (ed.key_markets as string[]) || prev.key_markets,
                key_routes: (ed.key_routes as Array<{ from: string; to: string }>) || prev.key_routes,
              } : prev);
            }
          } catch { /* non-blocking */ }
        })());
      }
      if (state.includeDeepSearch && partnerId) {
        parallelTasks.push((async () => {
          try {
            await invokeEdge("ai-utility", { body: { action: "deep_search", partnerId }, context: "pipeline.deep_search" });
          } catch { /* non-blocking */ }
        })());
      }
      if (parallelTasks.length > 0) { state.setCanvasPhase("enriching"); await Promise.all(parallelTasks); }

      // Complete + animate
      state.setCanvasPhase("complete");
      await new Promise(r => setTimeout(r, 1000));
      state.setIsAnimatingOut(true); state.setShowComet(true);
      await new Promise(r => setTimeout(r, 600));
      state.setShowComet(false); state.setIsAnimatingOut(false);
      state.setCompletedCount(c => c + 1);

      const contactsWithEmail = canvas.contacts.filter(c => !!c.email?.trim());
      const contactsWithPhone = canvas.contacts.filter(c => !!(c.direct_phone?.trim() || c.mobile?.trim()));
      const hasComplete = canvas.contacts.some(c => !!c.email?.trim() && !!(c.direct_phone?.trim() || c.mobile?.trim()));

      localStats = {
        processed: localStats.processed + 1,
        withEmail: localStats.withEmail + (contactsWithEmail.length > 0 ? 1 : 0),
        withPhone: localStats.withPhone + (contactsWithPhone.length > 0 ? 1 : 0),
        complete: localStats.complete + (hasComplete ? 1 : 0),
        empty: localStats.empty + (!hasAnyContact ? 1 : 0),
        failedLoads: localStats.failedLoads,
      };
      state.setLiveStats(localStats);
      if (hasComplete) state.setQualityComplete(v => v + 1); else state.setQualityIncomplete(v => v + 1);

      processedSet.add(item.wca_id);
      const contactResult = contactsWithEmail.length > 0 && contactsWithPhone.length > 0 ? 'email+phone'
        : contactsWithEmail.length > 0 ? 'email_only' : contactsWithPhone.length > 0 ? 'phone_only' : 'no_contacts';

      await updateDownloadJob(jobId, {
        current_index: processedSet.size, last_processed_wca_id: item.wca_id,
        last_processed_company: canvas.company_name || null, last_contact_result: contactResult,
        contacts_found_count: localStats.withEmail, contacts_missing_count: localStats.empty,
      });

      state.setQueue(prev => prev.map(q =>
        q.wca_id === item.wca_id ? { ...q, status: "done" as const, company_name: canvas.company_name || q.company_name, city: canvas.city || q.city } : q
      ));

      if (i < items.length - 1 && !state.cancelRef.current) {
        await new Promise(r => setTimeout(r, getPatternPause(i) * 1000));
      }
    }

    clearInterval(keepAliveInterval);
    return localStats;
  }, [state.includeEnrich, state.includeDeepSearch, extensionAvailable, checkExtension, extensionExtract, state.liveStats, scrapingSettings]);

  const actions = useAcquisitionPipelineActions(state, {
    extensionAvailable, waitForExtension, verifySession, runExtensionLoop,
  });

  return {
    // Toolbar
    selectedCountries: state.selectedCountries, setSelectedCountries: state.setSelectedCountries,
    selectedNetworks: state.selectedNetworks, setSelectedNetworks: state.setSelectedNetworks,
    delaySeconds: state.delaySeconds, setDelaySeconds: state.setDelaySeconds,
    includeEnrich: state.includeEnrich, setIncludeEnrich: state.setIncludeEnrich,
    includeDeepSearch: state.includeDeepSearch, setIncludeDeepSearch: state.setIncludeDeepSearch,
    // Pipeline
    pipelineStatus: state.pipelineStatus,
    queue: state.queue, setQueue: state.setQueue,
    activeIndex: state.activeIndex,
    canvasData: state.canvasData, canvasPhase: state.canvasPhase,
    isAnimatingOut: state.isAnimatingOut,
    completedCount: state.completedCount, qualityComplete: state.qualityComplete, qualityIncomplete: state.qualityIncomplete,
    showComet: state.showComet,
    showSessionAlert: state.showSessionAlert, setShowSessionAlert: state.setShowSessionAlert,
    selectedIds: state.selectedIds, setSelectedIds: state.setSelectedIds,
    liveStats: state.liveStats,
    resumeLoading: state.resumeLoading,
    // Network
    networkStats: state.networkStats, excludedNetworks: state.excludedNetworks,
    networkRegressions: state.networkRegressions,
    // Scan
    scanStats: state.scanStats,
    // Session
    sessionHealth: state.sessionHealth, extensionAvailable,
    // Actions
    ...actions,
    pauseRef: state.pauseRef,
  };
}
