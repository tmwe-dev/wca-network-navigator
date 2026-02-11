import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, Square, AlertTriangle, Plug, Mail, Phone, CheckCircle2, XCircle, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { AcquisitionToolbar } from "@/components/acquisition/AcquisitionToolbar";
import { PartnerQueue, QueueItem } from "@/components/acquisition/PartnerQueue";
import { PartnerCanvas, CanvasData, CanvasPhase, ContactSource } from "@/components/acquisition/PartnerCanvas";
import { AcquisitionBin } from "@/components/acquisition/AcquisitionBin";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";
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
  // Toolbar state
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedNetworks, setSelectedNetworks] = useState<string[]>([]);
  const [delaySeconds, setDelaySeconds] = useState(15);
  const [includeEnrich, setIncludeEnrich] = useState(true);
  const [includeDeepSearch, setIncludeDeepSearch] = useState(true);

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
  const [showRetryDialog, setShowRetryDialog] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [resumeLoading, setResumeLoading] = useState(true);
  const [liveStats, setLiveStats] = useState({
    processed: 0,
    withEmail: 0,
    withPhone: 0,
    complete: 0,
    empty: 0,
  });

  // Scan stats
  const [scanStats, setScanStats] = useState<{
    total: number;
    existing: number;
    missing: number;
  } | null>(null);

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const { status: wcaStatus, triggerCheck } = useWcaSessionStatus();
  const { isAvailable: extensionAvailable, checkAvailable: checkExtension, extractContacts: extensionExtract } = useExtensionBridge();
  const extensionWarningShown = useRef(false);

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

          setQueue(queueItems);
          setSelectedIds(new Set(wcaIds.filter((id) => !processedIds.has(id))));
          setCompletedCount(processedIds.size);
          setLiveStats((prev) => ({ ...prev, processed: processedIds.size }));
          setPipelineStatus(job.status === "paused" ? "paused" : "idle");

          toast({
            title: "Acquisizione precedente trovata",
            description: `${processedIds.size}/${wcaIds.length} partner già processati. Puoi riprendere.`,
          });
        }
      } catch (err) {
        console.error("Failed to check active acquisition jobs:", err);
      } finally {
        setResumeLoading(false);
      }
    })();
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
      setPipelineStatus("idle");
    } catch (err: any) {
      toast({ title: "Errore scansione", description: err.message, variant: "destructive" });
      setPipelineStatus("idle");
    }
  }, [selectedCountries, selectedNetworks]);

  // Start acquisition pipeline
  const startPipeline = useCallback(async () => {
    // Check WCA session first - use returned value to avoid stale state
    const sessionResult = await triggerCheck();
    if (!sessionResult || sessionResult.status !== "ok") {
      setShowSessionAlert(true);
      return;
    }

    setPipelineStatus("running");
    pauseRef.current = false;
    cancelRef.current = false;
    setCompletedCount(0);
    setQualityComplete(0);
    setQualityIncomplete(0);
    setLiveStats({ processed: 0, withEmail: 0, withPhone: 0, complete: 0, empty: 0 });

    let consecutiveNoContacts = 0;
    const MAX_CONSECUTIVE_EMPTY = 5;

    const items = queue.filter((q) => selectedIds.has(q.wca_id));

    // Create or update download_job in DB for persistence
    let jobId = activeJobId;
    try {
      if (!jobId) {
        const countryCode = items[0]?.country_code || selectedCountries[0] || "";
        const countryName = items[0]?.country_code || "";
        // Look up country name from partners or use code
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
        // Resume existing job
        await supabase
          .from("download_jobs")
          .update({ status: "running" })
          .eq("id", jobId);
      }
    } catch (err) {
      console.error("Failed to create/update acquisition job:", err);
    }

    // ── Invoke background edge function for base download ──
    if (jobId) {
      supabase.functions.invoke("process-download-job", { body: { jobId } }).catch(console.error);
    }

    // ── Poll job progress and enrich each completed partner ──
    let lastProcessedIndex = activeJobId ? (queue.filter(q => q.status === "done").length) : 0;
    let localConsecutiveEmpty = 0;
    let localStats = { processed: 0, withEmail: 0, withPhone: 0, complete: 0, empty: 0 };

    while (lastProcessedIndex < items.length) {
      if (cancelRef.current) break;

      // Pause support
      while (pauseRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      // Poll job progress from DB
      const { data: freshJob } = await supabase
        .from("download_jobs")
        .select("current_index, status, last_processed_wca_id, last_processed_company, error_message")
        .eq("id", jobId!)
        .single();

      if (!freshJob) break;
      if (freshJob.status === "error") {
        toast({ title: "Errore nel job", description: freshJob.error_message || "Errore sconosciuto", variant: "destructive" });
        break;
      }
      if (freshJob.status === "cancelled") break;
      if (freshJob.status === "paused" && !pauseRef.current) {
        // Server paused the job (e.g., auth failure)
        pauseRef.current = true;
        setPipelineStatus("paused");
        toast({
          title: "Job in pausa",
          description: freshJob.error_message || "Il server ha messo in pausa il job.",
          variant: "destructive",
        });
        continue;
      }

      const serverIndex = freshJob.current_index || 0;

      if (serverIndex > lastProcessedIndex) {
        // Process each newly completed partner
        for (let i = lastProcessedIndex; i < serverIndex && i < items.length; i++) {
          if (cancelRef.current) break;

          const item = items[i];
          setActiveIndex(i);

          // Update queue status to active momentarily
          setQueue((prev) =>
            prev.map((q) =>
              q.wca_id === item.wca_id ? { ...q, status: "active" as const } : q
            )
          );

          // Fetch partner from DB (saved by edge function)
          setCanvasPhase("downloading");
          const { data: partner } = await supabase
            .from("partners")
            .select("*")
            .eq("wca_id", item.wca_id)
            .maybeSingle();

          const partnerData = partner;
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

          // Fetch networks + services from DB
          if (partnerData?.id) {
            const [{ data: nets }, { data: svcs }, { data: serverContacts }] = await Promise.all([
              supabase.from("partner_networks").select("network_name").eq("partner_id", partnerData.id),
              supabase.from("partner_services").select("service_category").eq("partner_id", partnerData.id),
              supabase.from("partner_contacts").select("name, title, email, direct_phone, mobile").eq("partner_id", partnerData.id),
            ]);
            canvas.networks = (nets || []).map((n) => n.network_name);
            canvas.services = (svcs || []).map((s) => s.service_category);
            // Save server contacts as fallback
            const serverContactsList = (serverContacts || []).map((c) => ({
              name: c.name,
              title: c.title || undefined,
              email: c.email || undefined,
              direct_phone: c.direct_phone || undefined,
              mobile: c.mobile || undefined,
            }));
            if (serverContactsList.length > 0 && serverContactsList.some(c => c.email || c.direct_phone || c.mobile)) {
              canvas.contacts = serverContactsList;
              canvas.contactSource = "server";
            }
          }

          setCanvasData(canvas);

          // PHASE 1.5: Extract contacts via Chrome Extension
          if (extensionAvailable || await checkExtension()) {
            setCanvasPhase("extracting");
            try {
              const extResult = await extensionExtract(item.wca_id);
              if (extResult.success && extResult.contacts && extResult.contacts.length > 0) {
                canvas.contacts = extResult.contacts.map((c) => ({
                  name: c.name || c.title || "Sconosciuto",
                  title: c.title,
                  email: c.email,
                  direct_phone: c.phone,
                  mobile: c.mobile,
                }));
                canvas.contactSource = "extension";
                setCanvasData({ ...canvas });
              }
            } catch (extErr) {
              console.warn(`[Extension] Failed for ${item.wca_id}:`, extErr);
            }

            // FALLBACK: Check DB if extension didn't provide emails
            if (canvas.contactSource !== "extension" || !canvas.contacts.some(c => c.email?.trim())) {
              try {
                if (partnerData?.id) {
                  const { data: dbContacts } = await supabase
                    .from("partner_contacts")
                    .select("name, title, email, direct_phone, mobile")
                    .eq("partner_id", partnerData.id);

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
                }
              } catch { /* non-blocking */ }
            }
          } else {
            if (!extensionWarningShown.current) {
              extensionWarningShown.current = true;
              toast({
                title: "Estensione Chrome non rilevata",
                description: "Installa l'estensione WCA Cookie Sync per estrarre email e telefoni privati.",
              });
            }
          }

          // PHASE 2+3: Enrich + Deep Search in parallel
          const parallelTasks: Promise<void>[] = [];

          if (includeEnrich && partnerData?.website && partnerData?.id) {
            parallelTasks.push(
              (async () => {
                try {
                  const { data: enrichResult } = await supabase.functions.invoke(
                    "enrich-partner-website",
                    { body: { partnerId: partnerData.id } }
                  );
                  if (enrichResult?.enrichment_data) {
                    const ed = enrichResult.enrichment_data;
                    setCanvasData((prev) =>
                      prev ? { ...prev, key_markets: ed.key_markets || [], key_routes: ed.key_routes || [], warehouse_sqm: ed.warehouse_sqm, employees: ed.employees, founded: ed.year_founded, fleet: ed.own_fleet } : prev
                    );
                  }
                } catch { /* non-blocking */ }
              })()
            );
          }

          if (includeDeepSearch && partnerData?.id) {
            parallelTasks.push(
              (async () => {
                try {
                  const { data: deepResult } = await supabase.functions.invoke(
                    "deep-search-partner",
                    { body: { partnerId: partnerData.id } }
                  );
                  if (deepResult) {
                    setCanvasData((prev) =>
                      prev ? { ...prev, logo_url: deepResult.logo_url || prev.logo_url, linkedin_links: (deepResult.social_links || []).filter((l: any) => l.platform === "linkedin").map((l: any) => ({ name: l.contact_name || "LinkedIn", url: l.url })) } : prev
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

          // COMPLETE
          setCanvasPhase("complete");
          await new Promise((r) => setTimeout(r, 1000));

          // Comet animation
          setIsAnimatingOut(true);
          setShowComet(true);
          await new Promise((r) => setTimeout(r, 600));
          setShowComet(false);
          setIsAnimatingOut(false);
          setCompletedCount((c) => c + 1);

          // Track quality
          const contactsWithEmail = canvas.contacts.filter(c => !!c.email?.trim());
          const contactsWithPhone = canvas.contacts.filter(c => !!(c.direct_phone?.trim() || c.mobile?.trim()));
          const hasAnyContact = contactsWithEmail.length > 0 || contactsWithPhone.length > 0;
          const hasComplete = canvas.contacts.some((c) => !!c.email?.trim() && !!(c.direct_phone?.trim() || c.mobile?.trim()));

          localStats = {
            processed: localStats.processed + 1,
            withEmail: localStats.withEmail + (contactsWithEmail.length > 0 ? 1 : 0),
            withPhone: localStats.withPhone + (contactsWithPhone.length > 0 ? 1 : 0),
            complete: localStats.complete + (hasComplete ? 1 : 0),
            empty: localStats.empty + (!hasAnyContact ? 1 : 0),
          };
          setLiveStats(localStats);

          if (hasComplete) {
            setQualityComplete((v) => v + 1);
            localConsecutiveEmpty = 0;
          } else {
            setQualityIncomplete((v) => v + 1);
            if (!hasAnyContact) localConsecutiveEmpty++;
            else localConsecutiveEmpty = 0;
          }

          // Warn (but don't stop) if too many consecutive empty
          if (localConsecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) {
            toast({
              title: "⚠️ Qualità dati bassa",
              description: `${MAX_CONSECUTIVE_EMPTY} partner consecutivi senza contatti. Controlla la sessione WCA se vuoi fermarti.`,
              variant: "destructive",
            });
            localConsecutiveEmpty = 0;
          }

          // Re-check session after first partner with no contacts
          if (i === 0 && !hasAnyContact) {
            const recheck = await triggerCheck();
            if (!recheck || recheck.status !== "ok") {
              pauseRef.current = true;
              setPipelineStatus("paused");
              setShowSessionAlert(true);
              // Pause the background job too
              if (jobId) {
                supabase.from("download_jobs").update({ status: "paused" }).eq("id", jobId).then(() => {});
              }
              while (pauseRef.current) {
                await new Promise((r) => setTimeout(r, 500));
                if (cancelRef.current) break;
              }
              if (cancelRef.current) break;
              // Resume background job
              if (jobId) {
                supabase.from("download_jobs").update({ status: "running" }).eq("id", jobId).then(() => {});
                supabase.functions.invoke("process-download-job", { body: { jobId } }).catch(console.error);
              }
            }
          }

          // Mark done in queue
          setQueue((prev) =>
            prev.map((q) =>
              q.wca_id === item.wca_id ? { ...q, status: "done" as const, company_name: canvas.company_name || q.company_name, city: canvas.city || q.city } : q
            )
          );
        }
        lastProcessedIndex = serverIndex;
      }

      if (freshJob.status === "completed" && lastProcessedIndex >= items.length) break;

      // Wait before next poll
      await new Promise((r) => setTimeout(r, 3000));
    }

    // ── Cleanup ──
    setCanvasPhase("idle");
    setCanvasData(null);

    const processedItems = queue.filter((q) => q.status === "done").length;

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

      if (localStats.empty > 0) {
        setRetryCount(localStats.empty);
        setShowRetryDialog(true);
      }
    }
  }, [queue, includeEnrich, includeDeepSearch, delaySeconds, triggerCheck, selectedIds, extensionAvailable, checkExtension, extensionExtract, activeJobId, selectedCountries, selectedNetworks]);

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] gap-3 p-4">
      {/* TOOLBAR */}
      <Card className="p-4 bg-card/80 backdrop-blur-sm border-border">
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

        {/* Scan + Stats + Extension indicator */}
        <div className="flex items-center gap-3 mt-3">
          <Button
            onClick={handleScan}
            disabled={selectedCountries.length === 0 || pipelineStatus === "scanning" || pipelineStatus === "running"}
            variant="outline"
            size="sm"
          >
            {pipelineStatus === "scanning" ? "Scansione..." : "Scansiona Directory"}
          </Button>

          {/* Extension status */}
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md ${extensionAvailable ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
            <Plug className="w-3 h-3" />
            <span>{extensionAvailable ? "Estensione attiva" : "Estensione non rilevata"}</span>
          </div>

          {scanStats && (
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                Trovati: <strong className="text-foreground">{scanStats.total}</strong>
              </span>
              <span>
                Già scaricati: <strong className="text-emerald-500">{scanStats.existing}</strong>
              </span>
              <span>
                Nuovi: <strong className="text-primary">{scanStats.missing}</strong>
              </span>
            </div>
          )}

          {queue.length > 0 && pipelineStatus !== "running" && selectedIds.size > 0 && (
            <Button
              onClick={startPipeline}
              className="ml-auto gap-2"
              size="sm"
            >
              <Play className="w-4 h-4" />
              Avvia Acquisizione ({selectedIds.size})
            </Button>
          )}

          {pipelineStatus === "running" && (
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  pauseRef.current = !pauseRef.current;
                  const newStatus = pauseRef.current ? "paused" : "running";
                  setPipelineStatus(newStatus);
                  if (activeJobId) {
                    supabase.from("download_jobs").update({ status: newStatus }).eq("id", activeJobId).then(() => {});
                  }
                }}
              >
                {pauseRef.current ? (
                  <>
                    <Play className="w-4 h-4 mr-1" /> Riprendi
                  </>
                ) : (
                  <>
                    <Pause className="w-4 h-4 mr-1" /> Pausa
                  </>
                )}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  cancelRef.current = true;
                  setPipelineStatus("idle");
                  if (activeJobId) {
                    supabase.from("download_jobs").update({ status: "cancelled" }).eq("id", activeJobId).then(() => {});
                    setActiveJobId(null);
                  }
                }}
              >
                <Square className="w-4 h-4 mr-1" /> Stop
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* LIVE STATS BAR */}
      {(pipelineStatus === "running" || pipelineStatus === "paused" || pipelineStatus === "done") && liveStats.processed > 0 && (
        <div className="flex items-center gap-4 px-4 py-2 rounded-lg bg-card/80 backdrop-blur-sm border border-border text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
            Progresso: <strong className="text-foreground">{liveStats.processed}/{queue.filter(q => selectedIds.has(q.wca_id)).length}</strong>
          </div>
          <div className="h-2 flex-1 max-w-[200px] bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${(liveStats.processed / Math.max(queue.filter(q => selectedIds.has(q.wca_id)).length, 1)) * 100}%` }}
            />
          </div>
          <div className="flex items-center gap-1 text-sky-500">
            <Mail className="w-3 h-3" />
            <span>{liveStats.withEmail}</span>
          </div>
          <div className="flex items-center gap-1 text-violet-500">
            <Phone className="w-3 h-3" />
            <span>{liveStats.withPhone}</span>
          </div>
          <div className="flex items-center gap-1 text-emerald-500">
            <CheckCircle2 className="w-3 h-3" />
            <span>{liveStats.complete} completi</span>
          </div>
          {liveStats.empty > 0 && (
            <div className="flex items-center gap-1 text-destructive">
              <XCircle className="w-3 h-3" />
              <span>{liveStats.empty} vuoti</span>
            </div>
          )}
        </div>
      )}

      {/* MAIN SPLIT */}
      <div className="flex-1 flex gap-3 min-h-0">
        {/* LEFT: Partner Queue */}
        <Card className="w-[35%] flex flex-col bg-card/80 backdrop-blur-sm border-border overflow-hidden">
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
          />
        </Card>

        {/* RIGHT: Canvas */}
        <Card className="flex-1 flex flex-col bg-card/80 backdrop-blur-sm border-border overflow-hidden">
          <PartnerCanvas
            data={canvasData}
            phase={canvasPhase}
            isAnimatingOut={isAnimatingOut}
          />
        </Card>
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
      <AlertDialog open={showRetryDialog} onOpenChange={setShowRetryDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-primary" />
              Partner senza contatti
            </AlertDialogTitle>
            <AlertDialogDescription>
              {retryCount} partner sono stati scaricati senza email o telefoni.
              Vuoi ritentare l'acquisizione solo per questi partner?
              Assicurati che la sessione WCA sia attiva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction className="bg-secondary text-secondary-foreground hover:bg-secondary/80" onClick={() => setShowRetryDialog(false)}>
              No, chiudi
            </AlertDialogAction>
            <AlertDialogAction onClick={() => {
              setShowRetryDialog(false);
              // Select only empty partners and restart
              const emptyWcaIds = new Set<number>();
              queue.forEach((q) => {
                if (q.status === "done" && selectedIds.has(q.wca_id)) {
                  // Check if this partner had no contacts in the bin
                  emptyWcaIds.add(q.wca_id);
                }
              });
              // Reset statuses for retry
              setQueue((prev) =>
                prev.map((q) =>
                  emptyWcaIds.has(q.wca_id) ? { ...q, status: "pending" as const } : q
                )
              );
              setSelectedIds(emptyWcaIds);
              // Auto-start after short delay
              setTimeout(() => startPipeline(), 500);
            }}>
              <RotateCcw className="w-4 h-4 mr-1" />
              Riprova ({retryCount})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
