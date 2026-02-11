import { useState, useCallback, useRef, useEffect } from "react";
import { Play, Pause, Square, AlertTriangle, Plug, Mail, Phone, CheckCircle2, XCircle, RotateCcw } from "lucide-react";
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
        const networkFilter = selectedNetworks.length > 0 ? selectedNetworks : [""];

        for (const net of networkFilter) {
          // Check cache first
          let query = supabase
            .from("directory_cache")
            .select("*")
            .eq("country_code", code);

          if (net) query = query.eq("network_name", net);

          const { data: cached } = await query;

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
                  networkName: net || "WCA Inter Global",
                },
              }
            );

            if (scanResult?.members) {
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
    const MAX_CONSECUTIVE_EMPTY = 2;

    const items = queue.filter((q) => selectedIds.has(q.wca_id));
    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;

      // Pause loop
      while (pauseRef.current) {
        await new Promise((r) => setTimeout(r, 500));
        if (cancelRef.current) break;
      }
      if (cancelRef.current) break;

      const item = items[i];
      setActiveIndex(i);

      // Update queue status
      setQueue((prev) =>
        prev.map((q) =>
          q.wca_id === item.wca_id ? { ...q, status: "active" as const } : q
        )
      );

      try {
        // PHASE 1: Download
        setCanvasPhase("downloading");
        const { data: scrapeResult } = await supabase.functions.invoke(
          "scrape-wca-partners",
          { body: { wcaId: item.wca_id } }
        );

        // Build canvas data from result
        const partnerData = scrapeResult?.partner;
        // Contacts are nested inside partner, not at top level
        const contacts = partnerData?.contacts || scrapeResult?.contacts || [];

        // Save server contacts as fallback, but DON'T show them yet
        const serverContacts = contacts.map((c: any) => ({
          name: c.name || c.title || "Sconosciuto",
          title: c.title,
          email: c.email,
          direct_phone: c.phone || c.direct_phone,
          mobile: c.mobile,
        }));

        const canvas: CanvasData = {
          company_name: partnerData?.company_name || item.company_name,
          city: partnerData?.city || item.city,
          country_code: partnerData?.country_code || item.country_code,
          country_name: partnerData?.country_name || "",
          logo_url: partnerData?.logo_url,
          contacts: [],  // Empty: no red badges flash
          services: partnerData?.services || scrapeResult?.services || [],
          key_markets: [],
          key_routes: [],
          networks: (partnerData?.networks || scrapeResult?.networks || []).map((n: any) => n.network_name || n.name || n),
          rating: partnerData?.rating,
          website: partnerData?.website,
          profile_description: partnerData?.profile_description,
          linkedin_links: [],
          warehouse_sqm: undefined,
          employees: undefined,
          founded: undefined,
          fleet: undefined,
          contactSource: "none" as ContactSource,
        };
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
              console.log(`[Extension] ${item.company_name}: ${extResult.contacts.length} contacts extracted`);
            }
          } catch (extErr) {
            console.warn(`[Extension] Failed for ${item.wca_id}:`, extErr);
          }

          // FALLBACK: If canvas still has no real emails, check DB directly
          // (extension may have saved contacts via save-wca-contacts independently)
          if (canvas.contactSource !== "extension" || !canvas.contacts.some(c => c.email?.trim())) {
            try {
              const { data: dbPartner } = await supabase
                .from("partners")
                .select("id")
                .eq("wca_id", item.wca_id)
                .maybeSingle();

              if (dbPartner) {
                const { data: dbContacts } = await supabase
                  .from("partner_contacts")
                  .select("name, title, email, direct_phone, mobile")
                  .eq("partner_id", dbPartner.id);

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
                  console.log(`[DB Fallback] ${item.company_name}: ${dbContacts.length} contacts recovered from DB`);
                }
              }
            } catch { /* DB check failure is non-blocking */ }
          }
        } else {
          // Extension not available — show server contacts as fallback
          if (serverContacts.length > 0) {
            canvas.contacts = serverContacts;
            canvas.contactSource = "server";
            setCanvasData({ ...canvas });
          }
          if (!extensionWarningShown.current) {
            extensionWarningShown.current = true;
            toast({
              title: "Estensione Chrome non rilevata",
              description: "Installa l'estensione WCA Cookie Sync per estrarre email e telefoni privati automaticamente.",
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
                    prev
                      ? {
                          ...prev,
                          key_markets: ed.key_markets || [],
                          key_routes: ed.key_routes || [],
                          warehouse_sqm: ed.warehouse_sqm,
                          employees: ed.employees,
                          founded: ed.year_founded,
                          fleet: ed.own_fleet,
                        }
                      : prev
                  );
                }
              } catch {
                /* enrichment failure is non-blocking */
              }
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
                    prev
                      ? {
                          ...prev,
                          logo_url: deepResult.logo_url || prev.logo_url,
                          linkedin_links: (deepResult.social_links || [])
                            .filter((l: any) => l.platform === "linkedin")
                            .map((l: any) => ({ name: l.contact_name || "LinkedIn", url: l.url })),
                        }
                      : prev
                  );
                }
              } catch {
                /* deep search failure is non-blocking */
              }
            })()
          );
        }

        if (parallelTasks.length > 0) {
          setCanvasPhase("enriching");
          await Promise.all(parallelTasks);
        }

        // COMPLETE
        setCanvasPhase("complete");

        // Wait a moment to show completed state
        await new Promise((r) => setTimeout(r, 1000));

        // Comet animation
        setIsAnimatingOut(true);
        setShowComet(true);
        await new Promise((r) => setTimeout(r, 600));
        setShowComet(false);
        setIsAnimatingOut(false);
        setCompletedCount((c) => c + 1);

        // Track quality + consecutive empty detection + live stats
        const contactsWithEmail = canvas.contacts.filter(c => !!c.email?.trim());
        const contactsWithPhone = canvas.contacts.filter(c => !!(c.direct_phone?.trim() || c.mobile?.trim()));
        const hasAnyContact = contactsWithEmail.length > 0 || contactsWithPhone.length > 0;
        const hasComplete = canvas.contacts.some((c) => {
          return !!c.email?.trim() && !!(c.direct_phone?.trim() || c.mobile?.trim());
        });

        setLiveStats(prev => ({
          processed: prev.processed + 1,
          withEmail: prev.withEmail + (contactsWithEmail.length > 0 ? 1 : 0),
          withPhone: prev.withPhone + (contactsWithPhone.length > 0 ? 1 : 0),
          complete: prev.complete + (hasComplete ? 1 : 0),
          empty: prev.empty + (!hasAnyContact && canvas.contacts.length === 0 ? 1 : 0),
        }));

        if (hasComplete) {
          setQualityComplete((v) => v + 1);
          consecutiveNoContacts = 0;
        } else {
          setQualityIncomplete((v) => v + 1);
          if (!hasAnyContact) {
            consecutiveNoContacts++;
          } else {
            consecutiveNoContacts = 0;
          }
        }

        // Re-check session after first partner with no contacts
        if (i === 0 && !hasAnyContact && canvas.contacts.length === 0) {
          const recheck = await triggerCheck();
          if (!recheck || recheck.status !== "ok") {
            pauseRef.current = true;
            setPipelineStatus("paused");
            setShowSessionAlert(true);
            while (pauseRef.current) {
              await new Promise((r) => setTimeout(r, 500));
              if (cancelRef.current) break;
            }
            if (cancelRef.current) break;
          }
        }

        // Auto-pause if too many consecutive partners with no contacts
        if (consecutiveNoContacts >= MAX_CONSECUTIVE_EMPTY) {
          pauseRef.current = true;
          setPipelineStatus("paused");
          toast({
            title: "⚠️ Qualità dati sospetta",
            description: `${MAX_CONSECUTIVE_EMPTY} partner consecutivi senza contatti. Sessione WCA scaduta? Verifica e riprendi.`,
            variant: "destructive",
          });
          // Wait for user to resume or cancel
          while (pauseRef.current) {
            await new Promise((r) => setTimeout(r, 500));
            if (cancelRef.current) break;
          }
          if (cancelRef.current) break;
          consecutiveNoContacts = 0; // Reset after resume
        }

        // Mark done
        setQueue((prev) =>
          prev.map((q) =>
            q.wca_id === item.wca_id ? { ...q, status: "done" as const } : q
          )
        );

        // Delay before next
        if (delaySeconds > 0 && i < items.length - 1) {
          await new Promise((r) => setTimeout(r, delaySeconds * 1000));
        }
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((q) =>
            q.wca_id === item.wca_id ? { ...q, status: "error" as const } : q
          )
        );
        console.error(`Pipeline error for ${item.wca_id}:`, err);
      }
    }

    setCanvasPhase("idle");
    setCanvasData(null);

    // Count actually processed items
    const processedItems = queue.filter((q) => q.status === "done").length;

    if (cancelRef.current) {
      setPipelineStatus("idle");
      toast({
        title: "Acquisizione interrotta",
        description: `${processedItems} partner processati su ${items.length} selezionati`,
        variant: "destructive",
      });
    } else {
      setPipelineStatus("done");
      toast({
        title: "Acquisizione completata!",
        description: `${processedItems} partner processati — Completi: ${qualityComplete}, Incompleti: ${qualityIncomplete}`,
      });

      // Check for incomplete partners and offer retry
      if (liveStats.empty > 0 && !cancelRef.current) {
        setRetryCount(liveStats.empty);
        setShowRetryDialog(true);
      }
    }
  }, [queue, includeEnrich, includeDeepSearch, delaySeconds, triggerCheck, selectedIds, extensionAvailable, checkExtension, extensionExtract]);

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
                  setPipelineStatus(pauseRef.current ? "paused" : "running");
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
