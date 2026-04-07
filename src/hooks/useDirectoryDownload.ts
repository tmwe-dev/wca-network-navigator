import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCreateDownloadJob } from "@/hooks/useDownloadJobs";
// useWcaSession removed — no session gates
import { scrapeWcaDirectory, type DirectoryMember, type DirectoryResult } from "@/lib/api/wcaScraper";

interface UseDirectoryDownloadArgs {
  countryCodes: string[];
  countryNames: string[];
  onJobCreated?: (jobId: string) => void;
  onStartDownload?: (countryCode: string, countryName: string) => void;
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
}

export function useDirectoryDownload({
  countryCodes, countryNames, onJobCreated, onStartDownload,
  directoryOnly: directoryOnlyProp, onDirectoryOnlyChange,
}: UseDirectoryDownloadArgs) {
  const queryClient = useQueryClient();
  const createJob = useCreateDownloadJob();
  // No session gate

  const countryCode = countryCodes[0] || "";
  const countryName = countryNames[0] || "";

  const [selectedNetwork, setSelectedNetwork] = useState<string>("__all__");
  const networks = selectedNetwork === "__all__" ? [] : [selectedNetwork];
  const networkKeys = networks.length > 0 ? networks : [""];
  const [delay, setDelay] = useState(15);
  type DownloadMode = "new" | "no_profile" | "no_email" | "all";
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

  // ── Queries ──
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

  // Partners with profile but no email (excluding confirmed no-contacts)
  const { data: noEmailIds = [] } = useQuery({
    queryKey: ["no-email-wca-ids", countryCodes],
    queryFn: async () => {
      if (countryCodes.length === 0) return [];
      // Get partners with profile but no direct email
      const { data: candidates } = await supabase
        .from("partners")
        .select("id, wca_id")
        .in("country_code", countryCodes)
        .not("wca_id", "is", null)
        .not("raw_profile_html", "is", null)
        .is("email", null);
      if (!candidates || candidates.length === 0) return [];
      // Filter out those with contact emails
      const candidateIds = candidates.map(c => c.id);
      const { data: contactsWithEmail } = await supabase
        .from("partner_contacts")
        .select("partner_id")
        .in("partner_id", candidateIds)
        .not("email", "is", null);
      const hasContactEmail = new Set((contactsWithEmail || []).map(c => c.partner_id));
      const noEmailCandidates = candidates.filter(c => !hasContactEmail.has(c.id));
      // Exclude confirmed no-contacts
      const { data: noContacts } = await supabase
        .from("partners_no_contacts")
        .select("wca_id")
        .in("country_code", countryCodes)
        .eq("resolved", false);
      const noContactsSet = new Set((noContacts || []).map(n => n.wca_id));
      return noEmailCandidates
        .filter(c => c.wca_id && !noContactsSet.has(c.wca_id))
        .map(c => c.wca_id!);
    },
    staleTime: 30_000,
    enabled: countryCodes.length > 0,
  });

  // ── Derived data ──
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
    if (downloadMode === "all") return uniqueIds.length > 0 ? uniqueIds : dbPartners.filter(p => p.wca_id).map(p => p.wca_id);
    if (downloadMode === "no_email") return noEmailIds;
    if (downloadMode === "no_profile") {
      if (uniqueIds.length > 0) {
        const existingNoProfile = uniqueIds.filter(id => noProfileWcaSet.has(id));
        return [...new Set([...missingIds, ...existingNoProfile])];
      }
      return noProfileIds;
    }
    return missingIds;
  }, [downloadMode, uniqueIds, missingIds, noProfileWcaSet, noProfileIds, noEmailIds, dbPartners]);

  const totalTime = idsToDownload.length * (delay + 5);
  const estimateLabel = totalTime >= 3600 ? `~${(totalTime / 3600).toFixed(1)} ore` : totalTime >= 60 ? `~${Math.ceil(totalTime / 60)} min` : `~${totalTime}s`;

  // ── Auto-switch download mode ──
  useEffect(() => {
    if (downloadMode !== "new") return;
    if (missingIds.length === 0 && noProfileInDirectoryCount > 0) { setDownloadMode("no_profile"); return; }
    if (!hasCache && noProfileIds.length > 0) { setDownloadMode("no_profile"); return; }
    if (missingIds.length === 0 && noProfileIds.length === 0 && noEmailIds.length > 0) { setDownloadMode("no_email"); return; }
  }, [missingIds.length, noProfileInDirectoryCount, downloadMode, hasCache, noProfileIds.length, noEmailIds.length]);

  // ── Reset on country change ──
  useEffect(() => {
    setScanComplete(false); setScannedMembers([]); setScanError(null); setAutoDownloadPending(false);
  }, [countryCodes.join(",")]);

  // ── Auto-download after scan ──
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
      for (const key of ["db-partners-for-countries", "no-profile-wca-ids", "partners", "country-stats"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      setDownloadMode("no_profile");
      toast.success(`Pulizia: ${removedCount > 0 ? `${removedCount} obsoleti rimossi. ` : ""}Avvio download...`);
      await new Promise(r => setTimeout(r, 2000));
      await handleStartDownload();
    };
    const timer = setTimeout(runCleanupAndDownload, 1000);
    return () => clearTimeout(timer);
  }, [autoDownloadPending, scanComplete, isScanning]);

  // ── Scan ──
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

    // 🤖 Claude Engine V8: login preventivo prima della scan directory
    try {
      let hasCookie = false;
      try {
        const cached = localStorage.getItem("wca_session_cookie");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.cookie && Date.now() - parsed.savedAt < 8 * 60 * 1000) hasCookie = true;
        }
      } catch { /* malformed cache */ }
      if (!hasCookie) {
        const res = await fetch("https://wca-app.vercel.app/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const data = await res.json();
        if (!data.success || !data.cookies) {
          setScanError("Login WCA fallito — impossibile scansionare");
          setIsScanning(false);
          return;
        }
        try { localStorage.setItem("wca_session_cookie", JSON.stringify({ cookie: data.cookies, savedAt: Date.now() })); } catch { /* storage full or unavailable */ }
      }
    } catch {
      setScanError("Connessione WCA fallita");
      setIsScanning(false);
      return;
    }

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

  // ── Download — 🤖 V8: usa useWcaAppDownload invece di job DB ──
  const handleStartDownload = async () => {
    if (idsToDownload.length === 0) { toast.info("Nessun partner da scaricare"); return; }
    const primaryCode = countryCodes[0] || "";
    const primaryName = countryNames[0] || "";
    // Delega al sistema Claude V8 (useWcaAppDownload)
    if (onStartDownload) {
      onStartDownload(primaryCode, primaryName);
    } else if (onJobCreated) {
      // Fallback legacy: crea job DB
      const jobLabel = countryCodes.length > 1 ? `${primaryName} +${countryCodes.length - 1}` : primaryName;
      const jobId = await createJob.mutateAsync({
        country_code: primaryCode, country_name: jobLabel,
        network_name: networks.length > 0 ? networks.join(", ") : "Tutti",
        wca_ids: idsToDownload, delay_seconds: Math.max(delay, 10),
      });
      if (jobId) onJobCreated(jobId);
    }
  };

  const stopScan = useCallback(() => {
    abortRef.current = true; setIsScanning(false); setScanComplete(true);
  }, []);

  const startScanThenDownload = useCallback(() => {
    setDirThenDownload(true); setAutoDownloadPending(true); handleStartScan();
  }, [handleStartScan]);

  return {
    // State
    selectedNetwork, setSelectedNetwork,
    delay, setDelay,
    downloadMode, setDownloadMode,
    directoryOnly, setDirectoryOnly,
    isScanning, scanComplete, scannedMembers, currentPage, scanError,
    autoDownloadPending,
    // Derived
    cachedMembers, hasCache, dbPartners, dbWcaSet,
    uniqueIds, missingIds, noProfileInDirectoryCount, noProfileIds, noEmailIds,
    idsToDownload, estimateLabel,
    networks, createJob,
    // Actions
    handleStartScan, handleStartDownload, stopScan, startScanThenDownload,
    // ensureSession removed
  };
}
