import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { getWcaCookie, setWcaCookie } from "@/lib/wcaCookieStore";
import { getPartnersByCountries, deletePartnersWithRelations } from "@/data/partners";
import { findDirectoryCache, upsertDirectoryCache } from "@/data/directoryCache";
import { findJobsByStatusSelect, updateDownloadJob, updateJobItemsByJobIdAndStatus } from "@/data/downloadJobs";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useCreateDownloadJob } from "@/hooks/useDownloadJobs";
import { scrapeWcaDirectory, type DirectoryMember, type DirectoryResult } from "@/lib/api/wcaScraper";
import { createLogger } from "@/lib/log";

const log = createLogger("useActionPanelLogic");

type DownloadMode = "new" | "no_profile" | "all";

interface UseActionPanelProps {
  selectedCountries: { code: string; name: string }[];
  networks: string[];
  networkKeys: string[];
  delay: number;
  directoryOnly: boolean;
  onJobCreated?: (jobId: string) => void;
}

export function useActionPanelLogic({
  selectedCountries, networks, networkKeys, delay, directoryOnly: _directoryOnly, onJobCreated,
}: UseActionPanelProps) {
  const queryClient = useQueryClient();
  const createJob = useCreateDownloadJob();
  const countryCodes = selectedCountries.map(c => c.code);

  const [downloadMode, setDownloadMode] = useState<DownloadMode>("new");
  const [skipCachedDirs, setSkipCachedDirs] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scannedMembers, setScannedMembers] = useState<DirectoryMember[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentCountryIdx, setCurrentCountryIdx] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [skippedCountries, setSkippedCountries] = useState<string[]>([]);
  const abortRef = useRef(false);
  const [dirThenDownload, setDirThenDownload] = useState(false);
  const [autoDownloadPending, setAutoDownloadPending] = useState(false);

  // ── Queries ──
  const { data: cachedEntries = [], isLoading: loadingCache } = useQuery({
    queryKey: ["directory-cache", countryCodes, networkKeys],
    queryFn: async () => {
      if (countryCodes.length === 0) return [];
      try {
        return await findDirectoryCache(countryCodes, networks.length > 0 ? networks : undefined);
      } catch (e: unknown) {
        toast({ title: "Errore directory cache", description: (e instanceof Error ? e.message : String(e)), variant: "destructive" });
        return [];
      }
    },
    staleTime: 30_000,
    enabled: countryCodes.length > 0,
  });

  const { data: dbPartners = [], isLoading: loadingDb } = useQuery({
    queryKey: ["db-partners-for-countries", countryCodes],
    queryFn: async () => {
      if (countryCodes.length === 0) return [];
      const data = await getPartnersByCountries(countryCodes, "wca_id, company_name, city, country_code, country_name, updated_at");
      return (data || []).map(p => ({
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
      const data = await getPartnersByCountries(countryCodes, "wca_id", { noProfile: true });
      return (data || []).map(p => p.wca_id!);
    },
    staleTime: 30_000,
    enabled: countryCodes.length > 0,
  });

  // ── Derived ──
  const cachedMembers: DirectoryMember[] = cachedEntries.flatMap((entry) => {
    const members = entry.members as any[]; // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON column type mismatch
    return (members || []).map((m) => ({
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
  const downloadedCount = uniqueIds.filter(id => dbWcaSet.has(id)).length;
  const totalCount = uniqueIds.length;

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
  const estimateLabel = totalTime >= 3600
    ? `~${(totalTime / 3600).toFixed(1)} ore`
    : totalTime >= 60 ? `~${Math.ceil(totalTime / 60)} min` : `~${totalTime}s`;

  // ── Effects ──
  useEffect(() => {
    if (missingIds.length === 0 && noProfileInDirectoryCount > 0 && downloadMode === "new") {
      setDownloadMode("no_profile");
    }
  }, [missingIds.length, noProfileInDirectoryCount, downloadMode]);

  useEffect(() => {
    setScanComplete(false); setScannedMembers([]); setScanError(null);
    setSkippedCountries([]); setAutoDownloadPending(false);
  }, [countryCodes.join(",")]);

  // ── Scan ──
  const saveScanToCache = useCallback(async (countryCode: string, netKey: string, scanned: DirectoryMember[], total: number, pages: number) => {
    const membersJson = scanned.map(m => ({ company_name: m.company_name, city: m.city, country: m.country, country_code: m.country_code, wca_id: m.wca_id }));
    await upsertDirectoryCache({
      country_code: countryCode, network_name: netKey, members: membersJson as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON column type mismatch
      total_results: total, total_pages: pages, scanned_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
  }, [queryClient]);

  const handleStartScan = useCallback(async () => {
    setIsScanning(true); setScanError(null); setSkippedCountries([]); abortRef.current = false;
    const allMembers: DirectoryMember[] = [];
    const skipped: string[] = [];

    const waitIfHidden = () => new Promise<void>((resolve) => {
      if (!document.hidden) { resolve(); return; }
      const handler = () => { if (!document.hidden) { document.removeEventListener("visibilitychange", handler); resolve(); } };
      document.addEventListener("visibilitychange", handler);
    });

    const cachedCountryCodes = new Set(cachedEntries.map((e) => e.country_code));

    for (let ci = 0; ci < selectedCountries.length; ci++) {
      if (abortRef.current) break;
      setCurrentCountryIdx(ci);
      const country = selectedCountries[ci];
      if (skipCachedDirs && cachedCountryCodes.has(country.code)) continue;
      if (ci > 0 && ci % 5 === 0) setScannedMembers([...allMembers]);

      for (const netKey of networkKeys) {
        if (abortRef.current) break;
        let page = 1; let hasNext = true;
        let countryTotal = 0; let countryPages = 0;
        const countryMembers: DirectoryMember[] = [];
        let countryFailed = false;

        while (hasNext && !abortRef.current) {
          await waitIfHidden();
          setCurrentPage(page);
          let result: DirectoryResult | null = null;
          let lastError = "";
          try {
            result = await scrapeWcaDirectory(country.code, netKey, page);
            if (!result.success) { lastError = result.error || "Errore sconosciuto"; result = null; }
          } catch (err) { lastError = err instanceof Error ? err.message : "Errore di rete"; result = null; }

          if (!result || !result.success) { setScanError(`${country.name}: ${lastError}`); countryFailed = true; break; }

          if (result.members.length > 0) {
            const newMembers = result.members.map(m => ({ ...m, country: m.country || country.name, country_code: country.code }));
            countryMembers.push(...newMembers); allMembers.push(...newMembers);
            if (allMembers.length % 100 < 50) setScannedMembers([...allMembers]);
          }
          countryTotal = result.pagination.total_results;
          countryPages = result.pagination.total_pages;
          hasNext = result.pagination.has_next_page || result.members.length >= 50;
          page++;
          if (hasNext && !abortRef.current) await new Promise(r => setTimeout(r, Math.max(delay * 1000, 3000)));
        }

        if (countryFailed) { const label = `${country.name} (${country.code})`; if (!skipped.includes(label)) { skipped.push(label); setSkippedCountries([...skipped]); } }
        if (countryMembers.length > 0) await saveScanToCache(country.code, netKey, countryMembers, countryTotal, countryPages);
      }

      if (ci < selectedCountries.length - 1 && !abortRef.current) {
        await waitIfHidden();
        await new Promise(r => setTimeout(r, Math.max(delay * 1000, 10000)));
      }
    }

    setScannedMembers([...allMembers]);
    setIsScanning(false); setScanComplete(true);
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
    queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
  }, [selectedCountries, networkKeys, saveScanToCache, queryClient, skipCachedDirs, cachedEntries, delay]);

  const abortScan = useCallback(() => { abortRef.current = true; setIsScanning(false); setScanComplete(true); }, []);

  // ── Download ──
  const executeDownload = useCallback(async () => {
    if (idsToDownload.length === 0) {
      toast({ title: "Nessun partner da scaricare", description: "Tutti i partner sono già nel database." });
      return;
    }

    try {
      const cookie = getWcaCookie();
      if (!cookie) {
        const res = await fetch("https://wca-app.vercel.app/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
        const data = await res.json();
        if (!data.success || !data.cookies) { toast({ title: "Login WCA fallito", description: data.error || "Riprova.", variant: "destructive" }); return; }
        setWcaCookie(data.cookies);
      }
    } catch (e) { log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) }); toast({ title: "Connessione WCA fallita", variant: "destructive" }); return; }

    const activeJobs = await findJobsByStatusSelect(["pending", "running"], "id, status, updated_at", 1);
    if (activeJobs.length > 0) {
      const job = activeJobs[0];
      const ageMs = Date.now() - new Date(job.updated_at).getTime();
      if (job.status === "running" && ageMs > 120_000) {
        await updateDownloadJob(job.id, { status: "stopped", error_message: "Resettato — job orfano" });
        await updateJobItemsByJobIdAndStatus(job.id, "processing", { status: "pending" });
      } else {
        toast({ title: "Job già in corso", description: "Attendi il completamento.", variant: "destructive" }); return;
      }
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
  }, [idsToDownload, sourceMembers, selectedCountries, networks, delay, createJob, onJobCreated]);

  // Auto-download after scan
  useEffect(() => {
    if (!autoDownloadPending || !scanComplete || isScanning) return;
    setAutoDownloadPending(false);

    const runCleanupAndDownload = async () => {
      const freshWcaIds = new Set(scannedMembers.filter(m => m.wca_id).map(m => m.wca_id!));
      if (freshWcaIds.size === 0) { toast({ title: "⚠️ Nessun partner trovato", variant: "destructive" }); return; }

      const dbPartnersForCleanup = await getPartnersByCountries(countryCodes, "id, wca_id");
      const dbList = dbPartnersForCleanup || [];
      const stalePartners = dbList.filter(p => p.wca_id && !freshWcaIds.has(p.wca_id));

      if (stalePartners.length > 0) {
        const staleIds = stalePartners.map(p => p.id);
        await deletePartnersWithRelations(staleIds);
      }

      await queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
      await queryClient.invalidateQueries({ queryKey: ["no-profile-wca-ids"] });
      await queryClient.invalidateQueries({ queryKey: ["partners"] });
      setDownloadMode("no_profile");

      toast({ title: "🧹 Pulizia completata", description: `Directory: ${freshWcaIds.size} partner.` });
      await new Promise(r => setTimeout(r, 2000));
      await executeDownload();
    };

    const timer = setTimeout(runCleanupAndDownload, 1000);
    return () => clearTimeout(timer);
  }, [autoDownloadPending, scanComplete, isScanning]);

  // Auto-scan if no cache
  useEffect(() => {
    if (countryCodes.length > 0 && !loadingCache && !loadingDb && !hasCache && !isScanning && !scanComplete) {
      handleStartScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCache, loadingDb, hasCache, countryCodes.length]);

  return {
    downloadMode, setDownloadMode,
    skipCachedDirs, setSkipCachedDirs,
    isScanning, scanComplete,
    scannedMembers, currentPage, currentCountryIdx,
    scanError, skippedCountries,
    dirThenDownload, setDirThenDownload,
    autoDownloadPending, setAutoDownloadPending,
    hasCache, totalCount, downloadedCount, missingIds,
    noProfileInDirectoryCount, idsToDownload, estimateLabel,
    isLoading: loadingCache || loadingDb,
    createJob,
    handleStartScan, abortScan, executeDownload,
  };
}
