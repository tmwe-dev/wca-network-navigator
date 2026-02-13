import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, Timer, Zap, ChevronDown, Settings2, RefreshCw, CheckCircle, Square,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { WCA_NETWORKS } from "@/data/wcaFilters";
import { getCountryFlag } from "@/lib/countries";
import { useCreateDownloadJob } from "@/hooks/useDownloadJobs";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";
import { scrapeWcaDirectory, type DirectoryMember, type DirectoryResult } from "@/lib/api/wcaScraper";
import { useTheme, t } from "./theme";
import { useScrapingSettings, buildDelayValues, buildDelayLabels } from "@/hooks/useScrapingSettings";
import { WcaSessionDialog } from "./WcaSessionIndicator";

interface ActionPanelProps {
  selectedCountries: { code: string; name: string }[];
}

export function ActionPanel({ selectedCountries }: ActionPanelProps) {
  const isDark = useTheme();
  const th = t(isDark);
  const queryClient = useQueryClient();
  const createJob = useCreateDownloadJob();
  const { status: wcaStatus, triggerCheck } = useWcaSessionStatus();
  const [showSessionDialog, setShowSessionDialog] = useState(false);

  const { settings: scrapingSettings } = useScrapingSettings();
  const DELAY_VALUES = buildDelayValues(scrapingSettings.delayMin, scrapingSettings.delayMax);
  const DELAY_LABELS = buildDelayLabels(DELAY_VALUES);

  // Network selection
  const [selectedNetwork, setSelectedNetwork] = useState<string>("__all__");
  const networks = selectedNetwork === "__all__" ? [] : [selectedNetwork];
  const networkKeys = networks.length > 0 ? networks : [""];

  const countryCodes = selectedCountries.map(c => c.code);

  // Speed — find closest index to default
  const defaultIdx = DELAY_VALUES.findIndex(v => v >= scrapingSettings.delayDefault);
  const [delayIndex, setDelayIndex] = useState(defaultIdx >= 0 ? defaultIdx : Math.floor(DELAY_VALUES.length / 2));
  const delay = DELAY_VALUES[delayIndex] ?? scrapingSettings.delayDefault;
  const [includeExisting, setIncludeExisting] = useState(false);

  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scannedMembers, setScannedMembers] = useState<DirectoryMember[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentCountryIdx, setCurrentCountryIdx] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [skippedCountries, setSkippedCountries] = useState<string[]>([]);
  const abortRef = useRef(false);

  // Load cached directory scan
  const { data: cachedEntries = [], isLoading: loadingCache } = useQuery({
    queryKey: ["directory-cache", countryCodes, networkKeys],
    queryFn: async () => {
      if (countryCodes.length === 0) return [];
      let q = supabase.from("directory_cache").select("*").in("country_code", countryCodes);
      if (networks.length > 0) q = q.in("network_name", networks);
      else q = q.eq("network_name", "");
      const { data } = await q;
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
      const { data: byCountry } = await supabase
        .from("partners")
        .select("wca_id, company_name, city, country_code, country_name, updated_at")
        .in("country_code", countryCodes)
        .not("wca_id", "is", null)
        .order("company_name");
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
  const idsToDownload = includeExisting ? uniqueIds : missingIds;

  // Time estimate
  const avgScrapeTime = scrapingSettings.avgScrapeTime;
  const totalTime = idsToDownload.length * (delay + avgScrapeTime);
  const estimateLabel = totalTime >= 3600
    ? `~${(totalTime / 3600).toFixed(1)} ore`
    : totalTime >= 60 ? `~${Math.ceil(totalTime / 60)} min` : `~${totalTime}s`;

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
  }, [countryCodes.join(",")]);

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

    for (let ci = 0; ci < selectedCountries.length; ci++) {
      if (abortRef.current) break;
      setCurrentCountryIdx(ci);
      const country = selectedCountries[ci];

      for (const netKey of networkKeys) {
        if (abortRef.current) break;
        let page = 1;
        let hasNext = true;
        let countryTotal = 0;
        let countryPages = 0;
        const countryMembers: DirectoryMember[] = [];
        let countryFailed = false;

        while (hasNext && !abortRef.current) {
          setCurrentPage(page);
          let result: DirectoryResult | null = null;
          let lastError = "";
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              result = await scrapeWcaDirectory(country.code, netKey, page);
              if (result.success) break;
              lastError = result.error || "Errore sconosciuto";
              result = null;
            } catch (err) {
              lastError = err instanceof Error ? err.message : "Errore di rete";
              result = null;
            }
            if (attempt < 3) await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
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
            setScannedMembers([...allMembers]);
          }
          countryTotal = result.pagination.total_results;
          countryPages = result.pagination.total_pages;
          hasNext = result.pagination.has_next_page || result.members.length >= 50;
          page++;
          if (hasNext && !abortRef.current) await new Promise(r => setTimeout(r, 0));
        }

        if (countryFailed) {
          const label = `${country.name} (${country.code})`;
          if (!skipped.includes(label)) { skipped.push(label); setSkippedCountries([...skipped]); }
        }
        if (countryMembers.length > 0) await saveScanToCache(country.code, netKey, countryMembers, countryTotal, countryPages);
      }
    }

    setIsScanning(false);
    setScanComplete(true);
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
    queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
  }, [selectedCountries, networkKeys, saveScanToCache, queryClient]);

  const handleStartDownload = async () => {
    const result = await triggerCheck();

    // Use the direct result from the check function
    if (result?.authenticated) {
      await executeDownload();
      return;
    }

    // Fallback: re-read DB in case cookie was updated right before/after check
    const { data: statusData } = await supabase.from("app_settings")
      .select("value").eq("key", "wca_session_status").maybeSingle();
    if (statusData?.value === "ok") {
      await executeDownload();
      return;
    }

    // Only show dialog if truly not authenticated
    setShowSessionDialog(true);
  };

  const executeDownload = async () => {
    if (idsToDownload.length === 0) {
      toast({ title: "Nessun partner da scaricare", description: "Tutti i partner sono già nel database." });
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
      await createJob.mutateAsync({
        country_code: country.code, country_name: country.name,
        network_name: networks.length > 0 ? networks.join(", ") : "Tutti",
        wca_ids: countryIds, delay_seconds: delay,
      });
    }
  };

  const handleSessionRetry = async () => {
    const { data: statusData } = await supabase.from("app_settings").select("value").eq("key", "wca_session_status").maybeSingle();
    if (statusData?.value === "ok") { setShowSessionDialog(false); toast({ title: "Sessione attiva!" }); }
  };

  const isLoading = loadingCache || loadingDb;

  // ── No countries selected ──
  if (selectedCountries.length === 0) {
    return (
      <div className={`${th.panel} border ${th.panelSlate} rounded-2xl p-6 text-center`}>
        <p className={`text-sm ${th.sub}`}>← Seleziona uno o più paesi per iniziare</p>
      </div>
    );
  }

  // ── Loading ──
  if (isLoading) {
    return (
      <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-6 flex items-center justify-center`}>
        <Loader2 className={`w-5 h-5 animate-spin ${th.sub}`} />
        <span className={`ml-2 text-sm ${th.sub}`}>Caricamento...</span>
      </div>
    );
  }

  // ── Scanning ──
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

  // ── Ready / Download panel ──
  const countryLabel = selectedCountries.length === 1
    ? `${getCountryFlag(selectedCountries[0].code)} ${selectedCountries[0].name}`
    : `${selectedCountries.length} paesi`;

  return (
    <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-5 space-y-4`}>
      {/* Header */}
      <div>
        <h3 className={`text-lg font-semibold ${th.h2}`}>Scarica Partner</h3>
        <p className={`text-sm ${th.sub}`}>{countryLabel}</p>
      </div>

      {/* Network selector */}
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

      {/* Summary */}
      <div className={`p-3 rounded-xl border space-y-2 ${th.infoBox}`}>
        <div className="flex items-center justify-between">
          <span className={`text-sm ${th.body}`}>Nella directory</span>
          <span className={`font-mono font-bold ${th.hi}`}>{totalCount}</span>
        </div>
        <div className={`h-px ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${th.acEm}`}>✓ Già scaricati</span>
          <span className={`font-mono font-bold ${th.acEm}`}>{downloadedCount}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className={`text-sm font-medium ${th.hi}`}>↓ Da scaricare</span>
          <span className={`font-mono font-bold ${th.hi}`}>{missingIds.length}</span>
        </div>
      </div>

      {/* Include existing toggle */}
      {downloadedCount > 0 && (
        <label className={`flex items-center gap-2 text-sm cursor-pointer ${th.body}`}>
          <Checkbox checked={includeExisting} onCheckedChange={v => setIncludeExisting(!!v)} />
          Ri-scarica anche i {downloadedCount} esistenti
        </label>
      )}

      {/* All downloaded */}
      {missingIds.length === 0 && !includeExisting && (
        <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
          ✅ Tutti scaricati! Spunta sopra per aggiornare.
        </div>
      )}

      {/* Speed */}
      {idsToDownload.length > 0 && (
        <div>
          <label className={`text-xs flex items-center gap-1.5 mb-2 ${th.label}`}>
            <Timer className="w-3.5 h-3.5" />
            Velocità: <span className={`font-mono font-bold ${th.hi}`}>{DELAY_LABELS[delay]}</span>
          </label>
          <Slider value={[delayIndex]} onValueChange={([v]) => setDelayIndex(v)} min={0} max={DELAY_VALUES.length - 1} step={1} />
          <div className={`flex justify-between text-xs mt-1 ${th.dim}`}>
            <span>Veloce</span><span>Lento</span>
          </div>
        </div>
      )}

      {/* Time estimate */}
      {idsToDownload.length > 0 && (
        <div className={`p-2 rounded-lg border text-center ${th.infoBox}`}>
          <p className={`text-xs ${th.dim}`}>Tempo stimato</p>
          <p className={`text-lg font-mono ${th.hi}`}>{estimateLabel}</p>
        </div>
      )}

      {/* Download button */}
      <Button
        onClick={handleStartDownload}
        disabled={idsToDownload.length === 0 || createJob.isPending}
        className={`w-full ${th.btnPri}`}
      >
        {createJob.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
        {idsToDownload.length > 0 ? `Scarica ${idsToDownload.length} partner` : "Tutti scaricati ✓"}
      </Button>

      {/* Rescan option */}
      {hasCache && (
        <Collapsible>
          <CollapsibleTrigger className={`flex items-center gap-1.5 text-xs w-full justify-center ${th.sub} hover:opacity-80`}>
            <Settings2 className="w-3.5 h-3.5" /> Opzioni <ChevronDown className="w-3 h-3" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Button variant="ghost" size="sm" onClick={() => { setScanComplete(false); setScannedMembers([]); handleStartScan(); }} className={`w-full text-xs ${th.btnPause}`}>
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Aggiorna dalla directory
            </Button>
          </CollapsibleContent>
        </Collapsible>
      )}

      {skippedCountries.length > 0 && (
        <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "bg-yellow-50 border-yellow-200 text-yellow-700"}`}>
          ⚠️ {skippedCountries.length} paesi saltati: {skippedCountries.join(', ')}
        </div>
      )}

      <WcaSessionDialog open={showSessionDialog} onOpenChange={setShowSessionDialog} onRetry={handleSessionRetry} />
    </div>
  );
}
