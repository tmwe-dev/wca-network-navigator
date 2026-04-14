import { useState, useEffect, useRef, useCallback } from "react";
import { Square, Download, AlertTriangle, ArrowRight, RotateCcw, Plug } from "lucide-react";
import { useRAExtensionBridge, type RAScrapingStatus } from "@/hooks/useRAExtensionBridge";
import { useScrapingSettings } from "@/hooks/useScrapingSettings";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { t } from "@/components/download/theme";
import { SearchResultsTable, type SearchResult } from "./SearchResultsTable";
import type { ProspectFilters } from "./ProspectAdvancedFilters";
import { ImportWizard } from "./ImportWizard";

interface Props {
  isDark: boolean;
  atecoCodes: string[];
  regions: string[];
  provinces: string[];
  filters: ProspectFilters;
}

type Phase = "idle" | "searching" | "results" | "scraping" | "done";

export function ProspectImporter({ isDark, atecoCodes, regions, provinces, filters }: Props) {
  const th = t(isDark);
  const { isAvailable, scrapeByAteco: _scrapeByAteco, searchOnly, getScrapingStatus, stopScraping, scrapeSelected } = useRAExtensionBridge();
  const { settings } = useScrapingSettings();

  const [phase, setPhase] = useState<Phase>("idle");
  const [jobBlocked, setJobBlocked] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<RAScrapingStatus | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; msg: string }>>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check for already-running job on mount
  useEffect(() => {
    if (!isAvailable) return;
    getScrapingStatus().then(res => {
      if (res.success && res.active) {
        setJobBlocked(true);
        setPhase("scraping");
        setStatus({
          active: true,
          total: res.total || 0,
          processed: res.processed || 0,
          saved: res.saved || 0,
          errors: res.errors || 0,
          currentCompany: res.currentCompany || "",
          log: res.log || [],
        });
      }
    });
  }, [isAvailable, getScrapingStatus]);

  // Timer for search phase
  const [searchElapsed, setSearchElapsed] = useState(0);
  const searchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "searching") {
      setSearchElapsed(0);
      searchTimerRef.current = setInterval(() => setSearchElapsed(prev => prev + 1), 1000);
    } else {
      if (searchTimerRef.current) clearInterval(searchTimerRef.current);
    }
    return () => { if (searchTimerRef.current) clearInterval(searchTimerRef.current); };
  }, [phase]);

  // Poll status while scraping OR searching
  useEffect(() => {
    if (phase !== "scraping" && phase !== "searching") {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const poll = async () => {
      const res = await getScrapingStatus();
      if (res.success) {
        setStatus({
          active: res.active || false,
          total: res.total || 0,
          processed: res.processed || 0,
          saved: res.saved || 0,
          errors: res.errors || 0,
          currentCompany: res.currentCompany || "",
          log: res.log || [],
        });
        setLogs(res.log || []);
        if (phase === "scraping" && !res.active) {
          setPhase("done");
          setJobBlocked(false);
        }
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, getScrapingStatus]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // ── Wizard params (set when wizard calls onStart) ──
  const [wizardAteco, setWizardAteco] = useState<string[]>(atecoCodes);
  const [wizardRegions, setWizardRegions] = useState<string[]>(regions);
  const [wizardProvinces, setWizardProvinces] = useState<string[]>(provinces);
  const [wizardFilters, setWizardFilters] = useState<ProspectFilters | null>(null);

  // ── Phase 1: Search only ──
  const handleSearch = async (
    overrideAteco?: string[], overrideRegions?: string[],
    overrideProvinces?: string[], overrideFilters?: ProspectFilters
  ) => {
    const ac = overrideAteco ?? wizardAteco;
    const rg = overrideRegions ?? wizardRegions;
    const pr = overrideProvinces ?? wizardProvinces;
    const fl = overrideFilters ?? wizardFilters ?? filters;

    if (ac.length === 0 && rg.length === 0 && pr.length === 0) return;
    const checkRes = await getScrapingStatus();
    if (checkRes.success && checkRes.active) { setJobBlocked(true); return; }

    setPhase("searching");
    setSearchResults([]);
    setSelected(new Set());
    setLogs([]);

    const res = await searchOnly({
      atecoCodes: ac,
      regions: rg.length > 0 ? rg : undefined,
      provinces: pr.length > 0 ? pr : undefined,
      filters: fl,
      delaySeconds: settings.baseDelay,
    });

    if (res.success && res.results && res.results.length > 0) {
      // Dedup against DB using partita_iva
      const deduped = await dedupAgainstDb(res.results as any);
      setSearchResults(deduped);
      // Auto-select only new ones
      const newSet = new Set(deduped.filter(r => !r.inDb).map(r => r.url));
      setSelected(newSet);
      setPhase("results");
      setLogs(res.log || []);
    } else {
      setSearchResults([]);
      setPhase("results");
      setLogs(res.log || [{ time: new Date().toISOString(), msg: res.error || "Nessun risultato trovato" }]);
    }
  };

  const handleWizardStart = ({ atecoCodes: ac, regions: rg, provinces: pr, filters: fl }: { atecoCodes: string[]; regions: string[]; provinces: string[]; filters: ProspectFilters }) => {
    setWizardAteco(ac);
    setWizardRegions(rg);
    setWizardProvinces(pr);
    setWizardFilters(fl);
    handleSearch(ac, rg, pr, fl);
  };

  // ── Dedup: check P.IVA against prospects table ──
  const dedupAgainstDb = async (results: SearchResult[]): Promise<SearchResult[]> => {
    // Get all partita_iva from DB
    const { data: existing } = await supabase
      .from("prospects")
      .select("partita_iva, company_name")
      .not("partita_iva", "is", null);

    const dbPivas = new Set((existing || []).map((e) => e.partita_iva?.trim()).filter(Boolean));
    const dbNames = new Set((existing || []).map((e) => e.company_name?.toLowerCase().trim()).filter(Boolean));

    return results.map(r => ({
      ...r,
      inDb: (r.piva && dbPivas.has(r.piva.trim())) || dbNames.has(r.name.toLowerCase().trim()),
    }));
  };

  // ── Phase 2: Scrape selected ──
  const handleScrape = async () => {
    if (selected.size === 0) return;
    const checkRes = await getScrapingStatus();
    if (checkRes.success && checkRes.active) { setJobBlocked(true); return; }

    const urls = searchResults.filter(r => selected.has(r.url)).map(r => ({ name: r.name, url: r.url }));
    setPhase("scraping");
    setJobBlocked(false);
    setLogs([]);
    setStatus(null);

    await scrapeSelected({
      items: urls,
      delaySeconds: settings.baseDelay,
      batchSize: 5,
    });
  };

  // ── Selection handlers ──
  const toggleUrl = useCallback((url: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(searchResults.map(r => r.url)));
  }, [searchResults]);

  const selectNew = useCallback(() => {
    setSelected(new Set(searchResults.filter(r => !r.inDb).map(r => r.url)));
  }, [searchResults]);

  const deselectAll = useCallback(() => setSelected(new Set()), []);

  const handleReset = () => {
    setPhase("idle");
    setSearchResults([]);
    setSelected(new Set());
    setStatus(null);
    setLogs([]);
  };

  const progress = status && status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

  // When idle, render the wizard directly (it handles ext status internally)
  if (phase === "idle") {
    return (
      <div className="h-full flex flex-col">
        {jobBlocked && (
          <div className={`flex items-center gap-2 text-xs px-3 py-2 mx-4 mt-4 rounded-xl ${isDark
            ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
            : "bg-amber-50 text-amber-600 border border-amber-200"
          }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            Un job è già in esecuzione. Attendi il completamento.
          </div>
        )}
        <div className="flex-1 min-h-0">
          <ImportWizard
            isDark={isDark}
            isExtAvailable={isAvailable}
            onStart={handleWizardStart}
            initialAtecoCodes={atecoCodes}
            initialRegions={regions}
            initialProvinces={provinces}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">
      {/* Extension status */}
      <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${isAvailable
        ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
        : "bg-destructive/10 text-destructive border border-destructive/20"
      }`}>
        <Plug className="w-3.5 h-3.5" />
        {isAvailable ? "Estensione RA connessa" : "Estensione RA non rilevata — installala e ricarica la pagina"}
      </div>

      {jobBlocked && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          Un job è già in esecuzione. Attendi il completamento.
        </div>
      )}

      {/* ═══ PHASE: SEARCHING ═══ */}
      {phase === "searching" && (
        <div className={`rounded-xl border p-4 space-y-3 bg-card/40 border-border`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full border-2 border-t-transparent animate-spin border-primary`} />
              <span className={`text-sm font-medium ${th.h2}`}>Ricerca in corso...</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono ${th.dim}`}>
                {Math.floor(searchElapsed / 60).toString().padStart(2, "0")}:{(searchElapsed % 60).toString().padStart(2, "0")}
              </span>
              <button
                onClick={() => { stopScraping(); setPhase("idle"); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30`}
              >
                <Square className="w-3 h-3" />Annulla
              </button>
            </div>
          </div>
          <p className={`text-xs ${th.sub}`}>L'estensione sta cercando le aziende su Report Aziende. I log appariranno sotto.</p>
        </div>
      )}

      {/* ═══ PHASE: RESULTS ═══ */}
      {phase === "results" && (
        <>
          <div className={`rounded-xl border p-3 space-y-2 bg-card/40 border-border`}>
            <div className="flex items-center justify-between">
              <h3 className={`text-sm font-semibold text-foreground`}>
                Fase 2: Seleziona e Scarica
              </h3>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-[10px]`}>
                  {searchResults.length} trovate
                </Badge>
                <button onClick={handleReset} className={`text-[10px] px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80`}>
                  <RotateCcw className="w-3 h-3 inline mr-1" />Nuova ricerca
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleScrape}
                disabled={selected.size === 0 || !isAvailable || jobBlocked}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30 border border-emerald-500/30`}
              >
                <Download className="w-4 h-4" />
                Scarica {selected.size} profili
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <span className={`text-xs ${th.dim}`}>Delay: {settings.baseDelay}s</span>
            </div>
          </div>

          <div className={`flex-1 min-h-0 rounded-xl border overflow-hidden bg-card/20 border-border`}>
            <SearchResultsTable
              results={searchResults}
              selected={selected}
              onToggle={toggleUrl}
              onSelectAll={selectAll}
              onSelectNew={selectNew}
              onDeselectAll={deselectAll}
              isDark={isDark}
            />
          </div>
        </>
      )}

      {/* ═══ PHASE: SCRAPING / DONE ═══ */}
      {(phase === "scraping" || phase === "done") && status && (
        <div className={`rounded-xl border p-4 space-y-3 bg-card/40 border-border`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-semibold text-foreground`}>
                {status.active ? `Scaricamento profilo ${status.processed + 1} di ${status.total}...` : "Scraping completato"}
              </h3>
              {status.currentCompany && status.active && (
                <p className={`text-xs mt-0.5 truncate text-primary`}>
                  ➜ {status.currentCompany}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`text-[10px] bg-emerald-500/15 text-emerald-500 border-emerald-500/20`}>
                ✅ {status.saved} salvati
              </Badge>
              {status.errors > 0 && (
                <Badge variant="secondary" className={`text-[10px] bg-destructive/15 text-destructive border-destructive/20`}>
                  ❌ {status.errors} errori
                </Badge>
              )}
              <Badge variant="secondary" className={`text-[10px] bg-muted text-muted-foreground`}>
                {status.processed}/{status.total}
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="h-2" />

          <div className="flex items-center gap-2">
            {status.active ? (
              <button
                onClick={() => stopScraping()}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30`}
              >
                <Square className="w-3.5 h-3.5" />Ferma
              </button>
            ) : (
              <button onClick={handleReset} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80`}>
                <RotateCcw className="w-3.5 h-3.5" />Nuova ricerca
              </button>
            )}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className={`rounded-xl border flex-1 min-h-0 flex flex-col bg-card/20 border-border`}>
          <div className={`px-3 py-2 text-xs font-medium border-b text-muted-foreground border-border`}>
            Log ({logs.length})
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-[11px]">
            {logs.map((l, i) => (
              <div key={i} className="text-muted-foreground">
                <span className="text-muted-foreground/50">
                  {new Date(l.time).toLocaleTimeString()}
                </span>{" "}
                {l.msg}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
