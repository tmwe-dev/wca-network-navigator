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
import { NetworkPerformanceBar, NetworkStats } from "@/components/acquisition/NetworkPerformanceBar";
import { useExtensionBridge } from "@/hooks/useExtensionBridge";

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

  // Network performance tracking
  const [networkStats, setNetworkStats] = useState<Record<string, NetworkStats>>({});
  const [excludedNetworks, setExcludedNetworks] = useState<Set<string>>(new Set());
  const excludedNetworksRef = useRef<Set<string>>(new Set());

  // Scan stats
  const [scanStats, setScanStats] = useState<{
    total: number;
    existing: number;
    missing: number;
  } | null>(null);

  const pauseRef = useRef(false);
  const cancelRef = useRef(false);
  const pollingAbortRef = useRef(false);
  const { isAvailable: extensionAvailable, checkAvailable: checkExtension, waitForExtension, extractContacts: extensionExtract, verifySession, syncCookie } = useExtensionBridge();
  const extensionWarningShown = useRef(false);
  const [sessionHealth, setSessionHealth] = useState<SessionHealth>("unknown");

  // ── Extension-driven pipeline: extracts each partner via Chrome Extension (ZERO server requests to WCA) ──
  const runExtensionLoop = useCallback(async (jobId: string, items: QueueItem[], startFrom = 0) => {
    let localStats = { ...liveStats };
    let consecutiveEmpty = 0;
    const AUTO_EXCLUDE_THRESHOLD = 5; // Auto-exclude network after 5+ partners with 0% success
    const SESSION_RECOVERY_THRESHOLD = 3; // Attempt session recovery after 3 consecutive empty from good networks
    let localNetworkStats: Record<string, { success: number; empty: number }> = { ...networkStats };

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

      // ── Every 3 partners: verify session is still alive (auto-recover, never pause) ──
      const loopCount = i - startFrom + 1;
      if (loopCount > 0 && loopCount % 3 === 0) {
        setSessionHealth("checking");
        try {
          const sessionResult = await verifySession();
          if (sessionResult.success && sessionResult.authenticated) {
            setSessionHealth("active");
          } else {
            // Auto-recover: try syncCookie + verify, never pause
            setSessionHealth("recovering");
            await syncCookie();
            await new Promise((r) => setTimeout(r, 3000));
            const retryResult = await verifySession();
            if (retryResult.success && retryResult.authenticated) {
              setSessionHealth("active");
              toast({ title: "🔄 Sessione ripristinata", description: "Recovery automatico riuscito." });
            } else {
              // Second attempt with longer wait
              await new Promise((r) => setTimeout(r, 10000));
              if (cancelRef.current) break;
              await syncCookie();
              await new Promise((r) => setTimeout(r, 3000));
              const retryResult2 = await verifySession();
              if (retryResult2.success && retryResult2.authenticated) {
                setSessionHealth("active");
                toast({ title: "🔄 Sessione ripristinata", description: "Recovery automatico riuscito (secondo tentativo)." });
              } else {
                setSessionHealth("dead");
                // Log but don't pause — the consecutive empty logic will handle further recovery
                console.warn("[SessionCheck] Auto-recovery failed, pipeline continues");
                await supabase.from("download_jobs").update({
                  error_message: "⚠️ Verifica sessione fallita — pipeline continua, recovery in corso.",
                }).eq("id", jobId);
              }
            }
          }
        } catch {
          setSessionHealth("unknown");
        }
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

        // ── Auto-exclude networks with 0% success after threshold ──
        for (const net of canvas.networks) {
          const s = localNetworkStats[net];
          if (s && s.success === 0 && (s.success + s.empty) >= AUTO_EXCLUDE_THRESHOLD && !excludedNetworksRef.current.has(net)) {
            excludedNetworksRef.current.add(net);
            setExcludedNetworks(new Set(excludedNetworksRef.current));
            toast({
              title: `Network "${net}" escluso automaticamente`,
              description: `0/${s.empty} partner con contatti. I partner rimanenti di questo network verranno saltati.`,
            });
          }
        }
      }

      // ── Consecutive empty tracking + auto-recovery ──
      if (!hasAnyContact) {
        consecutiveEmpty++;

        // Check if emptiness is due to excluded-only networks (not a session problem)
        const allNetworksAreBad = canvas.networks.length > 0 && canvas.networks.every(n => {
          const s = localNetworkStats[n];
          return s && s.success === 0 && (s.success + s.empty) >= AUTO_EXCLUDE_THRESHOLD;
        });

        // If good networks are also failing → likely session issue → auto-recover
        if (consecutiveEmpty >= SESSION_RECOVERY_THRESHOLD && !allNetworksAreBad) {
          console.log(`[AutoRecovery] ${consecutiveEmpty} consecutive empty — attempting session recovery`);
          setSessionHealth("recovering");

          // Attempt 1: syncCookie
          try {
            await syncCookie();
            await new Promise((r) => setTimeout(r, 3000));
            const recheck = await verifySession();
            if (recheck.success && recheck.authenticated) {
              setSessionHealth("active");
              consecutiveEmpty = 0;
              toast({ title: "🔄 Sessione ripristinata", description: "Recovery automatico riuscito. Pipeline continua." });
              await supabase.from("download_jobs").update({ error_message: null }).eq("id", jobId);
            } else {
              // Attempt 2: wait longer and retry
              console.log("[AutoRecovery] First attempt failed, waiting 10s and retrying...");
              await new Promise((r) => setTimeout(r, 10000));
              await syncCookie();
              await new Promise((r) => setTimeout(r, 3000));
              const recheck2 = await verifySession();
              if (recheck2.success && recheck2.authenticated) {
                setSessionHealth("active");
                consecutiveEmpty = 0;
                toast({ title: "🔄 Sessione ripristinata", description: "Recovery automatico riuscito (secondo tentativo)." });
                await supabase.from("download_jobs").update({ error_message: null }).eq("id", jobId);
              } else {
                // Attempt 3: wait 30s and try one last time
                console.log("[AutoRecovery] Second attempt failed, waiting 30s...");
                await supabase.from("download_jobs").update({ error_message: "🔄 Tentativo di recovery sessione in corso..." }).eq("id", jobId);
                await new Promise((r) => setTimeout(r, 30000));
                if (cancelRef.current) break;
                await syncCookie();
                await new Promise((r) => setTimeout(r, 5000));
                const recheck3 = await verifySession();
                if (recheck3.success && recheck3.authenticated) {
                  setSessionHealth("active");
                  consecutiveEmpty = 0;
                  toast({ title: "🔄 Sessione ripristinata", description: "Recovery automatico riuscito (terzo tentativo)." });
                  await supabase.from("download_jobs").update({ error_message: null }).eq("id", jobId);
                } else {
                  // All attempts failed — continue anyway, session may recover on its own
                  setSessionHealth("dead");
                  toast({
                    title: "⚠️ Recovery sessione fallito",
                    description: "La pipeline continua. Rilogga su wcaworld.com quando possibile.",
                    variant: "destructive",
                  });
                  await supabase.from("download_jobs").update({
                    error_message: "⚠️ Sessione scaduta — recovery automatico fallito. La pipeline continua.",
                  }).eq("id", jobId);
                  // Reset counter to avoid spamming recovery attempts — try again after another batch
                  consecutiveEmpty = 0;
                }
              }
            }
          } catch (recoveryErr) {
            console.error("[AutoRecovery] Error:", recoveryErr);
            setSessionHealth("unknown");
            consecutiveEmpty = 0; // Reset to avoid infinite recovery loops
          }
        }
      } else {
        consecutiveEmpty = 0;
        if (sessionHealth === "dead") setSessionHealth("active"); // Session came back!
      }

      // ── Enrich + Deep Search ──
      const parallelTasks: Promise<void>[] = [];

      if (includeEnrich && partnerData?.website && partnerId) {
        parallelTasks.push(
          (async () => {
            try {
              const { data: enrichResult } = await supabase.functions.invoke("enrich-partner-website", { body: { partnerId } });
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

      if (includeDeepSearch && partnerId) {
        parallelTasks.push(
          (async () => {
            try {
              const { data: deepResult } = await supabase.functions.invoke("deep-search-partner", { body: { partnerId } });
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

      // Wait delay before next
      if (i < items.length - 1 && !cancelRef.current) {
        await new Promise((r) => setTimeout(r, delaySeconds * 1000));
      }
    }

    return localStats;
  }, [includeEnrich, includeDeepSearch, delaySeconds, extensionAvailable, checkExtension, extensionExtract, verifySession, syncCookie, liveStats]);

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
          });

          if (job.status === "running") {
            // AUTO-RESUME: extension-driven, restart loop from where we left off
            setPipelineStatus("running");
            pauseRef.current = false;
            cancelRef.current = false;

            toast({
              title: "Acquisizione attiva ripresa",
              description: `${processedIds.size}/${wcaIds.length} partner processati. Ripresa estrazione via estensione.`,
            });

            const startIdx = queueItems.findIndex(q => q.status !== "done");
            runExtensionLoop(job.id, queueItems, startIdx >= 0 ? startIdx : 0).then((finalStats) => {
              setCanvasPhase("idle");
              setCanvasData(null);
              setPipelineStatus("done");
              setActiveJobId(null);
              if (finalStats) {
                toast({
                  title: "Acquisizione completata!",
                  description: `${finalStats.processed} partner processati — Completi: ${finalStats.complete}, Incompleti: ${finalStats.processed - finalStats.complete}`,
                });
              }
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
    setLiveStats({ processed: 0, withEmail: 0, withPhone: 0, complete: 0, empty: 0 });

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

      if (localStats.empty > 0) {
        setRetryCount(localStats.empty);
        setShowRetryDialog(true);
      }
    }
  }, [queue, includeEnrich, includeDeepSearch, delaySeconds, selectedIds, extensionAvailable, checkExtension, extensionExtract, activeJobId, selectedCountries, selectedNetworks, runExtensionLoop, waitForExtension, verifySession]);

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

          {/* WCA Session Health Indicator */}
          {(pipelineStatus === "running" || pipelineStatus === "paused") && (
            <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md ${
              sessionHealth === "active" ? "bg-emerald-500/10 text-emerald-500" :
              sessionHealth === "checking" ? "bg-amber-500/10 text-amber-500" :
              sessionHealth === "recovering" ? "bg-amber-500/10 text-amber-500" :
              sessionHealth === "dead" ? "bg-destructive/10 text-destructive" :
              "bg-muted text-muted-foreground"
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                sessionHealth === "active" ? "bg-emerald-500" :
                sessionHealth === "checking" || sessionHealth === "recovering" ? "bg-amber-500 animate-pulse" :
                sessionHealth === "dead" ? "bg-destructive" :
                "bg-muted-foreground"
              }`} />
              <span>{
                sessionHealth === "active" ? "Sessione WCA attiva" :
                sessionHealth === "checking" ? "Verifica sessione..." :
                sessionHealth === "recovering" ? "Ripristino sessione..." :
                sessionHealth === "dead" ? "Sessione scaduta" :
                "Sessione non verificata"
              }</span>
            </div>
          )}

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

      {/* NETWORK PERFORMANCE BAR */}
      {Object.keys(networkStats).length > 0 && (
        <NetworkPerformanceBar
          stats={networkStats}
          excludedNetworks={excludedNetworks}
          onExclude={handleExcludeNetwork}
          onReinclude={handleReincludeNetwork}
        />
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
