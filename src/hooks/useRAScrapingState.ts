import { useState, useCallback } from "react";
import { useRAExtensionBridge } from "@/hooks/useRAExtensionBridge";
import { useRAJobs, useCreateRAJob, useUpdateRAJob } from "@/hooks/useRAJobs";
import { useUpsertRAProspect } from "@/hooks/useRAProspects";
import { PROVINCE_ITALIANE } from "@/data/italianProvinces";

export interface SearchResult {
  id: string;
  name: string;
  piva: string;
  città: string;
  ateco: string;
  codice_fiscale?: string;
}

export function useRAScrapingState() {
  const { isAvailable, searchOnly, scrapeSelected, scrapeByAteco, getScrapingStatus, stopScraping } = useRAExtensionBridge();
  const { data: jobs = [], isLoading: jobsLoading } = useRAJobs();
  const createJobMutation = useCreateRAJob();
  const updateJobMutation = useUpdateRAJob();
  const upsertProspectMutation = useUpsertRAProspect();

  const [selectedAtecoCodes, setSelectedAtecoCodes] = useState<Set<string>>(new Set());
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [selectedProvinces, setSelectedProvinces] = useState<Set<string>>(new Set());
  const [fatturatoBudget, setFatturatoBudget] = useState<[number, number]>([0, 100]);
  const [dipendentiRange, setDipendentiRange] = useState<[number, number]>([0, 500]);
  const [contactFilters, setContactFilters] = useState({ email: false, pec: false, phone: false });
  const [delaySeconds, setDelaySeconds] = useState(500);
  const [batchSize, setBatchSize] = useState(25);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isScraping, setIsScraping] = useState(false);
  const [activeTab, setActiveTab] = useState("search");
  const [statusLogs, setStatusLogs] = useState<string[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const availableProvinces = PROVINCE_ITALIANE.filter((p) => selectedRegions.has(p.regione));

  const toggleSet = (set: Set<string>, value: string): Set<string> => {
    const next = new Set(set);
    next.has(value) ? next.delete(value) : next.add(value);
    return next;
  };

  const toggleAteco = (code: string) => setSelectedAtecoCodes(prev => toggleSet(prev, code));
  const toggleRegion = (region: string) => setSelectedRegions(prev => toggleSet(prev, region));
  const toggleProvince = (province: string) => setSelectedProvinces(prev => toggleSet(prev, province));
  const handleSelectResult = (id: string) => setSelectedResults(prev => toggleSet(prev, id));
  const handleSelectAll = () => {
    setSelectedResults(prev => prev.size === searchResults.length ? new Set() : new Set(searchResults.map(r => r.id)));
  };

  const addLog = (msg: string) => {
    setStatusLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`].slice(-20));
  };

  const pollStatus = useCallback(async (jobId: string) => {
    const pollInterval = setInterval(async () => {
      const status = await getScrapingStatus();
      if (!status) { clearInterval(pollInterval); return; }

      const s = status as Record<string, unknown>;
      if (Array.isArray(s.log)) {
        (s.log as string[]).forEach((log: string) => addLog(log));
      }

      await updateJobMutation.mutateAsync({
        id: jobId,
        total_items: (s.total_items as number) || 0,
        processed_items: s.processed_items as number,
        saved_items: s.saved_items as number,
        error_count: s.error_count as number,
      });

      if (Array.isArray(s.results) && s.results.length) {
        for (const prospect of s.results) {
          await upsertProspectMutation.mutateAsync(prospect);
        }
      }

      if (s.status === "completed" || s.status === "error") {
        clearInterval(pollInterval);
        const finalStatus = s.status === "error" ? "failed" : "completed";
        await updateJobMutation.mutateAsync({
          id: jobId, status: finalStatus as "completed" | "failed", completed_at: new Date().toISOString(),
        });
        setIsScraping(false);
      }
    }, 3000);
  }, [getScrapingStatus, updateJobMutation, upsertProspectMutation]);

  const handleSearch = useCallback(async () => {
    if (selectedAtecoCodes.size === 0 || selectedRegions.size === 0) {
      alert("Seleziona almeno un codice ATECO e una regione");
      return;
    }
    try {
      setIsSearching(true);
      addLog("Ricerca avviata...");
      const results = await searchOnly({
        atecoCodes: Array.from(selectedAtecoCodes),
        regions: Array.from(selectedRegions),
        provinces: Array.from(selectedProvinces),
      });
      setSearchResults(results as unknown as SearchResult[]);
      setSearchPerformed(true);
      setSelectedResults(new Set());
      addLog(`Trovate ${Array.isArray(results) ? results.length : 0} aziende`);
    } catch (error) {
      addLog(`Errore nella ricerca: ${error}`);
    } finally {
      setIsSearching(false);
    }
  }, [selectedAtecoCodes, selectedRegions, selectedProvinces, searchOnly]);

  const handleScrapeSelected = useCallback(async () => {
    if (selectedResults.size === 0) { alert("Seleziona almeno un'azienda"); return; }
    try {
      setIsScraping(true);
      const selectedItems = searchResults.filter(r => selectedResults.has(r.id));
      addLog(`Scraping di ${selectedItems.length} aziende avviato...`);
      const job = await createJobMutation.mutateAsync({
        job_type: "scrape_batch",
        ateco_codes: Array.from(selectedAtecoCodes),
        regions: Array.from(selectedRegions),
        provinces: Array.from(selectedProvinces),
        min_fatturato: fatturatoBudget[0],
        max_fatturato: fatturatoBudget[1],
        delay_seconds: Math.floor(delaySeconds / 1000),
        batch_size: batchSize,
      });
      setActiveJobId(job.id);
      await scrapeSelected({ items: selectedItems });
      pollStatus(job.id);
    } catch (error) {
      addLog(`Errore durante lo scraping: ${error}`);
      setIsScraping(false);
    }
  }, [selectedResults, searchResults, selectedAtecoCodes, selectedRegions, selectedProvinces, fatturatoBudget, delaySeconds, batchSize, scrapeSelected, createJobMutation, pollStatus]);

  const handleScrapeFull = useCallback(async () => {
    if (selectedAtecoCodes.size === 0 || selectedRegions.size === 0) {
      alert("Seleziona almeno un codice ATECO e una regione");
      return;
    }
    try {
      setIsScraping(true);
      addLog("Scraping completo avviato...");
      const job = await createJobMutation.mutateAsync({
        job_type: "scrape_batch",
        ateco_codes: Array.from(selectedAtecoCodes),
        regions: Array.from(selectedRegions),
        provinces: Array.from(selectedProvinces),
        min_fatturato: fatturatoBudget[0],
        max_fatturato: fatturatoBudget[1],
        delay_seconds: Math.floor(delaySeconds / 1000),
        batch_size: batchSize,
      });
      setActiveJobId(job.id);
      await scrapeByAteco({
        atecoCodes: Array.from(selectedAtecoCodes),
        regions: Array.from(selectedRegions),
        delaySeconds: Math.floor(delaySeconds / 1000),
        batchSize: batchSize,
      });
      pollStatus(job.id);
    } catch (error) {
      addLog(`Errore durante lo scraping: ${error}`);
      setIsScraping(false);
    }
  }, [selectedAtecoCodes, selectedRegions, selectedProvinces, fatturatoBudget, delaySeconds, batchSize, scrapeByAteco, createJobMutation, pollStatus]);

  const handleStopScraping = useCallback(async () => {
    try {
      await stopScraping();
      setIsScraping(false);
      addLog("Scraping interrotto dall'utente");
    } catch (error) {
      addLog(`Errore nell'interruzione: ${error}`);
    }
  }, [stopScraping]);

  return {
    isAvailable, jobs, jobsLoading,
    selectedAtecoCodes, selectedRegions, selectedProvinces,
    fatturatoBudget, setFatturatoBudget,
    dipendentiRange, setDipendentiRange,
    contactFilters, setContactFilters,
    delaySeconds, setDelaySeconds,
    batchSize, setBatchSize,
    searchResults, selectedResults, searchPerformed,
    isSearching, isScraping,
    activeTab, setActiveTab,
    statusLogs,
    availableProvinces,
    toggleAteco, toggleRegion, toggleProvince,
    handleSelectResult, handleSelectAll,
    handleSearch, handleScrapeSelected, handleScrapeFull, handleStopScraping,
  };
}
