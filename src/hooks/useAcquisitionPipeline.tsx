import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { QueueItem, CanvasData, CanvasPhase, ContactSource } from "@/components/acquisition/types";
import { NetworkStats, NetworkRegression } from "@/components/acquisition/NetworkPerformanceBar";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { useScrapingSettings, calcDelay, getPatternPause, ensureMinDuration } from "@/hooks/useScrapingSettings";
import { useAcquisitionResume } from "@/hooks/useAcquisitionResume";
import { scanDirectory, enrichQueueWithNetworks, loadPartnerPreview } from "@/lib/acquisition/scanDirectory";
import { createLogger } from "@/lib/log";

const log = createLogger("useAcquisitionPipeline");

export type PipelineStatus = "idle" | "scanning" | "running" | "paused" | "done";
export type SessionHealth = "unknown" | "checking" | "active" | "recovering" | "dead";

export interface LiveStats {
  processed: number;
  withEmail: number;
  withPhone: number;
  complete: number;
  empty: number;
  failedLoads: number;
}

export interface ScanStats {
  total: number;
  existing: number;
  missing: number;
}

const EMPTY_STATS: LiveStats = { processed: 0, withEmail: 0, withPhone: 0, complete: 0, empty: 0, failedLoads: 0 };

export function useAcquisitionPipeline() {
  const { settings: scrapingSettings } = useScrapingSettings();

  // Toolbar state
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [delaySeconds, setDelaySeconds] = useState(scrapingSettings.baseDelay);
  const [includeEnrich, setIncludeEnrich] = useState(false);
  const [includeDeepSearch, setIncludeDeepSearch] = useState(false);

  // Pipeline state
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus>("idle");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [canvasData, setCanvasData] = useState<CanvasData | null>(null);
  const [canvasPhase, setCanvasPhase] = useState<CanvasPhase>("idle");
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);
  const [qualityComplete, setQualityComplete] = useState(0);
  const [qualityIncomplete, setQualityIncomplete] = useState(0);
  const [showComet, setShowComet] = useState(false);
  const [showSessionAlert, setShowSessionAlert] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [liveStats, setLiveStats] = useState<LiveStats>(EMPTY_STATS);

  // Network performance tracking
  const [networkStats, setNetworkStats] = useState<Record<string, NetworkStats>>({});
  const [excludedNetworks, setExcludedNetworks] = useState<Set<string>>(new Set());
  const excludedNetworksRef = useRef<Set<string>>(new Set());
  const [networkRegressions, setNetworkRegressions] = useState<NetworkRegression[]>([]);
  const networkBaselineRef = useRef<Record<string, { successes: number; consecutiveFailures: number }>>({});

  const [scanStats, setScanStats] = useState<ScanStats | null>(null);
  const [sessionHealth, setSessionHealth] = useState<SessionHealth>("unknown");

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const pollingAbortRef = useRef(false);
  const extensionWarningShown = useRef(false);

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
    setActiveJobId, setQueue, setSelectedIds, setCompletedCount,
    setLiveStats, setPipelineStatus, setResumeLoading, pauseRef, cancelRef,
  });

  // ── Extension-driven pipeline loop ──
  const runExtensionLoop = useCallback(async (jobId: string, items: QueueItem[], startFrom = 0) => {
    let localStats = { ...liveStats };
    let consecutiveEmpty = 0;
    const AUTO_EXCLUDE_THRESHOLD = scrapingSettings.excludeThreshold;
    let localNetworkStats: Record<string, { success: number; empty: number }> = { ...networkStats };

    const keepAliveInterval = setInterval(async () => {
      try {
        await supabase.from("download_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
      } catch { /* non-blocking */ }
    }, scrapingSettings.keepAliveMs);

    const { data: currentJobData } = await supabase
      .from("download_jobs")
      .select("processed_ids")
      .eq("id", jobId)
      .single();
    const processedSet = new Set<number>(((currentJobData?.processed_ids as number[]) || []));

    for (let i = startFrom; i < items.length; i++) {
      if (cancelRef.current) break;

      while (pauseRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      const item = items[i];

      // Skip partner if ALL its networks are excluded
      if (excludedNetworksRef.current.size > 0 && item.networks && item.networks.length > 0) {
        const allExcluded = item.networks.every(n => excludedNetworksRef.current.has(n));
        if (allExcluded) {
          setQueue((prev) =>
            prev.map((q) =>
              q.wca_id === item.wca_id ? { ...q, status: "done" as const, skippedNetwork: true } : q
            )
          );
          processedSet.add(item.wca_id);
          continue;
        }
      }

      setActiveIndex(i);
      setQueue((prev) =>
        prev.map((q) =>
          q.wca_id === item.wca_id ? { ...q, status: "active" as const } : q
        )
      );
      setCanvasPhase("downloading");

      // Ensure partner exists in DB
      let partnerId: string | null = null;
      let partnerData: any = null;

      const { data: existingPartner } = await supabase
        .from("partners")
        .select("*")
        .eq("wca_id", item.wca_id)
        .maybeSingle();

      if (existingPartner) {
        partnerId = existingPartner.id;
        partnerData = existingPartner;
      } else {
        const { data: newPartner } = await supabase
          .from("partners")
          .insert({
            wca_id: item.wca_id,
            company_name: item.company_name || `WCA ${item.wca_id}`,
            country_code: item.country_code,
            country_name: item.country_code,
            city: item.city || "",
          })
          .select("*")
          .single();

        if (newPartner) {
          partnerId = newPartner.id;
          partnerData = newPartner;
        }
      }

      // Build canvas
      const canvas: CanvasData = {
        company_name: partnerData?.company_name || item.company_name,
        city: partnerData?.city || item.city,
        country_code: partnerData?.country_code || item.country_code,
        country_name: partnerData?.country_name || "",
        logo_url: partnerData?.logo_url || undefined,
        contacts: [],
        services: [],
        key_markets: [],
        key_routes: [],
        networks: [],
        rating: partnerData?.rating ? Number(partnerData.rating) : undefined,
        website: partnerData?.website || undefined,
        profile_description: partnerData?.profile_description || undefined,
        linkedin_links: [],
        warehouse_sqm: undefined,
        employees: undefined,
        founded: undefined,
        fleet: undefined,
        contactSource: "none" as ContactSource,
      };

      if (partnerId) {
        const [{ data: nets }, { data: svcs }] = await Promise.all([
          supabase.from("partner_networks").select("network_name").eq("partner_id", partnerId),
          supabase.from("partner_services").select("service_category").eq("partner_id", partnerId),
        ]);
        canvas.networks = (nets || []).map((n) => n.network_name);
        canvas.services = (svcs || []).map((s) => s.service_category);
        if (canvas.networks.length > 0) {
          setQueue((prev) =>
            prev.map((q) =>
              q.wca_id === item.wca_id ? { ...q, networks: canvas.networks } : q
            )
          );
        }
      }

      setCanvasData(canvas);

      // Extract via Chrome Extension
      setCanvasPhase("extracting");

      if (extensionAvailable || await checkExtension()) {
        try {
          const bridgeResult = await extensionExtract(item.wca_id);
          const extResult = bridgeResult.extraction;

          if (!bridgeResult.bridgeHealthy || !extResult || extResult.state === "not_loaded") {
            localStats = { ...localStats, failedLoads: localStats.failedLoads + 1 };
            setLiveStats(localStats);
            processedSet.add(item.wca_id);
            setQueue((prev) =>
              prev.map((q) =>
                q.wca_id === item.wca_id ? { ...q, status: "done" as const } : q
              )
            );
            await supabase.from("download_jobs").update({
              current_index: processedSet.size,
              processed_ids: [...processedSet] as any,
              last_processed_wca_id: item.wca_id,
              last_contact_result: "skipped",
              contacts_missing_count: localStats.empty + localStats.failedLoads,
            }).eq("id", jobId);
            if (i < items.length - 1 && !cancelRef.current) {
              const pause = getPatternPause(i);
              await new Promise((r) => setTimeout(r, pause * 1000));
            }
            continue;
          }

          if (extResult.success && extResult.contacts && extResult.contacts.length > 0) {
            canvas.contacts = extResult.contacts.map((c) => ({
              name: c.name || c.title || "Sconosciuto",
              title: c.title,
              email: c.email,
              direct_phone: c.phone,
              mobile: c.mobile,
            }));
            canvas.contactSource = "extension";

            if (extResult.companyName && !extResult.companyName.startsWith("WCA ")) {
              canvas.company_name = extResult.companyName;
              if (partnerId) {
                await supabase.from("partners").update({ company_name: extResult.companyName }).eq("id", partnerId);
              }
            }
            setCanvasData({ ...canvas });
          }
        } catch (extErr) {
          log.warn("extension call failed", { wcaId: item.wca_id, message: extErr instanceof Error ? extErr.message : String(extErr) });
        }

        // Fallback: check DB for contacts saved by extension
        if (canvas.contactSource !== "extension" && partnerId) {
          try {
            const { data: dbContacts } = await supabase
              .from("partner_contacts")
              .select("name, title, email, direct_phone, mobile")
              .eq("partner_id", partnerId);
            if (dbContacts && dbContacts.length > 0 &&
                dbContacts.some(c => c.email || c.direct_phone || c.mobile)) {
              canvas.contacts = dbContacts.map(c => ({
                name: c.name,
                title: c.title || undefined,
                email: c.email || undefined,
                direct_phone: c.direct_phone || undefined,
                mobile: c.mobile || undefined,
              }));
              canvas.contactSource = "extension";
              setCanvasData({ ...canvas });
            }
          } catch { /* non-blocking */ }
        }
      } else {
        if (!extensionWarningShown.current) {
          extensionWarningShown.current = true;
          toast({
            title: "Estensione Chrome necessaria",
            description: "Installa l'estensione WCA per estrarre i contatti. Pipeline in pausa.",
            variant: "destructive",
          });
        }
        pauseRef.current = true;
        setPipelineStatus("paused");
        await supabase.from("download_jobs").update({
          status: "paused",
          error_message: "Estensione Chrome non disponibile.",
        }).eq("id", jobId);
        while (pauseRef.current) {
          await new Promise((r) => setTimeout(r, 500));
          if (cancelRef.current) break;
        }
        if (cancelRef.current) break;
        extensionWarningShown.current = false;
        await supabase.from("download_jobs").update({ status: "running", error_message: null }).eq("id", jobId);
      }

      // Update network stats
      const hasAnyContact = canvas.contacts.some(c => c.email?.trim() || c.direct_phone?.trim() || c.mobile?.trim());
      if (canvas.networks && canvas.networks.length > 0) {
        for (const net of canvas.networks) {
          if (!localNetworkStats[net]) localNetworkStats[net] = { success: 0, empty: 0 };
          if (hasAnyContact) localNetworkStats[net].success++;
          else localNetworkStats[net].empty++;
        }
        setNetworkStats({ ...localNetworkStats });

        // Auto-exclude networks with 0% success after threshold
        for (const net of canvas.networks) {
          const s = localNetworkStats[net];
          if (s && s.success === 0 && (s.success + s.empty) >= AUTO_EXCLUDE_THRESHOLD && !excludedNetworksRef.current.has(net)) {
            const networkToExclude = net;
            const undoTimeout = setTimeout(() => {
              excludedNetworksRef.current.add(networkToExclude);
              setExcludedNetworks(new Set(excludedNetworksRef.current));
            }, 5000);

            toast({
              title: `Network "${net}" verrà escluso`,
              description: `0/${s.empty} partner con contatti. Escluso tra 5s.`,
              action: (
                <ToastAction altText="Annulla" onClick={() => {
                  clearTimeout(undoTimeout);
                  toast({ title: `"${networkToExclude}" mantenuto`, description: "L'esclusione è stata annullata." });
                }}>
                  Annulla
                </ToastAction>
              ),
            });
          }
        }

        // Regression detection
        for (const net of canvas.networks) {
          if (!networkBaselineRef.current[net]) {
            networkBaselineRef.current[net] = { successes: 0, consecutiveFailures: 0 };
          }
          const baseline = networkBaselineRef.current[net];
          if (hasAnyContact) {
            baseline.successes++;
            baseline.consecutiveFailures = 0;
          } else {
            baseline.consecutiveFailures++;
          }
          if (baseline.successes >= 2 && baseline.consecutiveFailures >= 3) {
            setNetworkRegressions(prev => {
              const existing = prev.find(r => r.network === net);
              if (existing) {
                return prev.map(r => r.network === net 
                  ? { ...r, consecutiveFailures: baseline.consecutiveFailures } 
                  : r
                );
              }
              return [...prev, {
                network: net,
                previousSuccesses: baseline.successes,
                consecutiveFailures: baseline.consecutiveFailures,
              }];
            });
          } else if (hasAnyContact) {
            setNetworkRegressions(prev => prev.filter(r => r.network !== net));
          }
        }
      }

      // Consecutive empty tracking
      if (!hasAnyContact) {
        consecutiveEmpty++;
      } else {
        consecutiveEmpty = 0;
        if (sessionHealth === "dead") setSessionHealth("active");
      }

      // Enrich + Deep Search
      const parallelTasks: Promise<void>[] = [];

      if (includeEnrich && partnerData?.website && partnerId) {
        parallelTasks.push(
          (async () => {
            try {
              let enrichBody: Record<string, any> = { partnerId };

              // Try client-side scraping for higher quality markdown
              if (fsAvailable) {
                try {
                  let websiteUrl = (partnerData.website as string).trim();
                  if (!websiteUrl.startsWith("http")) websiteUrl = `https://${websiteUrl}`;
                  const scrapeResult = await fsScrapeUrl(websiteUrl);
                  if (scrapeResult.success && scrapeResult.markdown && scrapeResult.markdown.length > 50) {
                    enrichBody.markdown = scrapeResult.markdown;
                    enrichBody.sourceUrl = scrapeResult.metadata?.url || websiteUrl;
                  }
                } catch { /* fallback to server-side fetch */ }
              }

              const { data: enrichResult } = await supabase.functions.invoke("enrich-partner-website", { body: enrichBody });
              if (enrichResult?.enrichment) {
                const ed = enrichResult.enrichment;
                setCanvasData((prev) =>
                  prev ? { ...prev, key_markets: ed.key_markets || [], key_routes: ed.key_routes || [], warehouse_sqm: ed.warehouse_sqm, employees: ed.employee_count, founded: ed.founding_year ? String(ed.founding_year) : undefined, fleet: ed.has_own_fleet ? (ed.fleet_details || "Sì") : undefined } : prev
                );
              }
            } catch { /* non-blocking */ }
          })()
        );
      }

      if (includeDeepSearch && partnerId) {
        parallelTasks.push(
          (async () => {
            try {
              const { data: deepResult } = await supabase.functions.invoke("deep-search-partner", { body: { partnerId } });
              if (deepResult) {
                const [{ data: updatedPartner }, { data: socialLinks }] = await Promise.all([
                  supabase.from("partners").select("logo_url").eq("id", partnerId!).maybeSingle(),
                  supabase.from("partner_social_links").select("*").eq("partner_id", partnerId!),
                ]);
                setCanvasData((prev) =>
                  prev ? {
                    ...prev,
                    logo_url: updatedPartner?.logo_url || prev.logo_url,
                    linkedin_links: (socialLinks || [])
                      .filter((l: any) => l.platform === "linkedin")
                      .map((l: any) => ({ name: "LinkedIn", url: l.url })),
                  } : prev
                );
              }
            } catch { /* non-blocking */ }
          })()
        );
      }

      if (parallelTasks.length > 0) {
        setCanvasPhase("enriching");
        await Promise.all(parallelTasks);
      }

      // Complete + Animate
      setCanvasPhase("complete");
      await new Promise((r) => setTimeout(r, 1000));

      setIsAnimatingOut(true);
      setShowComet(true);
      await new Promise((r) => setTimeout(r, 600));
      setShowComet(false);
      setIsAnimatingOut(false);
      setCompletedCount((c) => c + 1);

      const contactsWithEmail = canvas.contacts.filter(c => !!c.email?.trim());
      const contactsWithPhone = canvas.contacts.filter(c => !!(c.direct_phone?.trim() || c.mobile?.trim()));
      const hasComplete = canvas.contacts.some((c) => !!c.email?.trim() && !!(c.direct_phone?.trim() || c.mobile?.trim()));

      localStats = {
        processed: localStats.processed + 1,
        withEmail: localStats.withEmail + (contactsWithEmail.length > 0 ? 1 : 0),
        withPhone: localStats.withPhone + (contactsWithPhone.length > 0 ? 1 : 0),
        complete: localStats.complete + (hasComplete ? 1 : 0),
        empty: localStats.empty + (!hasAnyContact ? 1 : 0),
        failedLoads: localStats.failedLoads,
      };
      setLiveStats(localStats);

      if (hasComplete) setQualityComplete((v) => v + 1);
      else setQualityIncomplete((v) => v + 1);

      // Update job progress in DB
      processedSet.add(item.wca_id);
      const contactResult = contactsWithEmail.length > 0 && contactsWithPhone.length > 0 ? 'email+phone'
        : contactsWithEmail.length > 0 ? 'email_only'
        : contactsWithPhone.length > 0 ? 'phone_only'
        : 'no_contacts';

      await supabase.from("download_jobs").update({
        current_index: processedSet.size,
        processed_ids: [...processedSet] as any,
        last_processed_wca_id: item.wca_id,
        last_processed_company: canvas.company_name || null,
        last_contact_result: contactResult,
        contacts_found_count: localStats.withEmail,
        contacts_missing_count: localStats.empty,
      }).eq("id", jobId);

      setQueue((prev) =>
        prev.map((q) =>
          q.wca_id === item.wca_id ? { ...q, status: "done" as const, company_name: canvas.company_name || q.company_name, city: canvas.city || q.city } : q
        )
      );

      if (i < items.length - 1 && !cancelRef.current) {
        const pause = getPatternPause(i);
        await new Promise((r) => setTimeout(r, pause * 1000));
      }
    }

    clearInterval(keepAliveInterval);
    return localStats;
  }, [includeEnrich, includeDeepSearch, delaySeconds, extensionAvailable, checkExtension, extensionExtract, liveStats, scrapingSettings]);

  // ── Scan directory ──
  const handleScan = useCallback(async () => {
    if (selectedCountries.length === 0) {
      toast({ title: "Seleziona almeno un paese", variant: "destructive" });
      return;
    }
    setPipelineStatus("scanning");
    setScanStats(null);
    setQueue([]);

    try {
      const result = await scanDirectory(selectedCountries, selectedNetworks);
      setScanStats(result.scanStats);
      setQueue(result.queue);
      setSelectedIds(result.selectedIds);

      // Enrich with network data
      const wcaIdToNetworks = await enrichQueueWithNetworks(result.queue);
      if (Object.keys(wcaIdToNetworks).length > 0) {
        setQueue(prev => prev.map(q =>
          wcaIdToNetworks[q.wca_id] ? { ...q, networks: wcaIdToNetworks[q.wca_id] } : q
        ));
      }

      setPipelineStatus("idle");
    } catch (err: any) {
      toast({ title: "Errore scansione", description: err.message, variant: "destructive" });
      setPipelineStatus("idle");
    }
  }, [selectedCountries, selectedNetworks]);

  // ── Start pipeline ──
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

    setPipelineStatus("running");
    pauseRef.current = false;
    cancelRef.current = false;
    setCompletedCount(0);
    setQualityComplete(0);
    setQualityIncomplete(0);
    setNetworkStats({});
    setExcludedNetworks(new Set());
    excludedNetworksRef.current = new Set();
    setLiveStats(EMPTY_STATS);

    const items = queue.filter((q) => selectedIds.has(q.wca_id));

    let jobId = activeJobId;
    try {
      if (!jobId) {
        const countryCode = items[0]?.country_code || selectedCountries[0] || "";
        const { data: countryPartner } = await supabase
          .from("partners")
          .select("country_name")
          .eq("country_code", countryCode)
          .limit(1)
          .maybeSingle();

        const { data: newJob, error } = await supabase
          .from("download_jobs")
          .insert({
            country_code: countryCode,
            country_name: countryPartner?.country_name || countryCode,
            network_name: selectedNetworks.length > 0 ? selectedNetworks.join(", ") : "All Networks",
            wca_ids: items.map((i) => i.wca_id) as any,
            total_count: items.length,
            delay_seconds: delaySeconds,
            status: "running",
            job_type: "acquisition",
          })
          .select("id")
          .single();

        if (!error && newJob) {
          jobId = newJob.id;
          setActiveJobId(jobId);
        }
      } else {
        await supabase
          .from("download_jobs")
          .update({ status: "running", error_message: null })
          .eq("id", jobId);
      }
    } catch (err) {
      log.error("create/update acquisition job failed", { message: err instanceof Error ? err.message : String(err), stack: err instanceof Error ? err.stack : undefined });
    }

    const localStats = await runExtensionLoop(jobId!, items);

    setCanvasPhase("idle");
    setCanvasData(null);

    if (cancelRef.current) {
      setPipelineStatus("idle");
      if (jobId) {
        supabase.from("download_jobs").update({ status: "cancelled" }).eq("id", jobId).then(() => {});
      }
      setActiveJobId(null);
      toast({
        title: "Acquisizione interrotta",
        description: `${localStats.processed} partner processati su ${items.length} selezionati`,
        variant: "destructive",
      });
    } else {
      setPipelineStatus("done");
      setActiveJobId(null);
      toast({
        title: "Acquisizione completata!",
        description: `${localStats.processed} partner processati — Completi: ${localStats.complete}, Incompleti: ${localStats.processed - localStats.complete}`,
      });
    }
  }, [queue, includeEnrich, includeDeepSearch, delaySeconds, selectedIds, extensionAvailable, checkExtension, extensionExtract, activeJobId, selectedCountries, selectedNetworks, runExtensionLoop, waitForExtension]);

  // ── Network exclusion handlers ──
  const handleExcludeNetwork = useCallback((network: string) => {
    setExcludedNetworks((prev) => {
      const next = new Set(prev);
      next.add(network);
      excludedNetworksRef.current = next;
      return next;
    });
    setQueue((prev) =>
      prev.map((q) => {
        if (q.status !== "pending" || !q.networks || q.networks.length === 0) return q;
        const updatedExcluded = new Set(excludedNetworksRef.current);
        updatedExcluded.add(network);
        const allExcluded = q.networks.every(n => updatedExcluded.has(n));
        return allExcluded ? { ...q, status: "done" as const, skippedNetwork: true } : q;
      })
    );
    toast({ title: `Network "${network}" escluso`, description: "I partner con solo questo network verranno saltati." });
  }, []);

  const handleReincludeNetwork = useCallback((network: string) => {
    setExcludedNetworks((prev) => {
      const next = new Set(prev);
      next.delete(network);
      excludedNetworksRef.current = next;
      return next;
    });
    setQueue((prev) =>
      prev.map((q) => {
        if (!q.skippedNetwork || !q.networks) return q;
        const updatedExcluded = new Set(excludedNetworksRef.current);
        updatedExcluded.delete(network);
        const stillAllExcluded = q.networks.every(n => updatedExcluded.has(n));
        return stillAllExcluded ? q : { ...q, status: "pending" as const, skippedNetwork: false };
      })
    );
    toast({ title: `Network "${network}" riattivato` });
  }, []);

  // ── Partner click handler ──
  const handlePartnerClick = useCallback(async (wcaId: number) => {
    const preview = await loadPartnerPreview(wcaId);
    if (!preview) return;
    setCanvasData(preview);
    setCanvasPhase("complete");
    setIsAnimatingOut(false);
  }, []);

  // ── Pause/Resume/Cancel ──
  const togglePause = useCallback(() => {
    pauseRef.current = !pauseRef.current;
    const newStatus = pauseRef.current ? "paused" : "running";
    setPipelineStatus(newStatus);
    if (activeJobId) {
      supabase.from("download_jobs").update({ status: newStatus }).eq("id", activeJobId).then(() => {});
    }
  }, [activeJobId]);

  const cancelPipeline = useCallback(() => {
    cancelRef.current = true;
    setPipelineStatus("idle");
    if (activeJobId) {
      supabase.from("download_jobs").update({ status: "cancelled" }).eq("id", activeJobId).then(() => {});
      setActiveJobId(null);
    }
  }, [activeJobId]);

  return {
    // Toolbar
    selectedCountries, setSelectedCountries,
    selectedNetworks, setSelectedNetworks,
    delaySeconds, setDelaySeconds,
    includeEnrich, setIncludeEnrich,
    includeDeepSearch, setIncludeDeepSearch,
    // Pipeline
    pipelineStatus,
    queue, setQueue,
    activeIndex,
    canvasData, canvasPhase,
    isAnimatingOut,
    completedCount, qualityComplete, qualityIncomplete,
    showComet,
    showSessionAlert, setShowSessionAlert,
    selectedIds, setSelectedIds,
    liveStats,
    resumeLoading,
    // Network
    networkStats, excludedNetworks,
    networkRegressions,
    // Scan
    scanStats,
    // Session
    sessionHealth, extensionAvailable,
    // Actions
    handleScan, startPipeline,
    handleExcludeNetwork, handleReincludeNetwork,
    handlePartnerClick,
    togglePause, cancelPipeline,
    pauseRef,
  };
}
