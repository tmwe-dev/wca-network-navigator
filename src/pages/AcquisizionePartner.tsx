import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, Square, AlertTriangle, Plug, Mail, Phone, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AcquisitionToolbar } from "@/components/acquisition/AcquisitionToolbar";
import { PartnerQueue, QueueItem } from "@/components/acquisition/PartnerQueue";
import { PartnerCanvas, CanvasData, CanvasPhase, ContactSource } from "@/components/acquisition/PartnerCanvas";
import { AcquisitionBin } from "@/components/acquisition/AcquisitionBin";
import { NetworkPerformanceBar, NetworkStats, NetworkRegression } from "@/components/acquisition/NetworkPerformanceBar";
import { ToastAction } from "@/components/ui/toast";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";
import { useScrapingSettings, calcDelay } from "@/hooks/useScrapingSettings";

type SessionHealth = "unknown" | "checking" | "active" | "recovering" | "dead";
import { WCA_NETWORKS } from "@/data/wcaFilters";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type PipelineStatus = "idle" | "scanning" | "running" | "paused" | "done";

export default function AcquisizionePartner() {
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
  const [liveStats, setLiveStats] = useState({
    processed: 0,
    withEmail: 0,
    withPhone: 0,
    complete: 0,
    empty: 0,
    failedLoads: 0,
  });

  // Network performance tracking
  const [networkStats, setNetworkStats] = useState<Record<string, NetworkStats>>({});
  const [excludedNetworks, setExcludedNetworks] = useState<Set<string>>(new Set());
  const excludedNetworksRef = useRef<Set<string>>(new Set());
  const [networkRegressions, setNetworkRegressions] = useState<NetworkRegression[]>([]);
  const networkBaselineRef = useRef<Record<string, { successes: number; consecutiveFailures: number }>>({});

  // Scan stats
  const [scanStats, setScanStats] = useState<{
    total: number;
    existing: number;
    missing: number;
  } | null>(null);

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const pollingAbortRef = useRef(false);
  const { isAvailable: extensionAvailable, checkAvailable: checkExtension, waitForExtension, extractContacts: extensionExtract, verifySession } = useExtensionBridge();
  const extensionWarningShown = useRef(false);
  const [sessionHealth, setSessionHealth] = useState<SessionHealth>("unknown");

  // ── Extension-driven pipeline: extracts each partner via Chrome Extension (ZERO server requests to WCA) ──
  const runExtensionLoop = useCallback(async (jobId: string, items: QueueItem[], startFrom = 0) => {
    let localStats = { ...liveStats };
    let consecutiveEmpty = 0;
    const AUTO_EXCLUDE_THRESHOLD = scrapingSettings.excludeThreshold;
    
    let localNetworkStats: Record<string, { success: number; empty: number }> = { ...networkStats };
    

    // Keep-alive: prevent browser throttling during overnight runs
    const keepAliveInterval = setInterval(async () => {
      try {
        await supabase.from("download_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId);
      } catch { /* non-blocking */ }
    }, scrapingSettings.keepAliveMs);

    // Read existing progress from DB so we can accumulate correctly
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

      // ── Skip partner if ALL its networks are excluded ──
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

      // Ensure partner exists in DB (so extension can save contacts to it)
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
        // Update queue item networks for tracking
        if (canvas.networks.length > 0) {
          setQueue((prev) =>
            prev.map((q) =>
              q.wca_id === item.wca_id ? { ...q, networks: canvas.networks } : q
            )
          );
        }
      }

      setCanvasData(canvas);

      // ── Extract via Chrome Extension (same IP as browser = session stays alive) ──
      setCanvasPhase("extracting");

      if (extensionAvailable || await checkExtension()) {
        try {
          const extResult = await extensionExtract(item.wca_id);

          // ── Check if page actually loaded (zero retry: mark as done + failed) ──
          if (extResult.pageLoaded === false) {
            console.warn(`[Pipeline] Page not loaded for ${item.wca_id}, marking as skipped (no retry)`);
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
            // Standard delay before next profile
            if (i < items.length - 1 && !cancelRef.current) {
              const actualDelay = calcDelay(scrapingSettings.baseDelay, scrapingSettings.variation);
              await new Promise((r) => setTimeout(r, actualDelay * 1000));
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
          console.warn(`[Extension] Failed for ${item.wca_id}:`, extErr);
        }

        // Fallback: check DB for contacts saved by extension in background
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




      // ── Update network stats (local + state) ──
      const hasAnyContact = canvas.contacts.some(c => c.email?.trim() || c.direct_phone?.trim() || c.mobile?.trim());
      if (canvas.networks && canvas.networks.length > 0) {
        for (const net of canvas.networks) {
          if (!localNetworkStats[net]) localNetworkStats[net] = { success: 0, empty: 0 };
          if (hasAnyContact) localNetworkStats[net].success++;
          else localNetworkStats[net].empty++;
        }
        setNetworkStats({ ...localNetworkStats });

        // ── Auto-exclude networks with 0% success after threshold (with undo toast) ──
        for (const net of canvas.networks) {
          const s = localNetworkStats[net];
          if (s && s.success === 0 && (s.success + s.empty) >= AUTO_EXCLUDE_THRESHOLD && !excludedNetworksRef.current.has(net)) {
            // Schedule exclusion with undo option
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

        // ── Regression detection: networks that used to work now failing ──
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
          // Alert if had >=2 successes and now 3+ consecutive failures
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
            // Clear regression if network starts working again
            setNetworkRegressions(prev => prev.filter(r => r.network !== net));
          }
        }
      }

      // ── Consecutive empty tracking + auto-recovery ──
      if (!hasAnyContact) {
        consecutiveEmpty++;

      } else {
        consecutiveEmpty = 0;
        if (sessionHealth === "dead") setSessionHealth("active");
      }

      // ── Enrich + Deep Search ──
      const parallelTasks: Promise<void>[] = [];

      if (includeEnrich && partnerData?.website && partnerId) {
        parallelTasks.push(
          (async () => {
            try {
              const { data: enrichResult } = await supabase.functions.invoke("enrich-partner-website", { body: { partnerId } });
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
                // Deep search saves logo and social links directly to DB, re-fetch them
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

      // ── Complete + Animate ──
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

      if (hasComplete) {
        setQualityComplete((v) => v + 1);
      } else {
        setQualityIncomplete((v) => v + 1);
      }

      // ── Update job progress in DB ──
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




      // Simplified delay: baseDelay ± variation
      if (i < items.length - 1 && !cancelRef.current) {
        const actualDelay = calcDelay(scrapingSettings.baseDelay, scrapingSettings.variation);
        await new Promise((r) => setTimeout(r, actualDelay * 1000));
      }
    }

    clearInterval(keepAliveInterval);

    return localStats;
  }, [includeEnrich, includeDeepSearch, delaySeconds, extensionAvailable, checkExtension, extensionExtract, liveStats, scrapingSettings]);

  // Check for active acquisition jobs on mount
  useEffect(() => {
    (async () => {
      try {
        const { data: activeJobs } = await supabase
          .from("download_jobs")
          .select("*")
          .eq("job_type", "acquisition")
          .in("status", ["running", "paused"])
          .order("created_at", { ascending: false })
          .limit(1);

        if (activeJobs && activeJobs.length > 0) {
          const job = activeJobs[0];
          setActiveJobId(job.id);
          const wcaIds = (job.wca_ids as number[]) || [];
          const processedIds = new Set((job.processed_ids as number[]) || []);

          // Rebuild queue from job
          const queueItems: QueueItem[] = wcaIds.map((id) => ({
            wca_id: id,
            company_name: `WCA ${id}`,
            country_code: job.country_code,
            city: "",
            status: processedIds.has(id) ? ("done" as const) : ("pending" as const),
            alreadyDownloaded: false,
          }));

          // Enrich names from partners table
          const { data: partners } = await supabase
            .from("partners")
            .select("wca_id, company_name, city")
            .in("wca_id", wcaIds);
          if (partners) {
            for (const p of partners) {
              const qi = queueItems.find((q) => q.wca_id === p.wca_id);
              if (qi) {
                qi.company_name = p.company_name;
                qi.city = p.city;
              }
            }
          }

          // Enrich remaining "WCA XXXX" names from directory_cache
          const stillMissing = queueItems.filter(q => q.company_name.startsWith("WCA "));
          if (stillMissing.length > 0) {
            const { data: cacheEntries } = await supabase
              .from("directory_cache")
              .select("members")
              .eq("country_code", job.country_code);
            if (cacheEntries) {
              for (const entry of cacheEntries) {
                const members = (entry.members as any[]) || [];
                for (const m of members) {
                  if (!m.wca_id || !m.company_name) continue;
                  const qi = stillMissing.find(q => q.wca_id === m.wca_id);
                  if (qi) {
                    qi.company_name = m.company_name;
                    if (m.city) qi.city = m.city;
                  }
                }
              }
            }
          }

          // If still missing names, re-scan directory to populate cache
          const stillMissing2 = queueItems.filter(q => q.company_name.startsWith("WCA "));
          if (stillMissing2.length > 0) {
            try {
              const { data: scanResult } = await supabase.functions.invoke("scrape-wca-directory", {
                body: { countryCode: job.country_code, network: job.network_name || "" },
              });
              if (scanResult?.members) {
                const membersJson = scanResult.members.map((m: any) => ({
                  company_name: m.company_name,
                  city: m.city,
                  country_code: job.country_code,
                  wca_id: m.wca_id,
                }));
                await supabase.from("directory_cache").upsert(
                  {
                    country_code: job.country_code,
                    network_name: job.network_name || "",
                    members: membersJson as any,
                    total_results: scanResult.members.length,
                    scanned_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                  { onConflict: "country_code,network_name" }
                );
                for (const m of scanResult.members) {
                  if (!m.wca_id || !m.company_name) continue;
                  const qi = stillMissing2.find(q => q.wca_id === m.wca_id);
                  if (qi) {
                    qi.company_name = m.company_name;
                    if (m.city) qi.city = m.city;
                  }
                }
              }
            } catch (scanErr) {
              console.warn("Re-scan directory for names failed:", scanErr);
            }
          }

          setQueue(queueItems);
          setSelectedIds(new Set(wcaIds.filter((id) => !processedIds.has(id))));
          setCompletedCount(processedIds.size);

          // Init live stats from DB job data
          setLiveStats({
            processed: processedIds.size,
            withEmail: job.contacts_found_count || 0,
            withPhone: 0,
            complete: job.contacts_found_count || 0,
            empty: job.contacts_missing_count || 0,
            failedLoads: 0,
          });

      if (job.status === "running" || job.status === "paused") {
            // NO AUTO-RESUME: show as paused, require manual click to restart
            setPipelineStatus("paused");
            pauseRef.current = true;
            
            // Mark running jobs as paused in DB to prevent ghost restarts
            if (job.status === "running") {
              await supabase.from("download_jobs").update({ status: "paused" }).eq("id", job.id);
            }

            toast({
              title: "Acquisizione precedente trovata",
              description: `${processedIds.size}/${wcaIds.length} partner già processati. Premi Riprendi per continuare.`,
            });
          } else {
            setPipelineStatus("paused");
            toast({
              title: "Acquisizione precedente trovata",
              description: `${processedIds.size}/${wcaIds.length} partner già processati. Puoi riprendere.`,
            });
          }
        }
      } catch (err) {
        console.error("Failed to check active acquisition jobs:", err);
      } finally {
        setResumeLoading(false);
      }
    })();

    return () => {
      cancelRef.current = true;
    };
  }, []);

  // Scan directory for selected countries
  const handleScan = useCallback(async () => {
    if (selectedCountries.length === 0) {
      toast({ title: "Seleziona almeno un paese", variant: "destructive" });
      return;
    }

    setPipelineStatus("scanning");
    setScanStats(null);
    setQueue([]);

    try {
      const allMembers: QueueItem[] = [];
      const existingWcaIds = new Set<number>();

      // Get already-downloaded wca_ids
      for (const code of selectedCountries) {
        const { data: partners } = await supabase
          .from("partners")
          .select("wca_id")
          .eq("country_code", code)
          .not("wca_id", "is", null);
        partners?.forEach((p) => {
          if (p.wca_id) existingWcaIds.add(p.wca_id);
        });
      }

      // Scan directory cache or trigger scan
      for (const code of selectedCountries) {
        // Use "" for "all networks" — aligned with ActionPanel/Download Management cache
        const networkFilter = selectedNetworks.length > 0 ? selectedNetworks : [""];

        for (const net of networkFilter) {
          // Check cache with exact key: "" for all, specific name otherwise
          const { data: cached } = await supabase
            .from("directory_cache")
            .select("*")
            .eq("country_code", code)
            .eq("network_name", net);

          if (cached && cached.length > 0) {
            for (const entry of cached) {
              const members = (entry.members as any[]) || [];
              members.forEach((m: any) => {
                if (m.wca_id && !allMembers.find((x) => x.wca_id === m.wca_id)) {
                  allMembers.push({
                    wca_id: m.wca_id,
                    company_name: m.company_name || `WCA ${m.wca_id}`,
                    country_code: code,
                    city: m.city || "",
                    status: "pending",
                    alreadyDownloaded: existingWcaIds.has(m.wca_id),
                  });
                }
              });
            }
          } else {
            // Trigger directory scan
            const { data: scanResult } = await supabase.functions.invoke(
              "scrape-wca-directory",
              {
                body: {
                  countryCode: code,
                  network: net, // "" = all networks (param name must match edge function)
                },
              }
            );

            if (scanResult?.members) {
              // Save scan results to directory_cache (like ActionPanel does)
              const membersJson = scanResult.members.map((m: any) => ({
                company_name: m.company_name,
                city: m.city,
                country_code: code,
                wca_id: m.wca_id,
              }));
              await supabase.from("directory_cache").upsert(
                {
                  country_code: code,
                  network_name: net,
                  members: membersJson as any,
                  total_results: scanResult.members.length,
                  scanned_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "country_code,network_name" }
              );

              scanResult.members.forEach((m: any) => {
                if (m.wca_id && !allMembers.find((x) => x.wca_id === m.wca_id)) {
                  allMembers.push({
                    wca_id: m.wca_id,
                    company_name: m.company_name || `WCA ${m.wca_id}`,
                    country_code: code,
                    city: m.city || "",
                    status: "pending",
                    alreadyDownloaded: existingWcaIds.has(m.wca_id),
                  });
                }
              });
            }
          }
        }
      }

      const existing = allMembers.filter((m) => m.alreadyDownloaded).length;
      setScanStats({
        total: allMembers.length,
        existing,
        missing: allMembers.length - existing,
      });
      setQueue(allMembers);
      // Auto-select new partners
      setSelectedIds(new Set(allMembers.filter((m) => !m.alreadyDownloaded).map((m) => m.wca_id)));

      // Load networks for existing partners in DB
      const wcaIdsInDb = allMembers.filter(m => existingWcaIds.has(m.wca_id)).map(m => m.wca_id);
      if (wcaIdsInDb.length > 0) {
        try {
          const { data: partnersWithIds } = await supabase
            .from("partners")
            .select("id, wca_id")
            .in("wca_id", wcaIdsInDb);
          if (partnersWithIds && partnersWithIds.length > 0) {
            const partnerIds = partnersWithIds.map(p => p.id);
            const { data: networkRows } = await supabase
              .from("partner_networks")
              .select("partner_id, network_name")
              .in("partner_id", partnerIds);
            if (networkRows) {
              const wcaIdToNetworks: Record<number, string[]> = {};
              for (const nr of networkRows) {
                const p = partnersWithIds.find(pp => pp.id === nr.partner_id);
                if (p?.wca_id) {
                  if (!wcaIdToNetworks[p.wca_id]) wcaIdToNetworks[p.wca_id] = [];
                  wcaIdToNetworks[p.wca_id].push(nr.network_name);
                }
              }
              setQueue(prev => prev.map(q =>
                wcaIdToNetworks[q.wca_id] ? { ...q, networks: wcaIdToNetworks[q.wca_id] } : q
              ));
            }
          }
        } catch { /* non-blocking */ }
      }

      setPipelineStatus("idle");
    } catch (err: any) {
      toast({ title: "Errore scansione", description: err.message, variant: "destructive" });
      setPipelineStatus("idle");
    }
  }, [selectedCountries, selectedNetworks]);

  // Start acquisition pipeline
  const startPipeline = useCallback(async () => {
    // Verify extension is available first
    const extReady = await waitForExtension(10000);
    if (!extReady) {
      toast({
        title: "Estensione Chrome non trovata",
        description: "Installa o ricarica l'estensione WCA Cookie Sync e riprova.",
        variant: "destructive",
      });
      return;
    }

    // Verify WCA session via extension (real test on WCA site)
    const sessionResult = await verifySession();
    if (!sessionResult.success || !sessionResult.authenticated) {
      toast({
        title: "Sessione WCA non attiva",
        description: "Effettua il login su wcaworld.com e riprova.",
        variant: "destructive",
      });
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
    setLiveStats({ processed: 0, withEmail: 0, withPhone: 0, complete: 0, empty: 0, failedLoads: 0 });

    const items = queue.filter((q) => selectedIds.has(q.wca_id));

    // Create or update download_job in DB for persistence
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
        // Resume existing job — clear stale error messages
        await supabase
          .from("download_jobs")
          .update({ status: "running", error_message: null })
          .eq("id", jobId);
      }
    } catch (err) {
      console.error("Failed to create/update acquisition job:", err);
    }

    // ── Run extension-driven pipeline (ZERO server-side requests to WCA) ──
    const localStats = await runExtensionLoop(jobId!, items);

    // ── Cleanup ──
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

      // Zero Retry: no retry dialog — skipped profiles stay in DB for manual review
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
    // Mark pending queue items that have ONLY excluded networks as skipped
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
    // Restore skipped items that now have at least one non-excluded network
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-3 -m-6 relative overflow-hidden">
      {/* Ambient gradient backgrounds */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark:block hidden" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/[0.06] via-transparent to-transparent dark:block hidden" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-sky-500/[0.05] via-transparent to-transparent dark:block hidden animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:hidden" />

      <div className="relative z-10 flex flex-col h-full gap-2 p-3">
      {/* TWO-COLUMN LAYOUT */}
      <div className="flex-1 grid grid-cols-[35%_1fr] gap-3 min-h-0">
        {/* LEFT COLUMN: Controls + Queue */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* Toolbar */}
          <div className="p-3 bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 rounded-2xl shadow-lg shadow-black/[0.05]">
            <AcquisitionToolbar
              selectedCountries={selectedCountries}
              onCountriesChange={setSelectedCountries}
              selectedNetworks={selectedNetworks}
              onNetworksChange={setSelectedNetworks}
              delaySeconds={delaySeconds}
              onDelayChange={setDelaySeconds}
              includeEnrich={includeEnrich}
              onIncludeEnrichChange={setIncludeEnrich}
              includeDeepSearch={includeDeepSearch}
              onIncludeDeepSearchChange={setIncludeDeepSearch}
            />

            {/* Scan + Extension + Session */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Button
                onClick={handleScan}
                disabled={selectedCountries.length === 0 || pipelineStatus === "scanning" || pipelineStatus === "running"}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                {pipelineStatus === "scanning" ? "Scansione..." : "Scansiona"}
              </Button>

              <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${extensionAvailable ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                <Plug className="w-3 h-3" />
                <span>{extensionAvailable ? "Ext ✓" : "Ext ✗"}</span>
              </div>

              {(pipelineStatus === "running" || pipelineStatus === "paused") && (
                <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                  sessionHealth === "active" ? "bg-emerald-500/10 text-emerald-500" :
                  sessionHealth === "dead" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    sessionHealth === "active" ? "bg-emerald-500" :
                    sessionHealth === "checking" || sessionHealth === "recovering" ? "bg-amber-500 animate-pulse" :
                    sessionHealth === "dead" ? "bg-destructive" : "bg-muted-foreground"
                  }`} />
                  <span>{
                    sessionHealth === "active" ? "WCA ✓" :
                    sessionHealth === "checking" ? "Verifica..." :
                    sessionHealth === "recovering" ? "Ripristino..." :
                    sessionHealth === "dead" ? "Sessione ✗" : "WCA ?"
                  }</span>
                </div>
              )}
            </div>

            {/* Scan stats */}
            {scanStats && (
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span>Trovati: <strong className="text-foreground">{scanStats.total}</strong></span>
                <span>Già: <strong className="text-emerald-500">{scanStats.existing}</strong></span>
                <span>Nuovi: <strong className="text-primary">{scanStats.missing}</strong></span>
              </div>
            )}
          </div>

          {/* Live Stats (compact) */}
          {(pipelineStatus === "running" || pipelineStatus === "paused" || pipelineStatus === "done") && liveStats.processed > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 text-[10px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <strong className="text-foreground">{liveStats.processed}/{queue.filter(q => selectedIds.has(q.wca_id)).length}</strong>
              </div>
              <div className="h-1.5 flex-1 min-w-[60px] max-w-[120px] bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(liveStats.processed / Math.max(queue.filter(q => selectedIds.has(q.wca_id)).length, 1)) * 100}%` }}
                />
              </div>
              <span className="text-sky-500 flex items-center gap-0.5"><Mail className="w-3 h-3" />{liveStats.withEmail}</span>
              <span className="text-violet-500 flex items-center gap-0.5"><Phone className="w-3 h-3" />{liveStats.withPhone}</span>
              <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{liveStats.complete}</span>
              {liveStats.empty > 0 && <span className="text-destructive flex items-center gap-0.5"><XCircle className="w-3 h-3" />{liveStats.empty}</span>}
              {liveStats.failedLoads > 0 && <span className="text-amber-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{liveStats.failedLoads}</span>}
            </div>
          )}

          {/* Network Performance */}
          {Object.keys(networkStats).length > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60">
              <NetworkPerformanceBar
                stats={networkStats}
                excludedNetworks={excludedNetworks}
                onExclude={handleExcludeNetwork}
                onReinclude={handleReincludeNetwork}
                regressions={networkRegressions}
              />
            </div>
          )}

          {/* Partner Queue */}
          <div className="flex-1 flex flex-col bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 rounded-2xl overflow-hidden shadow-lg shadow-black/[0.05] min-h-0">
            <PartnerQueue
              items={queue}
              activeIndex={activeIndex}
              selectedIds={selectedIds}
              onToggle={(wcaId) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(wcaId)) next.delete(wcaId);
                  else next.add(wcaId);
                  return next;
                });
              }}
              onSelectAll={() => setSelectedIds(new Set(queue.map((q) => q.wca_id)))}
              onDeselectAll={() => setSelectedIds(new Set())}
              onPartnerClick={async (wcaId) => {
                const { data: partner } = await supabase.from("partners").select("*").eq("wca_id", wcaId).maybeSingle();
                if (!partner) return;
                const [{ data: contacts }, { data: nets }, { data: svcs }, { data: socialLinks }] = await Promise.all([
                  supabase.from("partner_contacts").select("name, title, email, direct_phone, mobile").eq("partner_id", partner.id),
                  supabase.from("partner_networks").select("network_name").eq("partner_id", partner.id),
                  supabase.from("partner_services").select("service_category").eq("partner_id", partner.id),
                  supabase.from("partner_social_links").select("*").eq("partner_id", partner.id),
                ]);
                const ed = partner.enrichment_data as any;
                setCanvasData({
                  company_name: partner.company_name,
                  city: partner.city,
                  country_code: partner.country_code,
                  country_name: partner.country_name,
                  logo_url: partner.logo_url || undefined,
                  contacts: (contacts || []).map(c => ({ name: c.name, title: c.title || undefined, email: c.email || undefined, direct_phone: c.direct_phone || undefined, mobile: c.mobile || undefined })),
                  services: (svcs || []).map(s => s.service_category),
                  key_markets: ed?.key_markets || [],
                  key_routes: ed?.key_routes || [],
                  networks: (nets || []).map(n => n.network_name),
                  rating: partner.rating ? Number(partner.rating) : undefined,
                  website: partner.website || undefined,
                  profile_description: partner.profile_description || undefined,
                  linkedin_links: (socialLinks || []).filter((l: any) => l.platform === "linkedin").map((l: any) => ({ name: "LinkedIn", url: l.url })),
                  warehouse_sqm: ed?.warehouse_sqm,
                  employees: ed?.employee_count,
                  founded: ed?.founding_year ? String(ed.founding_year) : undefined,
                  fleet: ed?.has_own_fleet ? (ed.fleet_details || "Sì") : undefined,
                  contactSource: "extension",
                });
                setCanvasPhase("complete");
                setIsAnimatingOut(false);
              }}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {queue.length > 0 && pipelineStatus !== "running" && selectedIds.size > 0 && (
              <Button onClick={startPipeline} size="sm" className="flex-1 gap-1.5 text-xs">
                <Play className="w-3.5 h-3.5" />
                Avvia ({selectedIds.size})
              </Button>
            )}
            {pipelineStatus === "running" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => {
                    pauseRef.current = !pauseRef.current;
                    const newStatus = pauseRef.current ? "paused" : "running";
                    setPipelineStatus(newStatus);
                    if (activeJobId) {
                      supabase.from("download_jobs").update({ status: newStatus }).eq("id", activeJobId).then(() => {});
                    }
                  }}
                >
                  {pauseRef.current ? <><Play className="w-3.5 h-3.5 mr-1" /> Riprendi</> : <><Pause className="w-3.5 h-3.5 mr-1" /> Pausa</>}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    cancelRef.current = true;
                    setPipelineStatus("idle");
                    if (activeJobId) {
                      supabase.from("download_jobs").update({ status: "cancelled" }).eq("id", activeJobId).then(() => {});
                      setActiveJobId(null);
                    }
                  }}
                >
                  <Square className="w-3.5 h-3.5 mr-1" /> Stop
                </Button>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Canvas */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex-1 flex flex-col bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 rounded-2xl overflow-hidden shadow-lg shadow-black/[0.05]">
            <PartnerCanvas
              data={canvasData}
              phase={canvasPhase}
              isAnimatingOut={isAnimatingOut}
            />
          </div>
        </div>
      </div>

      {/* BOTTOM: Acquisition Bin */}
      <div className="flex justify-center">
        <AcquisitionBin
          count={completedCount}
          total={queue.filter((q) => selectedIds.has(q.wca_id)).length}
          showComet={showComet}
          completeCount={qualityComplete}
          incompleteCount={qualityIncomplete}
        />
      </div>

      {/* WCA Session Alert */}
      <AlertDialog open={showSessionAlert} onOpenChange={setShowSessionAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Sessione WCA Non Attiva
            </AlertDialogTitle>
            <AlertDialogDescription>
              La sessione WCA non è attiva o è scaduta. Per scaricare i dati completi (email, telefoni) è necessario
              avere una sessione autenticata. Vai nelle Impostazioni per aggiornare il cookie di sessione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSessionAlert(false)}>
              Ho capito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Retry Incomplete Dialog */}


      </div>
    </div>
  );
}
