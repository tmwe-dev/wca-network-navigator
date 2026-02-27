import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { SendEmailDialog } from "@/components/operations/SendEmailDialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, Phone, Mail, ChevronRight, Users, Loader2,
  FileText, Trophy, Wand2, Send, Download, Telescope, Building2, UserCircle,
  Zap, Timer, FolderDown, RefreshCw, Square, CheckCircle2,
} from "lucide-react";
import { usePartners, useToggleFavorite } from "@/hooks/usePartners";
import { useCountryStats } from "@/hooks/useCountryStats";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { getCountryFlag, getYearsMember } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { t } from "@/components/download/theme";
import { WCA_NETWORKS } from "@/data/wcaFilters";
import { useCreateDownloadJob } from "@/hooks/useDownloadJobs";
import { useWcaSession } from "@/hooks/useWcaSession";
import { scrapeWcaDirectory, type DirectoryMember, type DirectoryResult } from "@/lib/api/wcaScraper";
import { DownloadTerminal } from "@/components/download/DownloadTerminal";
import { JobMonitor } from "@/components/download/JobMonitor";
import { MiniStars } from "@/components/partners/shared/MiniStars";

/* ── Props ── */
interface PartnerListPanelProps {
  countryCode: string;
  countryName: string;
  isDark: boolean;
  onDeepSearch?: (partnerIds: string[]) => void;
  onGenerateAliases?: (countryCodes: string[], type: "company" | "contact") => void;
  deepSearchRunning?: boolean;
  aliasGenerating?: boolean;
  onJobCreated?: (jobId: string) => void;
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
  onSelectPartner?: (id: string | null) => void;
  selectedPartnerId?: string | null;
}

export function PartnerListPanel({
  countryCode, countryName, isDark,
  onDeepSearch, onGenerateAliases,
  deepSearchRunning, aliasGenerating,
  onJobCreated, directoryOnly: directoryOnlyProp, onDirectoryOnlyChange,
  onSelectPartner, selectedPartnerId,
}: PartnerListPanelProps) {
  const th = t(isDark);
  const countryCodes = useMemo(() => countryCode ? [countryCode] : [], [countryCode]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name_asc" | "rating_desc" | "contacts_desc">("name_asc");
  type ProgressFilterKey = "profiles" | "deep" | "email" | "phone" | "alias_co" | "alias_ct" | null;
  const [progressFilter, setProgressFilter] = useState<ProgressFilterKey>(null);
  const [emailTarget, setEmailTarget] = useState<{ email: string; name: string; company: string; partnerId: string } | null>(null);

  const { data: partners, isLoading } = usePartners({
    countries: countryCodes,
    search: search.length >= 2 ? search : undefined,
  });

  const toggleFavorite = useToggleFavorite();
  const queryClient = useQueryClient();

  /* ════════════════════════════════════════════
   * DOWNLOAD LOGIC
   * ════════════════════════════════════════════ */
  const createJob = useCreateDownloadJob();
  const { ensureSession } = useWcaSession();
  const [selectedNetwork, setSelectedNetwork] = useState<string>("__all__");
  const networks = selectedNetwork === "__all__" ? [] : [selectedNetwork];
  const networkKeys = networks.length > 0 ? networks : [""];
  const [delay, setDelay] = useState(15);
  type DownloadMode = "new" | "no_profile" | "all";
  const [downloadMode, setDownloadMode] = useState<DownloadMode>("new");
  const directoryOnly = directoryOnlyProp ?? false;
  const setDirectoryOnly = onDirectoryOnlyChange ?? (() => {});
  const [skipCachedDirs, setSkipCachedDirs] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scannedMembers, setScannedMembers] = useState<DirectoryMember[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const abortRef = useRef(false);
  const [dirThenDownload, setDirThenDownload] = useState(false);
  const [autoDownloadPending, setAutoDownloadPending] = useState(false);

  const { data: cachedEntries = [] } = useQuery({
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

  const { data: dbPartners = [] } = useQuery({
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
        wca_id: p.wca_id!, company_name: p.company_name, city: p.city,
        country_code: p.country_code, country_name: p.country_name, updated_at: p.updated_at,
      }));
    },
    staleTime: 30_000,
    enabled: countryCodes.length > 0,
  });

  const { data: noProfileIds = [] } = useQuery({
    queryKey: ["no-profile-wca-ids", countryCodes],
    queryFn: async () => {
      if (countryCodes.length === 0) return [];
      const { data } = await supabase
        .from("partners").select("wca_id")
        .in("country_code", countryCodes).not("wca_id", "is", null).is("raw_profile_html", null);
      return (data || []).map(p => p.wca_id!);
    },
    staleTime: 30_000,
    enabled: countryCodes.length > 0,
  });

  const cachedMembers: DirectoryMember[] = cachedEntries.flatMap((entry: any) => {
    const members = entry.members as any[];
    return (members || []).map((m: any) => ({
      company_name: m.company_name, city: m.city, country: m.country,
      country_code: m.country_code || entry.country_code, wca_id: m.wca_id,
    }));
  });

  const hasCache = cachedMembers.length > 0;
  const dbWcaSet = new Set(dbPartners.map(p => p.wca_id));
  const sourceMembers = scanComplete ? scannedMembers : cachedMembers;
  const allIds = sourceMembers.filter(m => m.wca_id).map(m => m.wca_id!);
  const uniqueIds = [...new Set(allIds)];
  const missingIds = uniqueIds.filter(id => !dbWcaSet.has(id));
  const noProfileWcaSet = useMemo(() => new Set(noProfileIds), [noProfileIds]);
  const noProfileInDirectoryCount = useMemo(() => uniqueIds.filter(id => noProfileWcaSet.has(id)).length, [uniqueIds, noProfileWcaSet]);

  const idsToDownload = useMemo(() => {
    if (downloadMode === "all") return uniqueIds;
    if (downloadMode === "no_profile") {
      const existingNoProfile = uniqueIds.filter(id => noProfileWcaSet.has(id));
      return [...new Set([...missingIds, ...existingNoProfile])];
    }
    return missingIds;
  }, [downloadMode, uniqueIds, missingIds, noProfileWcaSet]);

  const totalTime = idsToDownload.length * (delay + 5);
  const estimateLabel = totalTime >= 3600 ? `~${(totalTime / 3600).toFixed(1)} ore` : totalTime >= 60 ? `~${Math.ceil(totalTime / 60)} min` : `~${totalTime}s`;

  useEffect(() => {
    if (missingIds.length === 0 && noProfileInDirectoryCount > 0 && downloadMode === "new") setDownloadMode("no_profile");
  }, [missingIds.length, noProfileInDirectoryCount, downloadMode]);

  useEffect(() => {
    setScanComplete(false); setScannedMembers([]); setScanError(null); setAutoDownloadPending(false);
    setProgressFilter(null);
  }, [countryCode]);

  useEffect(() => {
    if (!autoDownloadPending || !scanComplete || isScanning) return;
    setAutoDownloadPending(false);
    const runCleanupAndDownload = async () => {
      const freshWcaIds = new Set(scannedMembers.filter(m => m.wca_id).map(m => m.wca_id!));
      if (freshWcaIds.size === 0) { toast.error("Nessun partner trovato nella directory"); return; }
      const { data: dbPartnersForCleanup } = await supabase.from("partners").select("id, wca_id").in("country_code", countryCodes).not("wca_id", "is", null);
      const dbList = dbPartnersForCleanup || [];
      const stalePartners = dbList.filter(p => p.wca_id && !freshWcaIds.has(p.wca_id));
      let removedCount = 0;
      if (stalePartners.length > 0) {
        const staleIds = stalePartners.map(p => p.id);
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
          await supabase.from("partners").delete().in("id", batch);
        }
        removedCount = stalePartners.length;
      }
      await queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
      await queryClient.invalidateQueries({ queryKey: ["no-profile-wca-ids"] });
      await queryClient.invalidateQueries({ queryKey: ["partners"] });
      await queryClient.invalidateQueries({ queryKey: ["country-stats"] });
      setDownloadMode("no_profile");
      toast.success(`Pulizia: ${removedCount > 0 ? `${removedCount} obsoleti rimossi. ` : ""}Avvio download...`);
      await new Promise(r => setTimeout(r, 2000));
      await handleStartDownload();
    };
    const timer = setTimeout(runCleanupAndDownload, 1000);
    return () => clearTimeout(timer);
  }, [autoDownloadPending, scanComplete, isScanning]);

  const saveScanToCache = useCallback(async (cc: string, netKey: string, scanned: DirectoryMember[], total: number, pages: number) => {
    const membersJson = scanned.map(m => ({ company_name: m.company_name, city: m.city, country: m.country, country_code: m.country_code, wca_id: m.wca_id }));
    await supabase.from("directory_cache").upsert({
      country_code: cc, network_name: netKey, members: membersJson as any,
      total_results: total, total_pages: pages, scanned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }, { onConflict: "country_code,network_name" });
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
  }, [queryClient]);

  const handleStartScan = useCallback(async () => {
    setIsScanning(true); setScanError(null); abortRef.current = false;
    const allMembers: DirectoryMember[] = [];
    const cachedCountryCodes = new Set(cachedEntries.map((e: any) => e.country_code));
    if (skipCachedDirs && cachedCountryCodes.has(countryCode)) {
      setIsScanning(false); setScanComplete(true); return;
    }
    for (const netKey of networkKeys) {
      if (abortRef.current) break;
      let page = 1; let hasNext = true; let countryTotal = 0; let countryPages = 0;
      const countryMembers: DirectoryMember[] = [];
      while (hasNext && !abortRef.current) {
        setCurrentPage(page);
        let result: DirectoryResult | null = null; let lastError = "";
        try {
          result = await scrapeWcaDirectory(countryCode, netKey, page);
          if (!result.success) { lastError = result.error || "Errore sconosciuto"; result = null; }
        } catch (err) { lastError = err instanceof Error ? err.message : "Errore di rete"; result = null; }
        if (!result || !result.success) { setScanError(`${countryName}: ${lastError}`); break; }
        if (result.members.length > 0) {
          const newMembers = result.members.map(m => ({ ...m, country: m.country || countryName, country_code: countryCode }));
          countryMembers.push(...newMembers); allMembers.push(...newMembers); setScannedMembers([...allMembers]);
        }
        countryTotal = result.pagination.total_results; countryPages = result.pagination.total_pages;
        hasNext = result.pagination.has_next_page || result.members.length >= 50;
        page++;
        if (hasNext && !abortRef.current) await new Promise(r => setTimeout(r, 3000));
      }
      if (countryMembers.length > 0) await saveScanToCache(countryCode, netKey, countryMembers, countryTotal, countryPages);
    }
    setIsScanning(false); setScanComplete(true);
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
    queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
  }, [countryCode, countryName, networkKeys, saveScanToCache, queryClient, skipCachedDirs, cachedEntries]);

  const handleStartDownload = async () => {
    const sessionOk = await ensureSession();
    if (!sessionOk) { toast.error("Sessione WCA non attiva."); return; }
    await executeDownload();
  };

  const executeDownload = async () => {
    if (idsToDownload.length === 0) { toast.info("Nessun partner da scaricare"); return; }
    const { data: activeJobs } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
    if (activeJobs && activeJobs.length > 0) { toast.error("Job già in corso."); return; }
    const countryIds = idsToDownload;
    if (countryIds.length === 0) return;
    const jobId = await createJob.mutateAsync({
      country_code: countryCode, country_name: countryName,
      network_name: networks.length > 0 ? networks.join(", ") : "Tutti",
      wca_ids: countryIds, delay_seconds: Math.max(delay, 10),
    });
    if (jobId && onJobCreated) onJobCreated(jobId);
  };

  /* ════════════════════════════════════════════
   * STATS
   * ════════════════════════════════════════════ */
  /* Server-side stats from RPC (no 1000-row limit) */
  const { data: countryStatsData } = useCountryStats();
  const serverStats = countryStatsData?.byCountry?.[countryCode];
  const stats = useMemo(() => {
    if (serverStats) {
      return {
        total: serverStats.total_partners,
        withProfile: serverStats.with_profile,
        withDeep: serverStats.with_deep_search,
        withEmail: serverStats.with_email,
        withPhone: serverStats.with_phone,
        withAliasCo: serverStats.with_company_alias,
        withAliasCt: serverStats.with_contact_alias,
      };
    }
    // Fallback client-side (only if RPC not loaded yet)
    const list = partners || [];
    const total = list.length;
    let withProfile = 0, withDeep = 0, withEmail = 0, withPhone = 0, withAliasCo = 0, withAliasCt = 0;
    list.forEach((p: any) => {
      if (p.raw_profile_html) withProfile++;
      if (p.enrichment_data && (p.enrichment_data as any)?.deep_search_at) withDeep++;
      if (p.email || (p.partner_contacts || []).some((c: any) => c.email)) withEmail++;
      if (p.phone || (p.partner_contacts || []).some((c: any) => c.direct_phone || c.mobile)) withPhone++;
      if (p.company_alias) withAliasCo++;
      if ((p.partner_contacts || []).some((c: any) => c.contact_alias)) withAliasCt++;
    });
    return { total, withProfile, withDeep, withEmail, withPhone, withAliasCo, withAliasCt };
  }, [serverStats, partners]);

  const filteredPartners = useMemo(() => {
    let list = partners || [];
    if (progressFilter) {
      list = list.filter((p: any) => {
        switch (progressFilter) {
          case "profiles": return !p.raw_profile_html;
          case "deep": return !(p.enrichment_data && (p.enrichment_data as any)?.deep_search_at);
          case "email": return !p.email && !(p.partner_contacts || []).some((c: any) => c.email);
          case "phone": return !p.phone && !(p.partner_contacts || []).some((c: any) => c.direct_phone || c.mobile);
          case "alias_co": return !p.company_alias;
          case "alias_ct": return !(p.partner_contacts || []).some((c: any) => c.contact_alias);
          default: return true;
        }
      });
    }
    const sorted = [...list];
    switch (sortBy) {
      case "name_asc": return sorted.sort((a: any, b: any) => a.company_name.localeCompare(b.company_name));
      case "rating_desc": return sorted.sort((a: any, b: any) => (b.rating || 0) - (a.rating || 0));
      case "contacts_desc": return sorted.sort((a: any, b: any) => {
        const qa = getPartnerContactQuality(a.partner_contacts);
        const qb = getPartnerContactQuality(b.partner_contacts);
        const order: Record<string, number> = { complete: 0, partial: 1, missing: 2 };
        return (order[qa] || 2) - (order[qb] || 2);
      });
      default: return sorted;
    }
  }, [partners, progressFilter, sortBy]);

  const handleSelectPartner = useCallback((id: string) => {
    if (onSelectPartner) onSelectPartner(id);
  }, [onSelectPartner]);

  const toggleProgressFilter = (key: ProgressFilterKey) => {
    setProgressFilter(prev => prev === key ? null : key);
  };

  const totalCount = uniqueIds.length;
  const downloadedCount = uniqueIds.filter(id => dbWcaSet.has(id)).length;

  /* ════════════════════════════════════════════
   * WIZARD: determine next action
   * ════════════════════════════════════════════ */
  const missingProfiles = stats.total - stats.withProfile;
  const missingDeep = stats.total - stats.withDeep;
  const missingAliasCo = stats.total - stats.withAliasCo;
  const missingAliasCt = stats.total - stats.withAliasCt;

  const wizardStep = missingProfiles > 0 ? 1 : missingDeep > 0 ? 2 : (missingAliasCo > 0 || missingAliasCt > 0) ? 3 : 4;

  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full flex flex-col overflow-hidden">
        {/* ═══ COMPACT HEADER: Country + inline stats + wizard toggle ═══ */}
        <div className={`px-3 pt-2 pb-1.5 flex-shrink-0 space-y-1.5`}>
          {/* Row 1: Country name + inline stat chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg leading-none">{getCountryFlag(countryCode)}</span>
            <span className={cn("text-sm font-bold", isDark ? "text-slate-100" : "text-slate-800")}>📍 {countryName}</span>
            <span className={isDark ? "text-white/10" : "text-slate-200"}>·</span>
            <div className="flex items-center gap-2 flex-wrap text-[11px]">
              <StatChip label="Totale WCA" value={totalCount} isDark={isDark} />
              <StatChip label="Scaricati" value={downloadedCount} total={totalCount} isDark={isDark} />
              <MissingChip label="Profilo" missing={stats.total - stats.withProfile} isDark={isDark} onClick={() => toggleProgressFilter("profiles")} active={progressFilter === "profiles"} />
              <MissingChip label="Deep" missing={stats.total - stats.withDeep} isDark={isDark} onClick={() => toggleProgressFilter("deep")} active={progressFilter === "deep"} />
              <MissingChip label="Email" missing={stats.total - stats.withEmail} isDark={isDark} onClick={() => toggleProgressFilter("email")} active={progressFilter === "email"} />
              <MissingChip label="Telefono" missing={stats.total - stats.withPhone} isDark={isDark} onClick={() => toggleProgressFilter("phone")} active={progressFilter === "phone"} />
              <MissingChip label="Alias Az." missing={stats.total - stats.withAliasCo} isDark={isDark} onClick={() => toggleProgressFilter("alias_co")} active={progressFilter === "alias_co"} />
              <MissingChip label="Alias Ct." missing={stats.total - stats.withAliasCt} isDark={isDark} onClick={() => toggleProgressFilter("alias_ct")} active={progressFilter === "alias_ct"} />
            </div>
            <button
              onClick={() => setWizardOpen(p => !p)}
              className={cn(
                "ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all",
                wizardStep < 4
                  ? isDark ? "bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/25" : "bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100"
                  : isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600"
              )}
            >
              {wizardStep < 4 ? <><Zap className="w-3 h-3" /> Step {wizardStep}/3</> : <><CheckCircle2 className="w-3 h-3" /> Completo</>}
            </button>
          </div>

          {/* Row 2: Search + sort */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
              <Input placeholder="Cerca partner..." value={search} onChange={e => setSearch(e.target.value)} className={`pl-10 h-8 rounded-xl text-xs ${th.input}`} />
            </div>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className={`w-[120px] h-8 rounded-xl text-xs ${th.selTrigger}`}><SelectValue /></SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="name_asc">Nome A-Z</SelectItem>
                <SelectItem value="rating_desc">Rating ↓</SelectItem>
                <SelectItem value="contacts_desc">Contatti ↓</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className={`text-[10px] ${th.dim}`}>
            {isLoading ? "Caricamento..." : `${filteredPartners.length} partner${progressFilter ? " (filtrati)" : ""}`}
          </p>

          {/* ═══ FILTER ACTION BAR ═══ */}
          {progressFilter && filteredPartners.length > 0 && (
            <FilterActionBar
              filter={progressFilter}
              count={filteredPartners.length}
              isDark={isDark}
              onDownload={() => { setDownloadMode("no_profile"); setWizardOpen(true); }}
              onDeepSearch={() => {
                const ids = filteredPartners.map((p: any) => p.id);
                if (ids.length > 0) onDeepSearch?.(ids);
              }}
              onGenerateAlias={(type) => onGenerateAliases?.(countryCodes, type)}
              deepSearchRunning={deepSearchRunning}
              aliasGenerating={aliasGenerating}
            />
          )}
        </div>

        {/* ═══ WIZARD (collapsible) ═══ */}
        {wizardOpen && (
          <div className={`px-3 pb-2 flex-shrink-0 animate-in fade-in slide-in-from-top-2 duration-200`}>
            <div className={`rounded-xl border p-2.5 space-y-2 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50/60 border-slate-200/60"}`}>
              {wizardStep === 4 ? (
                <div className="flex items-center gap-2 py-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className={`text-sm font-bold ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Paese completato!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Step 1: Download Profili */}
                  <WizardRow
                    step={1} active={wizardStep === 1} isDark={isDark}
                    icon={Download} label="Scarica Profili" missing={missingProfiles} total={stats.total}
                  >
                    {wizardStep === 1 && !isScanning && (
                      <div className="space-y-3 mt-2">
                        <div className="space-y-1.5">
                          <DownloadChoice selected={downloadMode === "new"} onClick={() => setDownloadMode("new")} isDark={isDark} icon={FolderDown} title="Nuovi da scaricare" description={`${missingIds.length} partner presenti in directory ma mai importati nel database`} count={missingIds.length} color="text-sky-400" />
                          <DownloadChoice selected={downloadMode === "no_profile"} onClick={() => setDownloadMode("no_profile")} isDark={isDark} icon={FileText} title="Profili incompleti" description={`${noProfileInDirectoryCount + missingIds.length} importati ma senza dati di contatto o profilo`} count={noProfileInDirectoryCount + missingIds.length} color="text-amber-400" />
                          <DownloadChoice selected={downloadMode === "all"} onClick={() => setDownloadMode("all")} isDark={isDark} icon={RefreshCw} title="Aggiorna tutto" description={`Riscarica e aggiorna tutti i ${totalCount} partner di questo paese`} count={totalCount} color="text-violet-400" />
                        </div>
                        <div className={cn("flex items-center justify-between text-[10px] font-mono px-1", isDark ? "text-slate-500" : "text-slate-400")}>
                          <span>⏱ Delay: {delay}s tra ogni profilo</span>
                          <span>{estimateLabel}</span>
                        </div>
                        <Button onClick={() => handleStartDownload()} disabled={idsToDownload.length === 0 || createJob.isPending}
                          className={cn("w-full h-10 text-sm font-bold rounded-xl transition-all", idsToDownload.length > 0 ? isDark ? "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20" : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30" : "")}>
                          {createJob.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Avvio...</> : <><Download className="w-4 h-4 mr-2" /> SCARICA {idsToDownload.length} PROFILI</>}
                        </Button>
                        {hasCache && !scanComplete && (
                          <button onClick={handleStartScan} className={`flex items-center gap-1.5 text-[10px] mx-auto ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"} transition-colors`}>
                            <RefreshCw className="w-3 h-3" /> ↻ Sincronizza con WCA Directory
                          </button>
                        )}
                      </div>
                    )}
                    {isScanning && (
                      <div className="mt-2 text-center space-y-1">
                        <Loader2 className={`w-4 h-4 animate-spin mx-auto ${isDark ? "text-amber-400" : "text-amber-500"}`} />
                        <p className={`text-[10px] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{countryName} — Pg {currentPage}</p>
                        {scannedMembers.length > 0 && <p className={`text-xs font-mono font-bold ${isDark ? "text-white" : "text-slate-800"}`}>{scannedMembers.length} trovati</p>}
                        {scanError && <p className="text-[10px] text-red-400">⚠️ {scanError}</p>}
                        <Button size="sm" variant="ghost" onClick={() => { abortRef.current = true; setIsScanning(false); setScanComplete(true); }} className="text-[10px]">
                          <Square className="w-3 h-3 mr-1" /> Stop
                        </Button>
                      </div>
                    )}
                  </WizardRow>

                  {/* Step 2: Deep Search */}
                  <WizardRow step={2} active={wizardStep === 2} isDark={isDark} icon={Telescope} label="Deep Search" missing={missingDeep} total={stats.total}>
                    {wizardStep === 2 && (
                      <Button size="sm" className={cn("mt-2 h-8 text-xs font-bold w-full", isDark ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-cyan-500 hover:bg-cyan-600 text-white")}
                        disabled={deepSearchRunning}
                        onClick={() => {
                          const ids = (partners || []).filter((p: any) => p.raw_profile_html && !(p.enrichment_data as any)?.deep_search_at).map((p: any) => p.id);
                          if (ids.length > 0) onDeepSearch?.(ids);
                        }}>
                        {deepSearchRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> In corso...</> : <><Telescope className="w-3.5 h-3.5 mr-1" /> Avvia Deep Search ({missingDeep})</>}
                      </Button>
                    )}
                  </WizardRow>

                  {/* Step 3: Generate Alias */}
                  <WizardRow step={3} active={wizardStep === 3} isDark={isDark} icon={Wand2} label="Genera Alias" missing={missingAliasCo + missingAliasCt} total={stats.total * 2}>
                    {wizardStep === 3 && (
                      <div className="flex gap-2 mt-2">
                        <Button size="sm" className={cn("flex-1 h-8 text-xs font-bold", isDark ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-amber-500 hover:bg-amber-600 text-white")}
                          disabled={aliasGenerating || missingAliasCo === 0} onClick={() => onGenerateAliases?.(countryCodes, "company")}>
                          <Building2 className="w-3.5 h-3.5 mr-1" /> Azienda ({missingAliasCo})
                        </Button>
                        <Button size="sm" className={cn("flex-1 h-8 text-xs font-bold", isDark ? "bg-pink-600 hover:bg-pink-500 text-white" : "bg-pink-500 hover:bg-pink-600 text-white")}
                          disabled={aliasGenerating || missingAliasCt === 0} onClick={() => onGenerateAliases?.(countryCodes, "contact")}>
                          <UserCircle className="w-3.5 h-3.5 mr-1" /> Contatto ({missingAliasCt})
                        </Button>
                      </div>
                    )}
                  </WizardRow>
                </div>
              )}
            </div>
            <div className="max-h-28 overflow-auto space-y-1 mt-2">
              <DownloadTerminal />
              <JobMonitor />
            </div>
          </div>
        )}

        {/* ═══ PARTNER LIST (immediate, scrollable) ═══ */}
        <ScrollArea className="flex-1 min-h-0">
          <div className={`${isDark ? "divide-white/[0.06]" : "divide-slate-200/60"} divide-y`}>
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="p-3 space-y-2">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))
              : filteredPartners.map((partner: any) => {
                  const q = getPartnerContactQuality(partner.partner_contacts);
                  const years = getYearsMember(partner.member_since);
                  const contacts = partner.partner_contacts || [];
                  const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];

                  return (
                    <div key={partner.id} onClick={() => handleSelectPartner(partner.id)}
                      className={cn(
                        "p-3 cursor-pointer transition-all duration-200 group",
                        selectedPartnerId === partner.id
                          ? isDark ? "bg-sky-950/40 ring-1 ring-sky-400/30" : "bg-sky-50 ring-1 ring-sky-300/40"
                          : isDark ? "hover:bg-white/[0.06]" : "hover:bg-sky-50/50",
                        q === "missing" && "border-l-4 border-l-red-500",
                        q === "partial" && "border-l-4 border-l-amber-400",
                        q === "complete" && "border-l-4 border-l-emerald-500",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        {partner.logo_url ? (
                          <img src={partner.logo_url} alt="" className="w-8 h-8 rounded-lg object-contain bg-white/10 border border-white/10 shrink-0" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        ) : (
                          <div className={`w-8 h-8 rounded-lg shrink-0 ${isDark ? "bg-white/[0.06]" : "bg-slate-100"}`} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-semibold text-sm truncate ${th.h2}`}>{partner.city}</p>
                              <p className={`text-xs truncate ${th.sub}`}>
                                {partner.company_name}
                                {partner.company_alias && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">{partner.company_alias}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {years > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                                  <span className="text-xs font-bold text-amber-500">{years}</span>
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-lg leading-none">{getCountryFlag(partner.country_code)}</span>
                            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} />}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-xs">
                            {primaryContact ? (
                              <>
                                <span className={`truncate max-w-[100px] ${th.dim}`}>{primaryContact.name}</span>
                                <Mail className={cn("w-3.5 h-3.5", primaryContact.email ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                                <Phone className={cn("w-3.5 h-3.5", (primaryContact.direct_phone || primaryContact.mobile) ? "text-sky-500" : isDark ? "text-white/15" : "text-slate-200")} />
                                {contacts.length > 1 && <span className={`text-[10px] ${th.dim}`}>+{contacts.length - 1}</span>}
                              </>
                            ) : (
                              <span className={`italic ${th.dim}`}>Nessun contatto</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center gap-1 shrink-0 mt-1">
                          {primaryContact?.email && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={(e) => { e.stopPropagation(); setEmailTarget({ email: primaryContact.email, name: primaryContact.name, company: partner.company_name, partnerId: partner.id }); }}
                                  className={cn("p-1.5 rounded-lg border transition-all opacity-0 group-hover:opacity-100", isDark ? "bg-sky-500/10 border-sky-500/20 text-sky-400 hover:bg-sky-500/20" : "bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100")}>
                                  <Send className="w-3.5 h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">Invia email a {primaryContact.email}</TooltipContent>
                            </Tooltip>
                          )}
                          <ChevronRight className={`w-4 h-4 ${th.dim} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </ScrollArea>
      </div>
      {emailTarget && (
        <SendEmailDialog open={!!emailTarget} onOpenChange={(open) => { if (!open) setEmailTarget(null); }}
          recipientEmail={emailTarget.email} recipientName={emailTarget.name} companyName={emailTarget.company} partnerId={emailTarget.partnerId} isDark={isDark} />
      )}
    </TooltipProvider>
  );
}

/* ── Stat Chip (inline, for non-clickable stats) ── */
function StatChip({ label, value, total, isDark, onClick, active }: {
  label: string; value: number; total?: number; isDark: boolean;
  onClick?: () => void; active?: boolean;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <span onClick={onClick}
      className={cn(
        "inline-flex items-center gap-0.5 font-mono whitespace-nowrap transition-all",
        onClick ? "cursor-pointer hover:opacity-80" : "",
        active ? (isDark ? "text-sky-400" : "text-sky-600") : (isDark ? "text-slate-400" : "text-slate-500")
      )}>
      <span className={cn("text-[10px]", isDark ? "text-slate-500" : "text-slate-400")}>{label}</span>
      <span className={cn("font-bold", isDark ? "text-slate-200" : "text-slate-700")}>{value}</span>
      {pct !== null && <span className={cn("text-[9px]", pct >= 80 ? "text-emerald-500" : pct >= 40 ? "text-amber-500" : "text-rose-500")}>{pct}%</span>}
    </span>
  );
}

/* ── Missing Chip (clickable, shows missing count) ── */
function MissingChip({ label, missing, isDark, onClick, active }: {
  label: string; missing: number; isDark: boolean;
  onClick?: () => void; active?: boolean;
}) {
  const done = missing === 0;
  return (
    <span onClick={done ? undefined : onClick}
      className={cn(
        "inline-flex items-center gap-0.5 font-mono whitespace-nowrap transition-all",
        done ? "" : onClick ? "cursor-pointer hover:opacity-80" : "",
        done ? "text-emerald-500" : active ? (isDark ? "text-sky-400" : "text-sky-600") : (isDark ? "text-slate-400" : "text-slate-500")
      )}>
      {done ? (
        <>
          <span className="text-emerald-500">✓</span>
          <span className={cn("text-[10px]", "text-emerald-500")}>{label}</span>
        </>
      ) : (
        <>
          <span className={cn("text-[10px]", isDark ? "text-slate-500" : "text-slate-400")}>Senza {label}</span>
          <span className={cn("font-bold", active ? (isDark ? "text-sky-300" : "text-sky-700") : "text-rose-500")}>{missing}</span>
        </>
      )}
    </span>
  );
}

/* ── Dashboard Cell (unused, kept for reference) ── */
function DashCell({ label, value, total, isDark, color, onClick, active }: {
  label: string; value: number; total?: number; isDark: boolean; color: string;
  onClick?: () => void; active?: boolean;
}) {
  const pct = total && total > 0 ? Math.round((value / total) * 100) : null;
  return (
    <button onClick={onClick} disabled={!onClick}
      className={cn(
        "rounded-lg border p-1.5 text-left transition-all",
        active
          ? isDark ? "bg-sky-950/50 border-sky-400/40 ring-1 ring-sky-400/20" : "bg-sky-50 border-sky-300 ring-1 ring-sky-300/40"
          : isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/40 border-slate-200/60",
        onClick ? "cursor-pointer hover:scale-[1.02]" : "cursor-default"
      )}>
      <p className={`text-[9px] uppercase tracking-wider font-semibold truncate ${isDark ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
      <p className={`text-sm font-mono font-extrabold ${color}`}>{value}{total !== undefined && <span className={`text-[9px] font-normal ${isDark ? "text-slate-600" : "text-slate-400"}`}>/{total}</span>}</p>
      {pct !== null && (
        <div className={`h-1 rounded-full mt-0.5 overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
          <div className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </button>
  );
}

/* ── Wizard Row ── */
function WizardRow({ step, active, isDark, icon: Icon, label, missing, total, children }: {
  step: number; active: boolean; isDark: boolean;
  icon: any; label: string; missing: number; total: number;
  children?: React.ReactNode;
}) {
  const done = missing === 0;
  return (
    <div className={cn(
      "rounded-lg border p-2 transition-all",
      active ? isDark ? "bg-sky-950/30 border-sky-500/30" : "bg-sky-50/80 border-sky-300"
        : done ? isDark ? "bg-emerald-950/20 border-emerald-500/20" : "bg-emerald-50/60 border-emerald-300/50"
        : isDark ? "bg-white/[0.01] border-white/[0.04] opacity-50" : "bg-slate-50/40 border-slate-200/40 opacity-50"
    )}>
      <div className="flex items-center gap-2">
        <span className={cn(
          "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
          done ? "bg-emerald-500/20 text-emerald-400" : active ? isDark ? "bg-sky-500/20 text-sky-400" : "bg-sky-100 text-sky-600" : isDark ? "bg-white/[0.06] text-slate-500" : "bg-slate-100 text-slate-400"
        )}>
          {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : step}
        </span>
        <Icon className={cn("w-4 h-4", done ? "text-emerald-400" : active ? isDark ? "text-sky-400" : "text-sky-600" : isDark ? "text-slate-500" : "text-slate-400")} />
        <span className={cn("text-xs font-bold flex-1", done ? isDark ? "text-emerald-400" : "text-emerald-600" : active ? isDark ? "text-sky-300" : "text-sky-700" : isDark ? "text-slate-500" : "text-slate-400")}>
          {label}
        </span>
        <span className={cn("text-[10px] font-mono font-bold", done ? "text-emerald-400" : active ? isDark ? "text-sky-300" : "text-sky-600" : isDark ? "text-slate-600" : "text-slate-400")}>
          {done ? "✓" : `${missing}/${total}`}
        </span>
      </div>
      {children}
    </div>
  );
}

/* ── Download Choice Card ── */
function DownloadChoice({ selected, onClick, isDark, icon: Icon, title, description, count, color }: {
  selected: boolean; onClick: () => void; isDark: boolean;
  icon: any; title: string; description: string; count: number; color: string;
}) {
  return (
    <button onClick={onClick} className={cn(
      "w-full text-left rounded-xl border p-3 transition-all flex items-start gap-3",
      selected
        ? isDark ? "bg-sky-950/40 border-sky-400/40 ring-1 ring-sky-400/20 shadow-lg shadow-sky-500/10" : "bg-sky-50 border-sky-300 ring-1 ring-sky-300/40 shadow-lg shadow-sky-200/40"
        : isDark ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]" : "bg-white/60 border-slate-200 hover:bg-slate-50"
    )}>
      <div className={cn(
        "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center mt-0.5",
        selected
          ? isDark ? "bg-sky-500/20" : "bg-sky-100"
          : isDark ? "bg-white/[0.04]" : "bg-slate-100"
      )}>
        <Icon className={cn("w-4 h-4", selected ? isDark ? "text-sky-400" : "text-sky-600" : isDark ? "text-slate-500" : "text-slate-400")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs font-bold", isDark ? "text-slate-200" : "text-slate-700")}>{title}</p>
        <p className={cn("text-[10px] mt-0.5 leading-relaxed", isDark ? "text-slate-500" : "text-slate-400")}>{description}</p>
      </div>
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <span className={cn("text-lg font-mono font-extrabold", color)}>{count}</span>
        <div className={cn(
          "w-4 h-4 rounded-full border-2 flex items-center justify-center",
          selected ? "border-sky-400 bg-sky-400" : isDark ? "border-slate-600" : "border-slate-300"
        )}>
          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </div>
    </button>
  );
}

/* ── Filter Action Bar ── */
function FilterActionBar({ filter, count, isDark, onDownload, onDeepSearch, onGenerateAlias, deepSearchRunning, aliasGenerating }: {
  filter: string;
  count: number;
  isDark: boolean;
  onDownload: () => void;
  onDeepSearch: () => void;
  onGenerateAlias: (type: "company" | "contact") => void;
  deepSearchRunning?: boolean;
  aliasGenerating?: boolean;
}) {
  const configs: Record<string, { icon: any; label: string; action: () => void; disabled?: boolean; color: string }> = {
    profiles: { icon: Download, label: "Scarica Profili", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
    email: { icon: Download, label: "Scarica Profili", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
    phone: { icon: Download, label: "Scarica Profili", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
    deep: { icon: Telescope, label: "Avvia Deep Search", action: onDeepSearch, disabled: deepSearchRunning, color: isDark ? "bg-cyan-600 hover:bg-cyan-500" : "bg-cyan-500 hover:bg-cyan-600" },
    alias_co: { icon: Building2, label: "Genera Alias Azienda", action: () => onGenerateAlias("company"), disabled: aliasGenerating, color: isDark ? "bg-amber-600 hover:bg-amber-500" : "bg-amber-500 hover:bg-amber-600" },
    alias_ct: { icon: UserCircle, label: "Genera Alias Contatto", action: () => onGenerateAlias("contact"), disabled: aliasGenerating, color: isDark ? "bg-pink-600 hover:bg-pink-500" : "bg-pink-500 hover:bg-pink-600" },
  };

  const cfg = configs[filter];
  if (!cfg) return null;
  const Icon = cfg.icon;

  return (
    <div className={cn(
      "flex items-center gap-2 px-2 py-1.5 rounded-xl border animate-in fade-in slide-in-from-top-2 duration-150",
      isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-slate-50/80 border-slate-200/60"
    )}>
      <button
        onClick={cfg.action}
        disabled={cfg.disabled || count === 0}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed",
          cfg.color
        )}
      >
        {cfg.disabled ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
        {cfg.label} ({count})
      </button>
    </div>
  );
}
