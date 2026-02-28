import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Timer, Zap, ChevronDown, Settings2, RefreshCw, CheckCircle, Square, FolderDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { WCA_NETWORKS } from "@/data/wcaFilters";
import { getCountryFlag } from "@/lib/countries";
import { useCreateDownloadJob } from "@/hooks/useDownloadJobs";
import { useWcaSession } from "@/hooks/useWcaSession";
import { scrapeWcaDirectory, type DirectoryMember, type DirectoryResult } from "@/lib/api/wcaScraper";
import { useTheme, t } from "./theme";
// useScrapingSettings and useUpdateSetting removed — deprecated


interface ActionPanelProps {
  selectedCountries: { code: string; name: string }[];
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
  onJobCreated?: (jobId: string) => void;
}

export function ActionPanel({ selectedCountries, directoryOnly: directoryOnlyProp, onDirectoryOnlyChange, onJobCreated }: ActionPanelProps) {
  const isDark = useTheme();
  const th = t(isDark);
  const queryClient = useQueryClient();
  const createJob = useCreateDownloadJob();
  const { ensureSession } = useWcaSession();

  // Network selection
  const [selectedNetwork, setSelectedNetwork] = useState<string>("__all__");
  const networks = selectedNetwork === "__all__" ? [] : [selectedNetwork];
  const networkKeys = networks.length > 0 ? networks : [""];

  const countryCodes = selectedCountries.map(c => c.code);

  // Speed — simple slider around baseDelay
  const [delay, setDelay] = useState(15);
  type DownloadMode = "new" | "no_profile" | "all";
  const [downloadMode, setDownloadMode] = useState<DownloadMode>("new");
  const directoryOnly = directoryOnlyProp ?? false;
  const setDirectoryOnly = onDirectoryOnlyChange ?? (() => {});

  // Scanning state
  const [skipCachedDirs, setSkipCachedDirs] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scannedMembers, setScannedMembers] = useState<DirectoryMember[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentCountryIdx, setCurrentCountryIdx] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [skippedCountries, setSkippedCountries] = useState<string[]>([]);
  const abortRef = useRef(false);

  // Directory + Download mode
  const [dirThenDownload, setDirThenDownload] = useState(false);
  const [autoDownloadPending, setAutoDownloadPending] = useState(false);

  // Load cached directory scan
  const { data: cachedEntries = [], isLoading: loadingCache } = useQuery({
    queryKey: ["directory-cache", countryCodes, networkKeys],
    queryFn: async () => {
      if (countryCodes.length === 0) return [];
      let q = supabase.from("directory_cache").select("*").in("country_code", countryCodes);
      if (networks.length > 0) q = q.in("network_name", networks);
      else q = q.eq("network_name", "");
      const { data, error } = await q;
      if (error) { toast({ title: "Errore directory cache", description: error.message, variant: "destructive" }); return []; }
      return data || [];
    },
    staleTime: 30_000,
    enabled: countryCodes.length > 0,
  });

  // Load partners already in DB
  const { data: dbPartners = [], isLoading: loadingDb } = useQuery({
    queryKey: ["db-partners-for-countries", countryCodes],
    queryFn: async () => {
      if (countryCodes.length === 0) return [];
      const { data: byCountry, error } = await supabase
        .from("partners")
        .select("wca_id, company_name, city, country_code, country_name, updated_at")
        .in("country_code", countryCodes)
        .not("wca_id", "is", null)
        .order("company_name");
      if (error) { toast({ title: "Errore caricamento partner", description: error.message, variant: "destructive" }); return []; }
      return (byCountry || []).map(p => ({
        wca_id: p.wca_id!,
        company_name: p.company_name,
        city: p.city,
        country_code: p.country_code,
        country_name: p.country_name,
        updated_at: p.updated_at,
      }));
    },
    staleTime: 30_000,
    enabled: countryCodes.length > 0,
  });

  // Load wca_ids of partners WITHOUT profile (lightweight query)
  const { data: noProfileIds = [] } = useQuery({
    queryKey: ["no-profile-wca-ids", countryCodes],
    queryFn: async () => {
      if (countryCodes.length === 0) return [];
      const { data } = await supabase
        .from("partners")
        .select("wca_id")
        .in("country_code", countryCodes)
        .not("wca_id", "is", null)
        .is("raw_profile_html", null);
      return (data || []).map(p => p.wca_id!);
    },
    staleTime: 30_000,
    enabled: countryCodes.length > 0,
  });

  const cachedMembers: DirectoryMember[] = cachedEntries.flatMap((entry: any) => {
    const members = entry.members as any[];
    return (members || []).map((m: any) => ({
      company_name: m.company_name,
      city: m.city,
      country: m.country,
      country_code: m.country_code || entry.country_code,
      wca_id: m.wca_id,
    }));
  });

  const hasCache = cachedMembers.length > 0;
  const dbWcaSet = new Set(dbPartners.map(p => p.wca_id));
  const sourceMembers = scanComplete ? scannedMembers : cachedMembers;
  const allIds = sourceMembers.filter(m => m.wca_id).map(m => m.wca_id!);
  const uniqueIds = [...new Set(allIds)];
  const missingIds = uniqueIds.filter(id => !dbWcaSet.has(id));
  const downloadedCount = uniqueIds.filter(id => dbWcaSet.has(id)).length;
  const totalCount = uniqueIds.length;

  // Set of wca_ids without profile for precise filtering
  const noProfileWcaSet = useMemo(() => new Set(noProfileIds), [noProfileIds]);

  // Count of partners in directory that are missing profiles
  const noProfileInDirectoryCount = useMemo(() => {
    return uniqueIds.filter(id => noProfileWcaSet.has(id)).length;
  }, [uniqueIds, noProfileWcaSet]);

  // Also count new partners (not in DB at all) as needing profile
  const noProfileTotalCount = noProfileInDirectoryCount + missingIds.length;

  // IDs to download based on mode
  const idsToDownload = useMemo(() => {
    if (downloadMode === "all") return uniqueIds;
    if (downloadMode === "no_profile") {
      // Only partners in directory that are missing profile + completely new ones
      const existingNoProfile = uniqueIds.filter(id => noProfileWcaSet.has(id));
      return [...new Set([...missingIds, ...existingNoProfile])];
    }
    return missingIds; // "new" mode
  }, [downloadMode, uniqueIds, missingIds, noProfileWcaSet]);

  // Time estimate
  const totalTime = idsToDownload.length * (delay + 5);
  const estimateLabel = totalTime >= 3600
    ? `~${(totalTime / 3600).toFixed(1)} ore`
    : totalTime >= 60 ? `~${Math.ceil(totalTime / 60)} min` : `~${totalTime}s`;

  // Auto-select no_profile mode when no new partners but profiles are missing
  useEffect(() => {
    if (missingIds.length === 0 && noProfileInDirectoryCount > 0 && downloadMode === "new") {
      setDownloadMode("no_profile");
    }
  }, [missingIds.length, noProfileInDirectoryCount, downloadMode]);

  // Auto-scan if no cache
  useEffect(() => {
    if (countryCodes.length > 0 && !loadingCache && !loadingDb && !hasCache && !isScanning && !scanComplete) {
      handleStartScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCache, loadingDb, hasCache, countryCodes.length]);

  // Reset scan state when countries change
  useEffect(() => {
    setScanComplete(false);
    setScannedMembers([]);
    setScanError(null);
    setSkippedCountries([]);
    setAutoDownloadPending(false);
  }, [countryCodes.join(",")]);

  // Auto-download after scan completes in "Directory + Download" mode
  // Step: cleanup stale partners from DB, then force no_profile download
  useEffect(() => {
    if (!autoDownloadPending || !scanComplete || isScanning) return;
    setAutoDownloadPending(false);

    const runCleanupAndDownload = async () => {
      // 1. Collect fresh WCA IDs from scan
      const freshWcaIds = new Set(
        scannedMembers.filter(m => m.wca_id).map(m => m.wca_id!)
      );

      if (freshWcaIds.size === 0) {
        toast({ title: "⚠️ Nessun partner trovato nella directory", variant: "destructive" });
        return;
      }

      // 2. Get all DB partners for the selected countries
      const { data: dbPartnersForCleanup } = await supabase
        .from("partners")
        .select("id, wca_id")
        .in("country_code", countryCodes)
        .not("wca_id", "is", null);

      const dbList = dbPartnersForCleanup || [];
      
      // 3. Find stale partners (in DB but NOT in fresh directory)
      const stalePartners = dbList.filter(p => p.wca_id && !freshWcaIds.has(p.wca_id));
      
      let removedCount = 0;
      if (stalePartners.length > 0) {
        const staleIds = stalePartners.map(p => p.id);
        
        // Delete child tables first (no CASCADE)
        // Process in batches of 50 to avoid URL length limits
        for (let i = 0; i < staleIds.length; i += 50) {
          const batch = staleIds.slice(i, i + 50);
          await supabase.from("partner_contacts").delete().in("partner_id", batch);
          await supabase.from("partner_networks").delete().in("partner_id", batch);
          await supabase.from("partner_services").delete().in("partner_id", batch);
          await supabase.from("partner_certifications").delete().in("partner_id", batch);
          await supabase.from("partner_social_links").delete().in("partner_id", batch);
          await supabase.from("interactions").delete().in("partner_id", batch);
          await supabase.from("reminders").delete().in("partner_id", batch);
          await supabase.from("activities").delete().in("partner_id", batch);
          // Now delete the partner itself
          await supabase.from("partners").delete().in("id", batch);
        }
        removedCount = stalePartners.length;
      }

      // 4. Invalidate queries to refresh counts
      await queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
      await queryClient.invalidateQueries({ queryKey: ["no-profile-wca-ids"] });
      await queryClient.invalidateQueries({ queryKey: ["partners"] });
      await queryClient.invalidateQueries({ queryKey: ["partner-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["country-stats"] });

      // 5. Force no_profile mode for the download
      setDownloadMode("no_profile");

      // 6. Show summary
      const remaining = dbList.length - removedCount;
      toast({
        title: "🧹 Pulizia completata",
        description: `Directory: ${freshWcaIds.size} partner reali. ${removedCount > 0 ? `Rimossi ${removedCount} obsoleti. ` : ""}Avvio download profili mancanti...`,
      });

      // 7. Wait for queries to refresh, then start download
      await new Promise(r => setTimeout(r, 2000));
      await handleStartDownload();
    };

    const timer = setTimeout(runCleanupAndDownload, 1000);
    return () => clearTimeout(timer);
  }, [autoDownloadPending, scanComplete, isScanning]);

  const saveScanToCache = useCallback(async (countryCode: string, netKey: string, scanned: DirectoryMember[], total: number, pages: number) => {
    const membersJson = scanned.map(m => ({ company_name: m.company_name, city: m.city, country: m.country, country_code: m.country_code, wca_id: m.wca_id }));
    await supabase.from("directory_cache").upsert({
      country_code: countryCode, network_name: netKey, members: membersJson as any,
      total_results: total, total_pages: pages, scanned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: "country_code,network_name" });
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
  }, [queryClient]);

  const handleStartScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    setSkippedCountries([]);
    abortRef.current = false;
    const allMembers: DirectoryMember[] = [];
    const skipped: string[] = [];

    // Helper: wait while tab is hidden (pause on blur)
    const waitIfHidden = () => new Promise<void>((resolve) => {
      if (!document.hidden) { resolve(); return; }
      const handler = () => {
        if (!document.hidden) {
          document.removeEventListener("visibilitychange", handler);
          resolve();
        }
      };
      document.addEventListener("visibilitychange", handler);
    });

    // Build set of already-cached country codes to skip
    const cachedCountryCodes = new Set(cachedEntries.map((e: any) => e.country_code));

    for (let ci = 0; ci < selectedCountries.length; ci++) {
      if (abortRef.current) break;
      setCurrentCountryIdx(ci);
      const country = selectedCountries[ci];

      // Skip countries with existing directory cache if option is enabled
      if (skipCachedDirs && cachedCountryCodes.has(country.code)) {
        continue;
      }

      // Memory protection: every 5 countries, trim intermediate state
      if (ci > 0 && ci % 5 === 0) {
        setScannedMembers([...allMembers]); // force re-render with clean copy
      }

      for (const netKey of networkKeys) {
        if (abortRef.current) break;
        let page = 1;
        let hasNext = true;
        let countryTotal = 0;
        let countryPages = 0;
        const countryMembers: DirectoryMember[] = [];
        let countryFailed = false;

        while (hasNext && !abortRef.current) {
          // Pause if tab is hidden
          await waitIfHidden();

          setCurrentPage(page);
          let result: DirectoryResult | null = null;
          let lastError = "";
          try {
            result = await scrapeWcaDirectory(country.code, netKey, page);
            if (!result.success) {
              lastError = result.error || "Errore sconosciuto";
              result = null;
            }
          } catch (err) {
            lastError = err instanceof Error ? err.message : "Errore di rete";
            result = null;
          }

          if (!result || !result.success) {
            setScanError(`${country.name}: ${lastError}`);
            countryFailed = true;
            break;
          }

          if (result.members.length > 0) {
            const newMembers = result.members.map(m => ({ ...m, country: m.country || country.name, country_code: country.code }));
            countryMembers.push(...newMembers);
            allMembers.push(...newMembers);
            // Only update UI every 100 members to reduce re-renders
            if (allMembers.length % 100 < 50) setScannedMembers([...allMembers]);
          }
          countryTotal = result.pagination.total_results;
          countryPages = result.pagination.total_pages;
          hasNext = result.pagination.has_next_page || result.members.length >= 50;
          page++;
          if (hasNext && !abortRef.current) await new Promise(r => setTimeout(r, Math.max(delay * 1000, 3000)));
        }

        if (countryFailed) {
          const label = `${country.name} (${country.code})`;
          if (!skipped.includes(label)) { skipped.push(label); setSkippedCountries([...skipped]); }
        }
        if (countryMembers.length > 0) await saveScanToCache(country.code, netKey, countryMembers, countryTotal, countryPages);
      }

      // Pause between countries (use delay slider, minimum 10s)
      if (ci < selectedCountries.length - 1 && !abortRef.current) {
        await waitIfHidden();
        await new Promise(r => setTimeout(r, Math.max(delay * 1000, 10000)));
      }
    }

    // Final sync of all members
    setScannedMembers([...allMembers]);

    setIsScanning(false);
    setScanComplete(true);
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
    queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
  }, [selectedCountries, networkKeys, saveScanToCache, queryClient, skipCachedDirs, cachedEntries]);

  const handleStartDownload = async () => {
    // Silent session check + auto-login
    const sessionOk = await ensureSession();
    if (!sessionOk) {
      toast({ title: "Sessione WCA non attiva", description: "Effettua il login su wcaworld.com o verifica le credenziali nelle impostazioni.", variant: "destructive" });
      return;
    }
    await executeDownload();
  };

  const executeDownload = async () => {
    if (idsToDownload.length === 0) {
      toast({ title: "Nessun partner da scaricare", description: "Tutti i partner sono già nel database." });
      return;
    }

    const { data: activeJobs } = await supabase
      .from("download_jobs")
      .select("id")
      .in("status", ["pending", "running"])
      .limit(1);

    if (activeJobs && activeJobs.length > 0) {
      toast({
        title: "Job già in corso",
        description: "Attendi il completamento del job attuale prima di avviarne un altro.",
        variant: "destructive",
      });
      return;
    }

    const idsByCountry = new Map<string, number[]>();
    for (const m of sourceMembers) {
      if (!m.wca_id || !idsToDownload.includes(m.wca_id)) continue;
      const cc = m.country_code || selectedCountries.find(c => c.name === m.country || c.code === m.country)?.code;
      if (!cc) continue;
      if (!idsByCountry.has(cc)) idsByCountry.set(cc, []);
      idsByCountry.get(cc)!.push(m.wca_id);
    }
    for (const country of selectedCountries) {
      const countryIds = idsByCountry.get(country.code) || [];
      if (countryIds.length === 0) continue;
      const jobId = await createJob.mutateAsync({
        country_code: country.code, country_name: country.name,
        network_name: networks.length > 0 ? networks.join(", ") : "Tutti",
        wca_ids: countryIds, delay_seconds: Math.max(delay, 10),
      });
      if (jobId && onJobCreated) onJobCreated(jobId);
    }
  };


  const isLoading = loadingCache || loadingDb;

  if (selectedCountries.length === 0) {
    return (
      <div className={`${th.panel} border ${th.panelSlate} rounded-2xl p-6 text-center`}>
        <p className={`text-sm ${th.sub}`}>← Seleziona uno o più paesi per iniziare</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-6 flex items-center justify-center`}>
        <Loader2 className={`w-5 h-5 animate-spin ${th.sub}`} />
        <span className={`ml-2 text-sm ${th.sub}`}>Caricamento...</span>
      </div>
    );
  }

  if (isScanning) {
    return (
      <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-6 space-y-4 text-center`}>
        <Loader2 className={`w-8 h-8 animate-spin mx-auto ${th.acAmber}`} />
        <div>
          <h3 className={`text-lg mb-1 ${th.h2}`}>Scansione directory...</h3>
          <p className={`text-sm ${th.sub}`}>
            {selectedCountries.length > 1 && `Paese ${currentCountryIdx + 1}/${selectedCountries.length}: `}
            {selectedCountries[currentCountryIdx]?.name} — Pagina {currentPage}
          </p>
          {scannedMembers.length > 0 && (
            <p className={`text-lg font-mono mt-2 ${th.hi}`}>{scannedMembers.length} partner trovati</p>
          )}
        </div>
        {scanError && (
          <div className={`p-3 rounded-lg border text-sm text-left ${isDark ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
            ⚠️ {scanError}
          </div>
        )}
        <Button variant="ghost" onClick={() => { abortRef.current = true; setIsScanning(false); setScanComplete(true); }} className={th.btnStop}>
          <Square className="w-4 h-4 mr-1" /> Interrompi
        </Button>
      </div>
    );
  }

  const countryLabel = selectedCountries.length === 1
    ? `${getCountryFlag(selectedCountries[0].code)} ${selectedCountries[0].name}`
    : `${selectedCountries.length} paesi`;

  return (
    <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-5 space-y-4`}>
      {/* Anti-detection toggle */}



      <div>
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${th.h2}`}>Scarica Partner</h3>
          <label className={`flex items-center gap-2 text-xs cursor-pointer ${th.body}`}>
            <Switch checked={directoryOnly} onCheckedChange={v => setDirectoryOnly(v)} />
            <span className="flex items-center gap-1">
              <FolderDown className="w-3.5 h-3.5" />
              Solo Directory
            </span>
          </label>
        </div>
        <p className={`text-sm ${th.sub}`}>{countryLabel}</p>
        {directoryOnly && (
          <div className={`p-2 rounded-lg border text-xs ${isDark ? "bg-sky-500/10 border-sky-500/20 text-sky-300" : "bg-sky-50 border-sky-200 text-sky-700"}`}>
            💡 Scarica solo l'elenco aziende dalla directory WCA senza aprire i singoli profili
          </div>
        )}
      </div>

      <div>
        <label className={`text-xs mb-1.5 block ${th.label}`}>Network</label>
        <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
          <SelectTrigger className={`${th.selTrigger}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={th.selContent}>
            <SelectItem value="__all__">Tutti i network</SelectItem>
            {WCA_NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className={`p-3 rounded-xl border space-y-1 ${th.infoBox}`}>
        <div
          onClick={() => !directoryOnly && setDownloadMode("all")}
          className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-all ${
            !directoryOnly ? "cursor-pointer hover:opacity-80" : ""
          } ${!directoryOnly && downloadMode === "all"
            ? (isDark ? "bg-amber-500/15 border-l-2 border-amber-400" : "bg-amber-50 border-l-2 border-amber-500")
            : ""
          }`}
        >
          <span className={`text-sm ${th.body}`}>Nella directory</span>
          <span className={`font-mono font-bold ${th.hi}`}>{totalCount}</span>
        </div>
        {!directoryOnly && (
          <>
            <div className={`h-px ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
            <div className="flex items-center justify-between px-2 py-1.5">
              <span className={`text-sm font-medium ${th.acEm}`}>✓ Con profilo</span>
              <span className={`font-mono font-bold ${th.acEm}`}>{downloadedCount - noProfileInDirectoryCount}</span>
            </div>
            {noProfileInDirectoryCount > 0 && (
              <div
                onClick={() => setDownloadMode("no_profile")}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80 ${
                  downloadMode === "no_profile"
                    ? (isDark ? "bg-orange-500/15 border-l-2 border-orange-400" : "bg-orange-50 border-l-2 border-orange-500")
                    : ""
                }`}
              >
                <span className={`text-sm font-medium ${isDark ? "text-orange-400" : "text-orange-600"}`}>⚠ Senza profilo</span>
                <span className={`font-mono font-bold ${isDark ? "text-orange-400" : "text-orange-600"}`}>{noProfileInDirectoryCount}</span>
              </div>
            )}
            {missingIds.length > 0 && (
              <div
                onClick={() => setDownloadMode("new")}
                className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80 ${
                  downloadMode === "new"
                    ? (isDark ? "bg-sky-500/15 border-l-2 border-sky-400" : "bg-sky-50 border-l-2 border-sky-500")
                    : ""
                }`}
              >
                <span className={`text-sm font-medium ${th.hi}`}>↓ Mai scaricati</span>
                <span className={`font-mono font-bold ${th.hi}`}>{missingIds.length}</span>
              </div>
            )}
          </>
        )}
      </div>

      {directoryOnly ? (
        /* ── Directory-only mode: just scan button ── */
        <>
          {hasCache && totalCount > 0 ? (
            <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              ✅ Directory già scaricata: {totalCount} aziende trovate
            </div>
          ) : null}
          <label className={`flex items-center gap-2 text-sm cursor-pointer ${th.body}`}>
            <Switch checked={skipCachedDirs} onCheckedChange={setSkipCachedDirs} />
            Salta directory già scaricate
          </label>
          <label className={`flex items-center gap-2 text-sm cursor-pointer ${th.body}`}>
            <Switch checked={dirThenDownload} onCheckedChange={setDirThenDownload} />
            <span className="flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Scarica dopo scansione
            </span>
          </label>
          {dirThenDownload && (
            <div className={`p-2 rounded-lg border text-xs ${isDark ? "bg-amber-500/10 border-amber-500/20 text-amber-300" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              ⚡ Dopo la scansione, partirà automaticamente il download dei profili mancanti
            </div>
          )}
          <Button
            onClick={() => {
              if (dirThenDownload) {
                setAutoDownloadPending(true);
              }
              handleStartScan();
            }}
            disabled={isScanning}
            className={`w-full ${th.btnPri}`}
          >
            <FolderDown className="w-4 h-4 mr-2" />
            {dirThenDownload
              ? (hasCache ? "Aggiorna e Scarica" : "Scansiona e Scarica")
              : (hasCache ? "Aggiorna Directory" : "Scarica Directory")
            }
          </Button>
        </>
      ) : (
        /* ── Full download mode ── */
        <>
          <div>
            <label className={`text-xs mb-1.5 block ${th.label}`}>Modalità download</label>
            <Select value={downloadMode} onValueChange={v => setDownloadMode(v as DownloadMode)}>
              <SelectTrigger className={`${th.selTrigger}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="new">Mai scaricati ({missingIds.length})</SelectItem>
                <SelectItem value="no_profile">Senza profilo ({noProfileInDirectoryCount})</SelectItem>
                <SelectItem value="all">Riscansiona tutti ({totalCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {missingIds.length === 0 && downloadMode === "new" && (
            <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              ✅ Tutti scaricati! Cambia modalità per aggiornare.
            </div>
          )}

          {idsToDownload.length > 0 && (
            <div>
              <label className={`text-xs flex items-center gap-1.5 mb-2 ${th.label}`}>
                <Timer className="w-3.5 h-3.5" />
                Delay: <span className={`font-mono font-bold ${th.hi}`}>{delay}s</span>
              </label>
              <Slider value={[delay]} onValueChange={([v]) => setDelay(v)} min={10} max={60} step={1} />
              <div className={`flex justify-between text-xs mt-1 ${th.dim}`}>
                <span>Veloce</span><span>Lento</span>
              </div>
            </div>
          )}

          {idsToDownload.length > 0 && (
            <div className={`p-2 rounded-lg border text-center ${th.infoBox}`}>
              <p className={`text-xs ${th.dim}`}>Tempo stimato</p>
              <p className={`text-lg font-mono ${th.hi}`}>{estimateLabel}</p>
            </div>
          )}

          <Button
            onClick={handleStartDownload}
            disabled={idsToDownload.length === 0 || createJob.isPending}
            className={`w-full ${th.btnPri}`}
          >
            {createJob.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Avvio...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" />
                {downloadMode === "new" && `Scarica ${idsToDownload.length} partner (nuovi)`}
                {downloadMode === "no_profile" && `Scarica ${idsToDownload.length} partner (profili)`}
                {downloadMode === "all" && `Riscansiona ${idsToDownload.length} partner`}
              </>
            )}
          </Button>
        </>
      )}

      {skippedCountries.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className={`flex items-center gap-1 text-xs ${th.dim}`}>
            <ChevronDown className="w-3 h-3" /> {skippedCountries.length} paesi saltati
          </CollapsibleTrigger>
          <CollapsibleContent className={`mt-1 text-xs space-y-0.5 ${th.dim}`}>
            {skippedCountries.map(s => <p key={s}>• {s}</p>)}
            <Button size="sm" variant="ghost" onClick={handleStartScan} className={`h-6 text-xs mt-1 ${th.dim}`}>
              <RefreshCw className="w-3 h-3 mr-1" /> Riprova
            </Button>
          </CollapsibleContent>
        </Collapsible>
      )}

      {hasCache && !scanComplete && (
        <div className="text-center">
          <Button size="sm" variant="ghost" onClick={handleStartScan} className={`text-xs ${th.dim}`}>
            <RefreshCw className="w-3 h-3 mr-1" /> Aggiorna scansione
          </Button>
        </div>
      )}

    </div>
  );
}
