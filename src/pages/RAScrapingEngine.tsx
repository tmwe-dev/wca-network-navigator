import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Activity,
  Download,
  Play,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
  Pause,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Real hooks and data
import { useRAExtensionBridge } from "@/hooks/useRAExtensionBridge";
import { useRAJobs, useCreateRAJob, useUpdateRAJob } from "@/hooks/useRAJobs";
import { useUpsertRAProspect } from "@/hooks/useRAProspects";
import { ATECO_TREE } from "@/data/atecoCategories";
import { REGIONI_ITALIANE, PROVINCE_ITALIANE } from "@/data/italianProvinces";

// Type definitions
interface RAScrapingJob {
  id: string;
  job_type: string;
  status: string;
  ateco_codes: string[];
  regions: string[];
  provinces: string[];
  min_fatturato: number;
  max_fatturato: number;
  total_items: number;
  processed_items: number;
  saved_items: number;
  error_count: number;
  delay_seconds: number;
  batch_size: number;
  started_at: string;
  completed_at: string | null;
  error_log: string[];
  created_at: string;
}

interface SearchResult {
  id: string;
  name: string;
  piva: string;
  città: string;
  regione: string;
  ateco: string;
  fatturato: string;
  dipendenti: number;
  email: boolean;
  pec: boolean;
  telefono: boolean;
}

interface ScrapingStatus {
  status: string;
  processed_items: number;
  total_items: number;
  saved_items: number;
  error_count: number;
  log: string[];
}

export default function RAScrapingEngine() {
  // Real hooks
  const { isAvailable, searchOnly, scrapeSelected, scrapeByAteco, getScrapingStatus, stopScraping } = useRAExtensionBridge();
  const { data: jobs = [], isLoading: jobsLoading } = useRAJobs();
  const createJobMutation = useCreateRAJob();
  const updateJobMutation = useUpdateRAJob();
  const upsertProspectMutation = useUpsertRAProspect();

  // State management
  const [selectedAtecoCodes, setSelectedAtecoCodes] = useState<Set<string>>(new Set());
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [selectedProvinces, setSelectedProvinces] = useState<Set<string>>(new Set());
  const [fatturatoBudget, setFatturatoBudget] = useState<[number, number]>([0, 100]);
  const [dipendentiRange, setDipendentiRange] = useState<[number, number]>([0, 500]);
  const [contactFilters, setContactFilters] = useState({
    email: false,
    pec: false,
    phone: false,
  });
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

  // Get available provinces based on selected regions
  const availableProvinces = PROVINCE_ITALIANE.filter((p) => selectedRegions.has(p.regione));

  // Handle ATECO code selection (multi-select)
  const toggleAteco = (code: string) => {
    const newSet = new Set(selectedAtecoCodes);
    if (newSet.has(code)) {
      newSet.delete(code);
    } else {
      newSet.add(code);
    }
    setSelectedAtecoCodes(newSet);
  };

  // Handle region selection (multi-select)
  const toggleRegion = (region: string) => {
    const newSet = new Set(selectedRegions);
    if (newSet.has(region)) {
      newSet.delete(region);
    } else {
      newSet.add(region);
    }
    setSelectedRegions(newSet);
  };

  // Handle province selection (multi-select)
  const toggleProvince = (province: string) => {
    const newSet = new Set(selectedProvinces);
    if (newSet.has(province)) {
      newSet.delete(province);
    } else {
      newSet.add(province);
    }
    setSelectedProvinces(newSet);
  };

  // Handle result selection
  const handleSelectResult = (id: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedResults(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedResults.size === searchResults.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(searchResults.map((r) => r.id)));
    }
  };

  // Handle search
  const handleSearch = useCallback(async () => {
    if (selectedAtecoCodes.size === 0 || selectedRegions.size === 0) {
      alert("Seleziona almeno un codice ATECO e una regione");
      return;
    }

    try {
      setIsSearching(true);
      setStatusLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] Ricerca avviata...`]);

      const results = await searchOnly({
        atecoCodes: Array.from(selectedAtecoCodes),
        regions: Array.from(selectedRegions),
        provinces: Array.from(selectedProvinces),
      });

      setSearchResults(results);
      setSearchPerformed(true);
      setSelectedResults(new Set());
      setStatusLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Trovate ${results.length} aziende`,
      ]);
    } catch (error) {
      setStatusLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Errore nella ricerca: ${error}`,
      ]);
    } finally {
      setIsSearching(false);
    }
  }, [selectedAtecoCodes, selectedRegions, selectedProvinces, searchOnly]);

  // Handle scraping selected items
  const handleScrapeSelected = useCallback(async () => {
    if (selectedResults.size === 0) {
      alert("Seleziona almeno un'azienda");
      return;
    }

    try {
      setIsScraping(true);
      const selectedItems = searchResults.filter((r) => selectedResults.has(r.id));

      setStatusLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Scraping di ${selectedItems.length} aziende avviato...`,
      ]);

      // Create job
      const job = await createJobMutation.mutateAsync({
        job_type: "scrape_selected",
        status: "in_progress",
        ateco_codes: Array.from(selectedAtecoCodes),
        regions: Array.from(selectedRegions),
        provinces: Array.from(selectedProvinces),
        min_fatturato: fatturatoBudget[0],
        max_fatturato: fatturatoBudget[1],
        total_items: selectedItems.length,
        processed_items: 0,
        saved_items: 0,
        error_count: 0,
        delay_seconds: Math.floor(delaySeconds / 1000),
        batch_size: batchSize,
      });

      setActiveJobId(job.id);

      // Call scraping
      await scrapeSelected({ items: selectedItems });

      // Poll for status and update prospects
      const pollInterval = setInterval(async () => {
        const status = await getScrapingStatus();
        if (!status) {
          clearInterval(pollInterval);
          return;
        }

        // Update logs
        if (status.log && status.log.length > 0) {
          setStatusLogs((prev) => {
            const newLogs = [...prev];
            status.log.forEach((log) => {
              if (!newLogs.includes(log)) {
                newLogs.push(`[${new Date().toLocaleTimeString()}] ${log}`);
              }
            });
            return newLogs.slice(-20); // Keep last 20 logs
          });
        }

        // Update job
        await updateJobMutation.mutateAsync({
          id: job.id,
          processed_items: status.processed_items,
          saved_items: status.saved_items,
          error_count: status.error_count,
        });

        // Save prospects if available
        if (status.results && status.results.length > 0) {
          for (const prospect of status.results) {
            await upsertProspectMutation.mutateAsync(prospect);
          }
        }

        // Stop polling if done
        if (status.status === "completed" || status.status === "error") {
          clearInterval(pollInterval);
          await updateJobMutation.mutateAsync({
            id: job.id,
            status: status.status,
            completed_at: new Date().toISOString(),
          });
          setIsScraping(false);
        }
      }, 3000);
    } catch (error) {
      setStatusLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Errore durante lo scraping: ${error}`,
      ]);
      setIsScraping(false);
    }
  }, [selectedResults, searchResults, selectedAtecoCodes, selectedRegions, selectedProvinces, fatturatoBudget, delaySeconds, batchSize, scrapeSelected, getScrapingStatus, createJobMutation, updateJobMutation, upsertProspectMutation]);

  // Handle full scraping
  const handleScrapeFull = useCallback(async () => {
    if (selectedAtecoCodes.size === 0 || selectedRegions.size === 0) {
      alert("Seleziona almeno un codice ATECO e una regione");
      return;
    }

    try {
      setIsScraping(true);
      setStatusLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Scraping completo avviato...`,
      ]);

      // Create job
      const job = await createJobMutation.mutateAsync({
        job_type: "scrape_full",
        status: "in_progress",
        ateco_codes: Array.from(selectedAtecoCodes),
        regions: Array.from(selectedRegions),
        provinces: Array.from(selectedProvinces),
        min_fatturato: fatturatoBudget[0],
        max_fatturato: fatturatoBudget[1],
        total_items: 0,
        processed_items: 0,
        saved_items: 0,
        error_count: 0,
        delay_seconds: Math.floor(delaySeconds / 1000),
        batch_size: batchSize,
      });

      setActiveJobId(job.id);

      // Call scraping
      await scrapeByAteco({
        atecoCodes: Array.from(selectedAtecoCodes),
        regions: Array.from(selectedRegions),
        delaySeconds: Math.floor(delaySeconds / 1000),
        batchSize: batchSize,
      });

      // Poll for status
      const pollInterval = setInterval(async () => {
        const status = await getScrapingStatus();
        if (!status) {
          clearInterval(pollInterval);
          return;
        }

        // Update logs
        if (status.log && status.log.length > 0) {
          setStatusLogs((prev) => {
            const newLogs = [...prev];
            status.log.forEach((log) => {
              if (!newLogs.includes(log)) {
                newLogs.push(`[${new Date().toLocaleTimeString()}] ${log}`);
              }
            });
            return newLogs.slice(-20);
          });
        }

        // Update job
        await updateJobMutation.mutateAsync({
          id: job.id,
          total_items: status.total_items || 0,
          processed_items: status.processed_items,
          saved_items: status.saved_items,
          error_count: status.error_count,
        });

        // Save prospects
        if (status.results && status.results.length > 0) {
          for (const prospect of status.results) {
            await upsertProspectMutation.mutateAsync(prospect);
          }
        }

        // Stop polling if done
        if (status.status === "completed" || status.status === "error") {
          clearInterval(pollInterval);
          await updateJobMutation.mutateAsync({
            id: job.id,
            status: status.status,
            completed_at: new Date().toISOString(),
          });
          setIsScraping(false);
        }
      }, 3000);
    } catch (error) {
      setStatusLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Errore durante lo scraping: ${error}`,
      ]);
      setIsScraping(false);
    }
  }, [selectedAtecoCodes, selectedRegions, selectedProvinces, fatturatoBudget, delaySeconds, batchSize, scrapeByAteco, getScrapingStatus, createJobMutation, updateJobMutation, upsertProspectMutation]);

  // Handle stop scraping
  const handleStopScraping = useCallback(async () => {
    try {
      await stopScraping();
      setIsScraping(false);
      setStatusLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Scraping interrotto dall'utente`,
      ]);
    } catch (error) {
      setStatusLogs((prev) => [
        ...prev,
        `[${new Date().toLocaleTimeString()}] Errore nell'interruzione: ${error}`,
      ]);
    }
  }, [stopScraping]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "linear-gradient(135deg, #0f1419 0%, #1a1f2e 100%)" }}>
      {/* Header with glassmorphism */}
      <div className="flex-shrink-0 border-b border-cyan-500/20 px-3 sm:px-4 py-3 sm:py-4" style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)" }}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-cyan-400 flex items-center gap-2">
                <Zap className="w-6 h-6 sm:w-7 sm:h-7" />
                Motore Scraping RA
              </h1>
              <p className="text-xs sm:text-sm text-cyan-300/60 mt-1">
                Centro di controllo scraping per Report Aziende (reportaziende.it)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status Bar with glassmorphism */}
      <div className="flex-shrink-0 border-b border-cyan-500/20 px-3 sm:px-4 py-2" style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.4)" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className={`w-2 h-2 rounded-full animate-pulse ${isAvailable ? "bg-cyan-400" : "bg-red-500"}`} />
              <span className="font-medium text-cyan-300">{isAvailable ? "Connesso" : "Disconnesso"}</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-cyan-500/30 rounded-full" />
            <span className="text-cyan-300/60 truncate hidden sm:inline">
              Estensione RA: {isAvailable ? "Attiva" : "Inattiva"}
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-cyan-300/60 hidden xs:inline">
              Status: {isScraping ? "Scraping..." : "Pronto"}
            </span>
            <Badge className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Clock className="w-3 h-3 mr-1" />
              {isScraping ? "In corso" : "Pronto"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3" style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderBottom: "1px solid rgba(34, 211, 238, 0.2)" }}>
              <TabsTrigger value="search" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-300/60">
                <Search className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Ricerca</span>
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-300/60">
                <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Job</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-300/60">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Config</span>
              </TabsTrigger>
            </TabsList>

            {/* Search Tab */}
            <TabsContent value="search" className="space-y-4 mt-4">
              {/* Filters Card with glassmorphism */}
              <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg text-cyan-300">Filtri di Ricerca</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-cyan-300/60">
                    Configura i criteri di ricerca per le aziende
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* ATECO Codes - Multi-select */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-cyan-300">Codici ATECO (Seleziona uno o più)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(34, 211, 238, 0.2)" }}>
                      {ATECO_TREE.filter((ateco) => ateco.livello === 2).map((ateco) => (
                        <div key={ateco.codice} className="flex items-center gap-2">
                          <Checkbox
                            id={`ateco-${ateco.codice}`}
                            checked={selectedAtecoCodes.has(ateco.codice)}
                            onCheckedChange={() => toggleAteco(ateco.codice)}
                          />
                          <label
                            htmlFor={`ateco-${ateco.codice}`}
                            className="text-xs sm:text-sm cursor-pointer text-cyan-300/80 hover:text-cyan-300"
                          >
                            {ateco.codice}
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedAtecoCodes.size > 0 && (
                      <div className="text-xs text-cyan-300/60">
                        {selectedAtecoCodes.size} ATECO selezionati
                      </div>
                    )}
                  </div>

                  {/* Regions - Multi-select */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-cyan-300">Regioni (Seleziona una o più)</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(34, 211, 238, 0.2)" }}>
                      {REGIONI_ITALIANE.map((regione) => (
                        <div key={regione} className="flex items-center gap-2">
                          <Checkbox
                            id={`region-${regione}`}
                            checked={selectedRegions.has(regione)}
                            onCheckedChange={() => toggleRegion(regione)}
                          />
                          <label
                            htmlFor={`region-${regione}`}
                            className="text-xs sm:text-sm cursor-pointer text-cyan-300/80 hover:text-cyan-300"
                          >
                            {regione}
                          </label>
                        </div>
                      ))}
                    </div>
                    {selectedRegions.size > 0 && (
                      <div className="text-xs text-cyan-300/60">
                        {selectedRegions.size} regioni selezionate
                      </div>
                    )}
                  </div>

                  {/* Provinces - Multi-select */}
                  {availableProvinces.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium text-cyan-300">Province (Opzionale)</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(34, 211, 238, 0.2)" }}>
                        {availableProvinces.map((provincia) => (
                          <div key={provincia.nome} className="flex items-center gap-2">
                            <Checkbox
                              id={`province-${provincia.nome}`}
                              checked={selectedProvinces.has(provincia.nome)}
                              onCheckedChange={() => toggleProvince(provincia.nome)}
                            />
                            <label
                              htmlFor={`province-${provincia.nome}`}
                              className="text-xs sm:text-sm cursor-pointer text-cyan-300/80 hover:text-cyan-300"
                            >
                              {provincia.nome} ({provincia.sigla})
                            </label>
                          </div>
                        ))}
                      </div>
                      {selectedProvinces.size > 0 && (
                        <div className="text-xs text-cyan-300/60">
                          {selectedProvinces.size} province selezionate
                        </div>
                      )}
                    </div>
                  )}

                  {/* Fatturato Range */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-cyan-300">
                      Fatturato: €{fatturatoBudget[0]}K - €{fatturatoBudget[1]}K
                    </label>
                    <Slider
                      value={fatturatoBudget}
                      onValueChange={setFatturatoBudget}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  {/* Dipendenti Range */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-cyan-300">
                      Dipendenti: {dipendentiRange[0]} - {dipendentiRange[1]}
                    </label>
                    <Slider
                      value={dipendentiRange}
                      onValueChange={setDipendentiRange}
                      min={0}
                      max={500}
                      step={10}
                      className="w-full"
                    />
                  </div>

                  {/* Contact Filters */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-cyan-300">Filtri Contatti</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="filter-email"
                          checked={contactFilters.email}
                          onCheckedChange={(checked) =>
                            setContactFilters({ ...contactFilters, email: !!checked })
                          }
                        />
                        <label htmlFor="filter-email" className="text-xs sm:text-sm cursor-pointer text-cyan-300/80">
                          Con Email
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="filter-pec"
                          checked={contactFilters.pec}
                          onCheckedChange={(checked) =>
                            setContactFilters({ ...contactFilters, pec: !!checked })
                          }
                        />
                        <label htmlFor="filter-pec" className="text-xs sm:text-sm cursor-pointer text-cyan-300/80">
                          Con PEC
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="filter-phone"
                          checked={contactFilters.phone}
                          onCheckedChange={(checked) =>
                            setContactFilters({ ...contactFilters, phone: !!checked })
                          }
                        />
                        <label htmlFor="filter-phone" className="text-xs sm:text-sm cursor-pointer text-cyan-300/80">
                          Con Telefono
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                    <Button
                      onClick={handleSearch}
                      disabled={isSearching || !isAvailable}
                      className="h-8 sm:h-9 text-xs sm:text-sm bg-cyan-600 hover:bg-cyan-700 text-white"
                    >
                      <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
                      {isSearching ? "Ricerca..." : "Cerca"}
                    </Button>
                    <Button
                      onClick={handleScrapeFull}
                      disabled={isScraping || !isAvailable}
                      className="h-8 sm:h-9 text-xs sm:text-sm bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
                      {isScraping ? "Scraping..." : "Scraping Completo"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Results Card */}
              {searchPerformed && (
                <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base sm:text-lg text-cyan-300">Risultati Ricerca</CardTitle>
                      <CardDescription className="text-xs sm:text-sm text-cyan-300/60">
                        {searchResults.length} aziende trovate
                      </CardDescription>
                    </div>
                    {selectedResults.size > 0 && (
                      <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">{selectedResults.size} selezionate</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid rgba(34, 211, 238, 0.2)" }}>
                      <Checkbox
                        id="select-all"
                        checked={selectedResults.size === searchResults.length && searchResults.length > 0}
                        onCheckedChange={handleSelectAll}
                      />
                      <label htmlFor="select-all" className="text-xs sm:text-sm font-medium text-cyan-300">
                        Seleziona tutto
                      </label>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(34, 211, 238, 0.2)" }}>
                            <th className="text-left py-2 px-2 font-medium w-8 text-cyan-300" />
                            <th className="text-left py-2 px-2 font-medium min-w-[120px] text-cyan-300">
                              Azienda
                            </th>
                            <th className="text-left py-2 px-2 font-medium min-w-[100px] text-cyan-300">
                              P.IVA
                            </th>
                            <th className="text-left py-2 px-2 font-medium min-w-[80px] text-cyan-300">
                              Città
                            </th>
                            <th className="text-left py-2 px-2 font-medium min-w-[80px] text-cyan-300">ATECO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {searchResults.map((result) => (
                            <tr key={result.id} className="hover:bg-cyan-500/10" style={{ borderBottom: "1px solid rgba(34, 211, 238, 0.1)" }}>
                              <td className="py-2 px-2">
                                <Checkbox
                                  checked={selectedResults.has(result.id)}
                                  onCheckedChange={() => handleSelectResult(result.id)}
                                />
                              </td>
                              <td className="py-2 px-2 font-medium text-cyan-300">{result.name}</td>
                              <td className="py-2 px-2 text-cyan-300/60">{result.piva}</td>
                              <td className="py-2 px-2 text-cyan-300/80">{result.città}</td>
                              <td className="py-2 px-2 text-cyan-300/60">{result.ateco}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selectedResults.size > 0 && (
                      <div className="pt-2" style={{ borderTop: "1px solid rgba(34, 211, 238, 0.2)" }}>
                        <Button
                          onClick={handleScrapeSelected}
                          disabled={isScraping || !isAvailable}
                          className="w-full h-8 sm:h-9 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white"
                        >
                          <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
                          {isScraping ? "Scraping..." : `Scraping Selezionati (${selectedResults.size})`}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Active Jobs Tab */}
            <TabsContent value="jobs" className="space-y-4 mt-4">
              {/* Jobs Panel */}
              <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg text-cyan-300">Job in Esecuzione</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-cyan-300/60">
                    Monitoraggio lavori di scraping attivi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {jobsLoading ? (
                    <div className="text-center py-8 text-cyan-300/60">Caricamento job...</div>
                  ) : jobs.length === 0 ? (
                    <div className="text-center py-8 text-cyan-300/60">Nessun job in corso</div>
                  ) : (
                    jobs.map((job: RAScrapingJob) => {
                      const progress = job.total_items > 0 ? (job.processed_items / job.total_items) * 100 : 0;
                      return (
                        <div key={job.id} className="space-y-3 pb-4 last:border-0 last:pb-0" style={{ borderBottom: "1px solid rgba(34, 211, 238, 0.2)" }}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {job.status === "in_progress" ? (
                                <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
                              ) : job.status === "completed" ? (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                              ) : (
                                <AlertCircle className="w-4 h-4 text-red-400" />
                              )}
                              <span className="text-xs sm:text-sm font-medium text-cyan-300">
                                {job.status === "in_progress" ? "In Elaborazione" : job.status === "completed" ? "Completato" : "Errore"}
                              </span>
                            </div>
                            <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                              {Math.round(progress)}%
                            </Badge>
                          </div>

                          <div className="space-y-2">
                            <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: "rgba(34, 211, 238, 0.1)" }}>
                              <div
                                className="bg-cyan-500 h-full transition-all"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <div className="grid grid-cols-4 gap-2 text-xs">
                              <div className="rounded p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.1)" }}>
                                <div className="font-medium text-cyan-300">{job.total_items}</div>
                                <div className="text-cyan-300/60">Totali</div>
                              </div>
                              <div className="rounded p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.1)" }}>
                                <div className="font-medium text-cyan-400">{job.processed_items}</div>
                                <div className="text-cyan-300/60">Elaborati</div>
                              </div>
                              <div className="rounded p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.1)" }}>
                                <div className="font-medium text-green-400">{job.saved_items}</div>
                                <div className="text-cyan-300/60">Salvati</div>
                              </div>
                              <div className="rounded p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.1)" }}>
                                <div className="font-medium text-red-400">{job.error_count}</div>
                                <div className="text-cyan-300/60">Errori</div>
                              </div>
                            </div>
                          </div>

                          {job.status === "in_progress" && (
                            <Button
                              onClick={handleStopScraping}
                              size="sm"
                              className="w-full h-7 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40"
                              variant="outline"
                            >
                              <Pause className="w-3 h-3 mr-1.5" />
                              Interrompi Scraping
                            </Button>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>

              {/* Logs Panel */}
              <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg text-cyan-300">Log Terminale</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-cyan-300/60">
                    Ultimi {statusLogs.length} log (ultimo 20)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg p-3 sm:p-4 text-xs space-y-1 max-h-64 overflow-y-auto border" style={{ borderColor: "rgba(34, 211, 238, 0.2)", backgroundColor: "rgba(0, 0, 0, 0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
                    {statusLogs.length === 0 ? (
                      <div className="text-cyan-300/60 text-center py-4">Nessun log disponibile</div>
                    ) : (
                      statusLogs.map((log, idx) => (
                        <div key={idx} className="text-cyan-300/80 hover:text-cyan-300">
                          <span className="text-cyan-500">{log.split("]")[0]}]</span>{log.substring(log.indexOf("]") + 1)}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg text-cyan-300">Configurazione Scraping</CardTitle>
                  <CardDescription className="text-xs sm:text-sm text-cyan-300/60">
                    Impostazioni per il controllo dei lavori
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Request Delay */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-medium text-cyan-300">
                        Ritardo tra Richieste (ms)
                      </label>
                      <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">{delaySeconds}ms</Badge>
                    </div>
                    <Slider
                      value={[delaySeconds]}
                      onValueChange={(value) => setDelaySeconds(value[0])}
                      min={100}
                      max={5000}
                      step={100}
                      className="w-full"
                    />
                    <p className="text-xs text-cyan-300/60">
                      Aumenta il ritardo per ridurre il carico sul server
                    </p>
                  </div>

                  {/* Batch Size */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-medium text-cyan-300">Dimensione Batch</label>
                      <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">{batchSize}</Badge>
                    </div>
                    <Slider
                      value={[batchSize]}
                      onValueChange={(value) => setBatchSize(value[0])}
                      min={5}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-cyan-300/60">
                      Numero di record da elaborare per batch
                    </p>
                  </div>

                  {/* Info */}
                  <div className="flex gap-2 p-3 sm:p-4 rounded-lg border" style={{ backgroundColor: "rgba(34, 211, 238, 0.1)", borderColor: "rgba(34, 211, 238, 0.2)" }}>
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-cyan-300/80">
                      Le impostazioni vengono applicate ai nuovi job. I job in esecuzione non sono interessati.
                    </div>
                  </div>

                  <Button className="w-full h-8 sm:h-9 text-xs sm:text-sm bg-cyan-600 hover:bg-cyan-700 text-white">
                    Salva Configurazione
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
