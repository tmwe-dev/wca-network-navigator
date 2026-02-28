import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { SendEmailDialog } from "@/components/operations/SendEmailDialog";
import { Input } from "@/components/ui/input";
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
  Search, Phone, Mail, ChevronRight, Loader2,
  FileText, Trophy, Wand2, Send, Download, Telescope, Building2, UserCircle,
  Zap, FolderDown, RefreshCw, Square, CheckCircle2,
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
import { getRealLogoUrl } from "@/lib/partnerUtils";

/* ── Props ── */
interface PartnerListPanelProps {
  countryCodes: string[];
  countryNames: string[];
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
  countryCodes, countryNames, isDark,
  onDeepSearch, onGenerateAliases,
  deepSearchRunning, aliasGenerating,
  onJobCreated, directoryOnly: directoryOnlyProp, onDirectoryOnlyChange,
  onSelectPartner, selectedPartnerId,
}: PartnerListPanelProps) {
  const th = t(isDark);
  const countryCode = countryCodes[0] || "";
  const countryName = countryNames[0] || "";
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
  const { ensureSession, lastError: wcaLastError } = useWcaSession();
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
    if (downloadMode === "all") {
      return uniqueIds.length > 0 ? uniqueIds : dbPartners.filter(p => p.wca_id).map(p => p.wca_id);
    }
    if (downloadMode === "no_profile") {
      if (uniqueIds.length > 0) {
        const existingNoProfile = uniqueIds.filter(id => noProfileWcaSet.has(id));
        return [...new Set([...missingIds, ...existingNoProfile])];
      }
      return noProfileIds; // fallback diretto dal DB
    }
    return missingIds;
  }, [downloadMode, uniqueIds, missingIds, noProfileWcaSet, noProfileIds, dbPartners]);

  const totalTime = idsToDownload.length * (delay + 5);
  const estimateLabel = totalTime >= 3600 ? `~${(totalTime / 3600).toFixed(1)} ore` : totalTime >= 60 ? `~${Math.ceil(totalTime / 60)} min` : `~${totalTime}s`;

  useEffect(() => {
    if (missingIds.length === 0 && noProfileInDirectoryCount > 0 && downloadMode === "new") setDownloadMode("no_profile");
    if (!hasCache && noProfileIds.length > 0 && downloadMode === "new") setDownloadMode("no_profile");
  }, [missingIds.length, noProfileInDirectoryCount, downloadMode, hasCache, noProfileIds.length]);

  useEffect(() => {
    setScanComplete(false); setScannedMembers([]); setScanError(null); setAutoDownloadPending(false);
    setProgressFilter(null);
  }, [countryCodes.join(",")]);

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

  // wcaLastError already destructured from useWcaSession at top
  const handleStartDownload = async () => {
    const sessionOk = await ensureSession();
    if (!sessionOk) {
      toast.error(wcaLastError || "Sessione WCA non attiva. Controlla estensione e credenziali.");
      return;
    }
    await executeDownload();
  };

  const executeDownload = async () => {
    if (idsToDownload.length === 0) { toast.info("Nessun partner da scaricare"); return; }
    const { data: activeJobs } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
    if (activeJobs && activeJobs.length > 0) { toast.error("Job già in corso."); return; }
    // Use first country for job metadata — partners are already filtered by all selected countries
    const primaryCode = countryCodes[0] || "";
    const primaryName = countryNames[0] || "";
    const jobLabel = countryCodes.length > 1 ? `${primaryName} +${countryCodes.length - 1}` : primaryName;
    const jobId = await createJob.mutateAsync({
      country_code: primaryCode, country_name: jobLabel,
      network_name: networks.length > 0 ? networks.join(", ") : "Tutti",
      wca_ids: idsToDownload, delay_seconds: Math.max(delay, 10),
    });
    if (jobId && onJobCreated) onJobCreated(jobId);
  };

  /* ════════════════════════════════════════════
   * STATS
   * ════════════════════════════════════════════ */
  /* Server-side stats from RPC (no 1000-row limit) */
  const { data: countryStatsData } = useCountryStats();
  // Aggregate stats across all selected countries
  const serverStats = useMemo(() => {
    if (!countryStatsData?.byCountry || countryCodes.length === 0) return null;
    if (countryCodes.length === 1) return countryStatsData.byCountry[countryCodes[0]] || null;
    const agg = { total_partners: 0, with_profile: 0, with_deep_search: 0, with_email: 0, with_phone: 0, with_company_alias: 0, with_contact_alias: 0 };
    countryCodes.forEach(cc => {
      const s = countryStatsData.byCountry[cc];
      if (s) {
        agg.total_partners += s.total_partners;
        agg.with_profile += s.with_profile;
        agg.with_deep_search += s.with_deep_search;
        agg.with_email += s.with_email;
        agg.with_phone += s.with_phone;
        agg.with_company_alias += s.with_company_alias;
        agg.with_contact_alias += s.with_contact_alias;
      }
    });
    return agg;
  }, [countryStatsData, countryCodes]);
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

  /* ── Tri-state verification logic (client-side from loaded partners) ── */
  const verified = useMemo(() => {
    const list = partners || [];
    // Email verified = all partners with profile have been checked for email
    const missingEmailList = list.filter((p: any) => !p.email && !(p.partner_contacts || []).some((c: any) => c.email));
    const emailVerified = missingEmailList.length === 0 || missingEmailList.every((p: any) => !!p.raw_profile_html);
    // Phone verified = all partners with profile have been checked for phone
    const missingPhoneList = list.filter((p: any) => !p.phone && !(p.partner_contacts || []).some((c: any) => c.direct_phone || c.mobile));
    const phoneVerified = missingPhoneList.length === 0 || missingPhoneList.every((p: any) => !!p.raw_profile_html);
    // Deep search verified = all partners have enrichment_data.deep_search_at
    const missingDeepList = list.filter((p: any) => !(p.enrichment_data as any)?.deep_search_at);
    const deepVerified = missingDeepList.length === 0 || missingDeepList.every((p: any) => !!(p.enrichment_data as any)?.deep_search_at);
    // Alias verified = ai_parsed_at exists (alias generation was run)
    const missingAliasCoList = list.filter((p: any) => !p.company_alias);
    const aliasCoVerified = missingAliasCoList.length === 0 || missingAliasCoList.every((p: any) => !!p.ai_parsed_at);
    const missingAliasCtList = list.filter((p: any) => !(p.partner_contacts || []).some((c: any) => c.contact_alias));
    const aliasCtVerified = missingAliasCtList.length === 0 || missingAliasCtList.every((p: any) => !!p.ai_parsed_at);
    return { email: emailVerified, phone: phoneVerified, deep: deepVerified, aliasCo: aliasCoVerified, aliasCt: aliasCtVerified };
  }, [partners]);

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

  const totalCount = uniqueIds.length > 0 ? uniqueIds.length : stats.total;
  const downloadedCount = uniqueIds.length > 0 ? uniqueIds.filter(id => dbWcaSet.has(id)).length : stats.withProfile;

  /* ════════════════════════════════════════════
   * WIZARD: determine next action
   * ════════════════════════════════════════════ */
  const missingProfiles = stats.total - stats.withProfile;
  const missingDeep = stats.total - stats.withDeep;
  const missingAliasCo = stats.total - stats.withAliasCo;
  const missingAliasCt = stats.total - stats.withAliasCt;

  // wizardStep must stay at 1 if there are ANY downloadable IDs (missing from DB OR missing profile)
  const hasDownloadableIds = idsToDownload.length > 0 || missingIds.length > 0;
  const wizardStep = (missingProfiles > 0 || hasDownloadableIds) ? 1 : missingDeep > 0 ? 2 : (missingAliasCo > 0 || missingAliasCt > 0) ? 3 : 4;

  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full min-h-0 flex flex-col">
        {/* ═══ COMPACT HEADER ═══ */}
        <div className="px-3 pt-2.5 pb-1 flex-shrink-0 space-y-2">
          {/* ── ROW 1: Country + progress + wizard ── */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {countryCodes.slice(0, 5).map(cc => (
                <span key={cc} className="text-lg leading-none">{getCountryFlag(cc)}</span>
              ))}
              {countryCodes.length > 5 && <span className={cn("text-[10px] font-bold ml-0.5", isDark ? "text-slate-400" : "text-slate-500")}>+{countryCodes.length - 5}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className={cn("text-sm font-bold truncate", isDark ? "text-slate-100" : "text-slate-800")}>
                {countryCodes.length === 1 ? countryName : `${countryCodes.length} paesi`}
              </h2>
              {totalCount > 0 && (
                <div className="flex items-center gap-2 mt-0.5">
                  <div className={cn("flex-1 h-2 rounded-full overflow-hidden", isDark ? "bg-white/[0.06]" : "bg-slate-200/60")}>
                    <div
                      className={cn("h-full rounded-full transition-all duration-500",
                        downloadedCount >= totalCount ? "bg-emerald-500" : downloadedCount >= totalCount * 0.5 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ width: `${Math.min(100, Math.round((downloadedCount / totalCount) * 100))}%` }}
                    />
                  </div>
                  <span className={cn("text-[10px] font-mono font-bold tabular-nums whitespace-nowrap",
                    downloadedCount >= totalCount ? "text-emerald-500" : "text-amber-500"
                  )}>
                    {downloadedCount}/{totalCount} ({Math.round((downloadedCount / totalCount) * 100)}%)
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={() => setWizardOpen(p => !p)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all shrink-0",
                wizardStep < 4
                  ? isDark ? "bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/25" : "bg-sky-50 border-sky-200 text-sky-600 hover:bg-sky-100"
                  : isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-600"
              )}
            >
              {wizardStep < 4 ? <><Zap className="w-3 h-3" /> Step {wizardStep}/3</> : <><CheckCircle2 className="w-3 h-3" /> OK</>}
            </button>
          </div>

           {/* ── ROW 2: Counts + 6 icon indicators ── */}
          <div className="flex items-center gap-1">
            <div className={cn("flex items-center gap-1.5 mr-1.5 pr-1.5 border-r", isDark ? "border-white/[0.08]" : "border-slate-200")}>
              <span className={cn("text-[10px] font-bold tabular-nums", isDark ? "text-slate-300" : "text-slate-600")}>{stats.total}</span>
              <span className={cn("text-[9px]", isDark ? "text-slate-600" : "text-slate-400")}>tot</span>
              <span className={cn("text-[10px] font-bold tabular-nums", isDark ? "text-emerald-400" : "text-emerald-600")}>{stats.withProfile}</span>
              <span className={cn("text-[9px]", isDark ? "text-slate-600" : "text-slate-400")}>↓</span>
            </div>
            <IconIndicator icon={FileText} count={stats.total - stats.withProfile} label="Senza Profilo" isDark={isDark} onClick={() => toggleProgressFilter("profiles")} active={progressFilter === "profiles"} />
            <IconIndicator icon={Mail} count={stats.total - stats.withEmail} label="Senza Email" isDark={isDark} onClick={() => toggleProgressFilter("email")} active={progressFilter === "email"} verified={verified.email} />
            <IconIndicator icon={Phone} count={stats.total - stats.withPhone} label="Senza Telefono" isDark={isDark} onClick={() => toggleProgressFilter("phone")} active={progressFilter === "phone"} verified={verified.phone} />
            <div className={cn("w-px h-5 mx-0.5", isDark ? "bg-white/[0.08]" : "bg-slate-200")} />
            <IconIndicator icon={Telescope} count={stats.total - stats.withDeep} label="Senza Deep Search" isDark={isDark} onClick={() => toggleProgressFilter("deep")} active={progressFilter === "deep"} verified={verified.deep} />
            <IconIndicator icon={Building2} count={stats.total - stats.withAliasCo} label="Senza Alias Azienda" isDark={isDark} onClick={() => toggleProgressFilter("alias_co")} active={progressFilter === "alias_co"} verified={verified.aliasCo} />
            <IconIndicator icon={UserCircle} count={stats.total - stats.withAliasCt} label="Senza Alias Contatto" isDark={isDark} onClick={() => toggleProgressFilter("alias_ct")} active={progressFilter === "alias_ct"} verified={verified.aliasCt} />
          </div>

          {/* ── ROW 3: Search + sort (compact) ── */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${th.dim}`} />
              <Input placeholder="Cerca partner..." value={search} onChange={e => setSearch(e.target.value)} className={`pl-8 h-7 rounded-lg text-xs ${th.input}`} />
            </div>
            <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
              <SelectTrigger className={`w-[100px] h-7 rounded-lg text-[11px] ${th.selTrigger}`}><SelectValue /></SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="name_asc" className="text-xs">Nome A-Z</SelectItem>
                <SelectItem value="rating_desc" className="text-xs">Rating ↓</SelectItem>
                <SelectItem value="contacts_desc" className="text-xs">Contatti ↓</SelectItem>
              </SelectContent>
            </Select>
            <span className={cn("text-[10px] tabular-nums whitespace-nowrap", th.dim)}>
              {isLoading ? "..." : `${filteredPartners.length}${progressFilter ? " filtrati" : ""}`}
            </span>
          </div>

          {/* ═══ FILTER ACTION BAR ═══ */}
          {progressFilter && filteredPartners.length > 0 && (
            <FilterActionBar
              filter={progressFilter}
              count={filteredPartners.length}
              isDark={isDark}
              onDownload={async () => {
                const filteredWcaIds = filteredPartners
                  .map((p: any) => p.wca_id)
                  .filter((id: number | null): id is number => id != null);
                if (filteredWcaIds.length === 0) {
                  toast.error("Nessun partner filtrato ha un WCA ID scaricabile");
                  return;
                }
                const sessionOk = await ensureSession();
                if (!sessionOk) { toast.error("Sessione WCA non attiva."); return; }
                const { data: activeJobs } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
                if (activeJobs && activeJobs.length > 0) { toast.error("Job già in corso."); return; }
                const primaryCode = countryCodes[0] || "";
                const primaryName = countryNames.length > 1 ? `${countryNames[0]} +${countryNames.length - 1}` : countryNames[0] || "";
                const jobId = await createJob.mutateAsync({
                  country_code: primaryCode, country_name: primaryName,
                  network_name: networks.length > 0 ? networks.join(", ") : "Tutti",
                  wca_ids: filteredWcaIds, delay_seconds: Math.max(delay, 10),
                });
                if (jobId && onJobCreated) onJobCreated(jobId);
              }}
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

        {/* ═══ WIZARD (collapsible, horizontal) ═══ */}
        {wizardOpen && (
          <div className="px-3 pb-1.5 flex-shrink-0 animate-in fade-in slide-in-from-top-2 duration-200">
            <div className={cn("rounded-xl border p-2", isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-slate-50/60 border-slate-200/60")}>
              {wizardStep === 4 ? (
                <div className="flex items-center gap-2 py-1">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className={cn("text-sm font-bold", isDark ? "text-emerald-400" : "text-emerald-600")}>Paese completato!</span>
                </div>
              ) : (
                <>
                  {/* Horizontal step indicators */}
                  <div className="flex items-center gap-1 mb-2">
                    <HorizStep step={1} active={wizardStep === 1} done={missingProfiles === 0} isDark={isDark} icon={Download} label="Profili" missing={missingProfiles} />
                    <div className={cn("flex-shrink-0 w-4 h-px", isDark ? "bg-white/[0.1]" : "bg-slate-200")} />
                    <HorizStep step={2} active={wizardStep === 2} done={missingDeep === 0} isDark={isDark} icon={Telescope} label="Deep" missing={missingDeep} />
                    <div className={cn("flex-shrink-0 w-4 h-px", isDark ? "bg-white/[0.1]" : "bg-slate-200")} />
                    <HorizStep step={3} active={wizardStep === 3} done={missingAliasCo === 0 && missingAliasCt === 0} isDark={isDark} icon={Wand2} label="Alias" missing={missingAliasCo + missingAliasCt} />
                  </div>

                  {/* Active step expanded content */}
                  {wizardStep === 1 && !isScanning && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <DownloadChoice selected={downloadMode === "new"} onClick={() => setDownloadMode("new")} isDark={isDark} icon={FolderDown} title="Nuovi" description={`${missingIds.length} da importare`} count={missingIds.length} color="text-sky-400" />
                        <DownloadChoice selected={downloadMode === "no_profile"} onClick={() => setDownloadMode("no_profile")} isDark={isDark} icon={FileText} title="Incompleti" description={`${noProfileInDirectoryCount + missingIds.length} senza profilo`} count={noProfileInDirectoryCount + missingIds.length} color="text-amber-400" />
                        <DownloadChoice selected={downloadMode === "all"} onClick={() => setDownloadMode("all")} isDark={isDark} icon={RefreshCw} title="Tutti" description={`Aggiorna ${totalCount} partner`} count={totalCount} color="text-violet-400" />
                      </div>
                      <div className={cn("flex items-center justify-between text-[10px] font-mono px-1", isDark ? "text-slate-500" : "text-slate-400")}>
                        <span>⏱ {delay}s delay</span>
                        <span>{estimateLabel}</span>
                      </div>
                      <Button onClick={() => handleStartDownload()} disabled={idsToDownload.length === 0 || createJob.isPending}
                        className={cn("w-full h-9 text-xs font-bold rounded-xl transition-all", idsToDownload.length > 0 ? isDark ? "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20" : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30" : "")}>
                        {createJob.isPending ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Avvio...</> : <><Download className="w-4 h-4 mr-1" /> SCARICA {idsToDownload.length}</>}
                      </Button>
                      {hasCache && !scanComplete && (
                        <button onClick={handleStartScan} className={cn("flex items-center gap-1 text-[10px] mx-auto transition-colors", isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600")}>
                          <RefreshCw className="w-3 h-3" /> Sincronizza Directory
                        </button>
                      )}
                    </div>
                  )}
                  {wizardStep === 1 && isScanning && (
                    <div className="text-center space-y-1 py-1">
                      <Loader2 className={cn("w-4 h-4 animate-spin mx-auto", isDark ? "text-amber-400" : "text-amber-500")} />
                      <p className={cn("text-[10px]", isDark ? "text-slate-400" : "text-slate-500")}>{countryName} — Pg {currentPage}</p>
                      {scannedMembers.length > 0 && <p className={cn("text-xs font-mono font-bold", isDark ? "text-white" : "text-slate-800")}>{scannedMembers.length} trovati</p>}
                      {scanError && <p className="text-[10px] text-red-400">⚠️ {scanError}</p>}
                      <Button size="sm" variant="ghost" onClick={() => { abortRef.current = true; setIsScanning(false); setScanComplete(true); }} className="text-[10px]">
                        <Square className="w-3 h-3 mr-1" /> Stop
                      </Button>
                    </div>
                  )}
                  {wizardStep === 2 && (
                    <Button size="sm" className={cn("w-full h-8 text-xs font-bold", isDark ? "bg-cyan-600 hover:bg-cyan-500 text-white" : "bg-cyan-500 hover:bg-cyan-600 text-white")}
                      disabled={deepSearchRunning}
                      onClick={() => {
                        const ids = (partners || []).filter((p: any) => p.raw_profile_html && !(p.enrichment_data as any)?.deep_search_at).map((p: any) => p.id);
                        if (ids.length > 0) onDeepSearch?.(ids);
                      }}>
                      {deepSearchRunning ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> In corso...</> : <><Telescope className="w-3.5 h-3.5 mr-1" /> Deep Search ({missingDeep})</>}
                    </Button>
                  )}
                  {wizardStep === 3 && (
                    <Button size="sm" className={cn("w-full h-8 text-xs font-bold", isDark ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-amber-500 hover:bg-amber-600 text-white")}
                      disabled={aliasGenerating || (missingAliasCo === 0 && missingAliasCt === 0)}
                      onClick={() => onGenerateAliases?.(countryCodes, "company")}>
                      {aliasGenerating ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Generazione...</> : <><Wand2 className="w-3.5 h-3.5 mr-1" /> Genera Alias ({missingAliasCo + missingAliasCt})</>}
                    </Button>
                  )}
                </>
              )}
            </div>
            <div className="max-h-24 overflow-auto space-y-1 mt-1.5">
              <DownloadTerminal />
              <JobMonitor />
            </div>
          </div>
        )}

        {/* ═══ EMPTY STATE: no cache, no partners ═══ */}
        {!isLoading && !hasCache && dbPartners.length === 0 && stats.total === 0 && countryCodes.length > 0 && !wizardOpen && (
          <div className="flex-shrink-0 px-3 pb-2">
            <div className={cn(
              "rounded-xl border-2 border-dashed p-6 text-center space-y-3",
              isDark ? "border-sky-500/20 bg-sky-950/20" : "border-sky-300/40 bg-sky-50/50"
            )}>
              <div className={cn("w-12 h-12 rounded-xl mx-auto flex items-center justify-center",
                isDark ? "bg-sky-500/10" : "bg-sky-100"
              )}>
                <FolderDown className={cn("w-6 h-6", isDark ? "text-sky-400" : "text-sky-500")} />
              </div>
              <div>
                <p className={cn("text-sm font-bold", isDark ? "text-slate-100" : "text-slate-800")}>
                  Nessun dato per {countryName}
                </p>
                <p className={cn("text-xs mt-1", isDark ? "text-slate-400" : "text-slate-500")}>
                  Scansiona la directory WCA per scoprire i partner disponibili
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleStartScan}
                  disabled={isScanning}
                  className={cn("w-full h-10 text-sm font-bold rounded-xl",
                    isDark ? "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-600/20" : "bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/30"
                  )}
                >
                  {isScanning ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Scansione...</> : <><Search className="w-4 h-4 mr-2" /> Scansiona Directory</>}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setDirThenDownload(true); setAutoDownloadPending(true); handleStartScan(); }}
                  disabled={isScanning}
                  className={cn("w-full h-8 text-xs font-semibold rounded-xl",
                    isDark ? "border-white/[0.1] text-slate-300 hover:bg-white/[0.05]" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5" /> Scansiona + Download Automatico
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ PARTNER LIST (immediate, scrollable) ═══ */}
        <div className="flex-1 min-h-0 overflow-y-auto">
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
                  const hasProfile = !!partner.raw_profile_html;
                  const hasEmail = !!partner.email || contacts.some((c: any) => c.email);
                  const hasPhone = !!partner.phone || contacts.some((c: any) => c.direct_phone || c.mobile);
                  const hasDeep = !!(partner.enrichment_data as any)?.deep_search_at;

                  return (
                    <div key={partner.id} onClick={() => handleSelectPartner(partner.id)}
                      className={cn(
                        "px-3 py-2 cursor-pointer transition-all duration-150 group",
                        selectedPartnerId === partner.id
                          ? isDark ? "bg-sky-950/40" : "bg-sky-50"
                          : isDark ? "hover:bg-white/[0.04]" : "hover:bg-sky-50/40",
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Logo */}
                        {getRealLogoUrl(partner.logo_url) ? (
                          <img src={getRealLogoUrl(partner.logo_url)!} alt="" className="w-7 h-7 rounded-md object-contain bg-white/10 border border-white/10 shrink-0" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                        ) : (
                          <div className={cn("w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold", isDark ? "bg-white/[0.06] text-slate-500" : "bg-slate-100 text-slate-400")}>
                            {partner.company_name?.charAt(0)}
                          </div>
                        )}

                        {/* Main info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className={cn("font-bold text-xs truncate", isDark ? "text-slate-100" : "text-slate-800")}>{partner.company_name}</p>
                            {partner.company_alias && (
                              <span className={cn("text-[9px] px-1 py-0.5 rounded shrink-0", isDark ? "bg-teal-900/30 text-teal-400" : "bg-teal-100 text-teal-700")}>{partner.company_alias}</span>
                            )}
                            {years > 0 && (
                              <span className="flex items-center gap-0.5 shrink-0">
                                <Trophy className="w-3 h-3 text-amber-500 fill-amber-500" />
                                <span className="text-[10px] font-bold text-amber-500">{years}</span>
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("text-[11px] truncate", isDark ? "text-slate-400" : "text-slate-500")}>{partner.city}</span>
                            {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} size="w-2.5 h-2.5" />}
                            {primaryContact && (
                              <span className={cn("text-[10px] truncate max-w-[80px]", isDark ? "text-slate-500" : "text-slate-400")}>· {primaryContact.name}</span>
                            )}
                          </div>
                        </div>

                        {/* Status dots */}
                        <div className="flex items-center gap-1 shrink-0">
                          <StatusDot ok={hasProfile} label="Profilo" isDark={isDark} />
                          <StatusDot ok={hasEmail} label="Email" isDark={isDark} />
                          <StatusDot ok={hasPhone} label="Telefono" isDark={isDark} />
                          <StatusDot ok={hasDeep} label="Deep Search" isDark={isDark} />
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          {primaryContact?.email && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={(e) => { e.stopPropagation(); setEmailTarget({ email: primaryContact.email, name: primaryContact.name, company: partner.company_name, partnerId: partner.id }); }}
                                  className={cn("p-1 rounded-md transition-all", isDark ? "text-sky-400 hover:bg-sky-500/20" : "text-sky-600 hover:bg-sky-50")}>
                                  <Send className="w-3 h-3" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="left" className="text-xs">{primaryContact.email}</TooltipContent>
                            </Tooltip>
                          )}
                          <ChevronRight className={cn("w-3.5 h-3.5", isDark ? "text-slate-600" : "text-slate-300")} />
                        </div>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </div>
      {emailTarget && (
        <SendEmailDialog open={!!emailTarget} onOpenChange={(open) => { if (!open) setEmailTarget(null); }}
          recipientEmail={emailTarget.email} recipientName={emailTarget.name} companyName={emailTarget.company} partnerId={emailTarget.partnerId} isDark={isDark} />
      )}
    </TooltipProvider>
  );
}

/* ── Icon Indicator (circular with badge) — tri-state ── */
function IconIndicator({ icon: Icon, count, label, isDark, onClick, active, verified }: {
  icon: any; count: number; label: string; isDark: boolean;
  onClick?: () => void; active?: boolean; verified?: boolean;
}) {
  const done = count === 0;
  const verifiedMissing = count > 0 && verified;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={done ? undefined : onClick}
          className={cn(
            "relative w-7 h-7 rounded-full flex items-center justify-center transition-all",
            done
              ? isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
              : verifiedMissing
                ? isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50/80 text-emerald-500"
                : active
                  ? isDark ? "bg-sky-500/20 text-sky-400 ring-1 ring-sky-400/40" : "bg-sky-100 text-sky-600 ring-1 ring-sky-300"
                  : isDark ? "bg-white/[0.05] text-slate-400 hover:bg-white/[0.1]" : "bg-slate-100 text-slate-500 hover:bg-slate-200",
            done ? "cursor-default" : "cursor-pointer"
          )}
        >
          <Icon className="w-3.5 h-3.5" />
          {count > 0 && (
            <span className={cn(
              "absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full flex items-center justify-center text-[8px] font-bold leading-none px-0.5",
              active
                ? "bg-sky-500 text-white"
                : verifiedMissing
                  ? "bg-emerald-500 text-white"
                  : "bg-rose-500 text-white"
            )}>
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {done ? `${label} ✓` : verifiedMissing ? `${label}: ${count} mancanti (verificato ✓)` : `${label}: ${count} mancanti`}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Status Dot (for partner cards) ── */
function StatusDot({ ok, label, isDark }: { ok: boolean; label: string; isDark: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={cn(
          "w-2 h-2 rounded-full transition-colors",
          ok
            ? "bg-emerald-500"
            : isDark ? "bg-white/[0.1]" : "bg-slate-200"
        )} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">
        {ok ? `${label} ✓` : `${label} mancante`}
      </TooltipContent>
    </Tooltip>
  );
}

/* ── Horizontal Wizard Step ── */
function HorizStep({ step, active, done, isDark, icon: Icon, label, missing }: {
  step: number; active: boolean; done: boolean; isDark: boolean;
  icon: any; label: string; missing: number;
}) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all flex-1",
      done ? isDark ? "bg-emerald-500/10" : "bg-emerald-50"
        : active ? isDark ? "bg-sky-500/15 ring-1 ring-sky-500/30" : "bg-sky-50 ring-1 ring-sky-200"
        : isDark ? "bg-white/[0.02] opacity-40" : "bg-slate-50/40 opacity-40"
    )}>
      <span className={cn(
        "w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
        done ? "bg-emerald-500/20 text-emerald-400" : active ? isDark ? "bg-sky-500/20 text-sky-400" : "bg-sky-100 text-sky-600" : isDark ? "bg-white/[0.06] text-slate-600" : "bg-slate-200 text-slate-400"
      )}>
        {done ? <CheckCircle2 className="w-3 h-3" /> : step}
      </span>
      <Icon className={cn("w-3 h-3 shrink-0", done ? "text-emerald-400" : active ? isDark ? "text-sky-400" : "text-sky-600" : isDark ? "text-slate-600" : "text-slate-400")} />
      <span className={cn("text-[10px] font-bold truncate", done ? "text-emerald-500" : active ? isDark ? "text-sky-300" : "text-sky-700" : isDark ? "text-slate-600" : "text-slate-400")}>
        {label}
      </span>
      <span className={cn("text-[9px] font-mono font-bold ml-auto shrink-0", done ? "text-emerald-400" : isDark ? "text-slate-500" : "text-slate-400")}>
        {done ? "✓" : missing}
      </span>
    </div>
  );
}


/* ── Download Choice Card (compact) ── */
function DownloadChoice({ selected, onClick, isDark, icon: Icon, title, description, count, color }: {
  selected: boolean; onClick: () => void; isDark: boolean;
  icon: any; title: string; description: string; count: number; color: string;
}) {
  return (
    <button onClick={onClick} className={cn(
      "w-full text-left rounded-lg border px-2.5 py-1.5 transition-all flex items-center gap-2",
      selected
        ? isDark ? "bg-sky-950/40 border-sky-400/40 ring-1 ring-sky-400/20" : "bg-sky-50 border-sky-300 ring-1 ring-sky-300/40"
        : isDark ? "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]" : "bg-white/60 border-slate-200 hover:bg-slate-50"
    )}>
      <div className={cn(
        "w-6 h-6 rounded-md shrink-0 flex items-center justify-center",
        selected ? isDark ? "bg-sky-500/20" : "bg-sky-100" : isDark ? "bg-white/[0.04]" : "bg-slate-100"
      )}>
        <Icon className={cn("w-3.5 h-3.5", selected ? isDark ? "text-sky-400" : "text-sky-600" : isDark ? "text-slate-500" : "text-slate-400")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-[11px] font-bold", isDark ? "text-slate-200" : "text-slate-700")}>{title}</p>
        <p className={cn("text-[9px] leading-tight", isDark ? "text-slate-500" : "text-slate-400")}>{description}</p>
      </div>
      <span className={cn("text-sm font-mono font-extrabold shrink-0", color)}>{count}</span>
      <div className={cn(
        "w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0",
        selected ? "border-sky-400 bg-sky-400" : isDark ? "border-slate-600" : "border-slate-300"
      )}>
        {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
    </button>
  );
}

/* ── Filter Action Bar ── */
function FilterActionBar({ filter, count, isDark, onDownload, onDeepSearch, onGenerateAlias, deepSearchRunning, aliasGenerating }: {
  filter: string;
  count: number;
  isDark: boolean;
  onDownload: () => void | Promise<void>;
  onDeepSearch: () => void;
  onGenerateAlias: (type: "company" | "contact") => void;
  deepSearchRunning?: boolean;
  aliasGenerating?: boolean;
}) {
  const configs: Record<string, { icon: any; label: string; action: () => void; disabled?: boolean; color: string }> = {
    profiles: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
    email: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
    phone: { icon: Download, label: "Scarica Profili Filtrati", action: onDownload, color: isDark ? "bg-sky-600 hover:bg-sky-500" : "bg-sky-500 hover:bg-sky-600" },
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
