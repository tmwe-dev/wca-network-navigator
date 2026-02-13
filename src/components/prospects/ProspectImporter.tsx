import { useState, useEffect, useRef, useMemo } from "react";
import { Play, Square, Download, Plug, X, ChevronsUpDown, Check, Search, AlertTriangle } from "lucide-react";
import { useRAExtensionBridge, type RAScrapingStatus } from "@/hooks/useRAExtensionBridge";
import { useScrapingSettings } from "@/hooks/useScrapingSettings";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ATECO_TREE } from "@/data/atecoCategories";
import { REGIONI_ITALIANE, PROVINCE_ITALIANE } from "@/data/italianProvinces";
import { t } from "@/components/download/theme";

interface Props {
  isDark: boolean;
}

function MultiSelectPopover({
  label,
  placeholder,
  options,
  selected,
  onToggle,
  onClear,
  disabled,
  isDark,
  renderLabel,
}: {
  label: string;
  placeholder: string;
  options: Array<{ value: string; label: string; sub?: string }>;
  selected: string[];
  onToggle: (v: string) => void;
  onClear: () => void;
  disabled: boolean;
  isDark: boolean;
  renderLabel?: (v: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = new Set(selected);

  return (
    <div>
      <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            disabled={disabled}
            className={`w-full mt-1 flex items-center justify-between px-3 py-2 rounded-lg text-sm border transition-all disabled:opacity-50 ${isDark
              ? "bg-white/5 border-white/10 text-white hover:bg-white/[0.08]"
              : "bg-white border-slate-200 text-slate-800 hover:bg-slate-50"
            }`}
          >
            <span className={selected.length === 0 ? (isDark ? "text-slate-500" : "text-slate-400") : ""}>
              {selected.length === 0 ? placeholder : `${selected.length} selezionat${selected.length === 1 ? "o" : "i"}`}
            </span>
            <ChevronsUpDown className="w-3.5 h-3.5 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className={`w-72 p-0 ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`} align="start">
          <Command className={isDark ? "bg-slate-900" : ""}>
            <CommandInput placeholder="Cerca..." className={isDark ? "text-white" : ""} />
            <CommandList>
              <CommandEmpty className={isDark ? "text-slate-500" : ""}>Nessun risultato</CommandEmpty>
              {selected.length > 0 && (
                <CommandGroup>
                  <CommandItem onSelect={onClear} className={`text-xs ${isDark ? "text-rose-400" : "text-rose-500"}`}>
                    <X className="w-3 h-3 mr-1" /> Deseleziona tutto
                  </CommandItem>
                </CommandGroup>
              )}
              <CommandGroup>
                <ScrollArea className="max-h-56">
                  {options.map(opt => (
                    <CommandItem
                      key={opt.value}
                      value={`${opt.value} ${opt.label}`}
                      onSelect={() => onToggle(opt.value)}
                      className={isDark ? "text-slate-300 aria-selected:bg-white/10" : ""}
                    >
                      <div className={`w-4 h-4 mr-2 rounded border flex items-center justify-center flex-shrink-0 ${
                        selectedSet.has(opt.value)
                          ? isDark ? "bg-sky-500 border-sky-500" : "bg-sky-500 border-sky-500"
                          : isDark ? "border-slate-600" : "border-slate-300"
                      }`}>
                        {selectedSet.has(opt.value) && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-medium">{opt.label}</span>
                        {opt.sub && <span className={`ml-1.5 text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>{opt.sub}</span>}
                      </div>
                    </CommandItem>
                  ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selected.map(v => (
            <button
              key={v}
              onClick={() => onToggle(v)}
              disabled={disabled}
              className={`group flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all ${isDark
                ? "bg-sky-500/15 text-sky-300 border border-sky-500/25"
                : "bg-sky-50 text-sky-700 border border-sky-200"
              } disabled:opacity-50`}
            >
              {renderLabel ? renderLabel(v) : v}
              <X className="w-2.5 h-2.5 opacity-50 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProspectImporter({ isDark }: Props) {
  const th = t(isDark);
  const { isAvailable, scrapeByAteco, getScrapingStatus, stopScraping } = useRAExtensionBridge();
  const { settings } = useScrapingSettings();

  const [selectedAteco, setSelectedAteco] = useState<string[]>([]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedProvinces, setSelectedProvinces] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [jobBlocked, setJobBlocked] = useState(false);
  const [status, setStatus] = useState<RAScrapingStatus | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; msg: string }>>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ATECO options (level 2+3)
  const atecoOptions = useMemo(() =>
    ATECO_TREE.filter(a => a.livello >= 2).map(a => ({
      value: a.codice,
      label: `${a.codice} — ${a.descrizione}`,
      sub: a.livello === 3 ? `(${a.padre})` : undefined,
    })),
  []);

  const regionOptions = useMemo(() =>
    REGIONI_ITALIANE.map(r => ({ value: r, label: r })),
  []);

  // Filter provinces by selected regions
  const provinceOptions = useMemo(() => {
    const filtered = selectedRegions.length > 0
      ? PROVINCE_ITALIANE.filter(p => selectedRegions.includes(p.regione))
      : PROVINCE_ITALIANE;
    return filtered.map(p => ({ value: p.sigla, label: `${p.sigla} — ${p.nome}`, sub: p.regione }));
  }, [selectedRegions]);

  // Clear provinces that no longer match when regions change
  useEffect(() => {
    if (selectedRegions.length > 0) {
      const validSigle = new Set(PROVINCE_ITALIANE.filter(p => selectedRegions.includes(p.regione)).map(p => p.sigla));
      setSelectedProvinces(prev => prev.filter(s => validSigle.has(s)));
    }
  }, [selectedRegions]);

  const toggle = (list: string[], item: string) =>
    list.includes(item) ? list.filter(i => i !== item) : [...list, item];

  // Check if job already running on mount
  useEffect(() => {
    if (!isAvailable) return;
    getScrapingStatus().then(res => {
      if (res.success && res.active) {
        setJobBlocked(true);
        setIsRunning(true);
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

  // Poll status while running
  useEffect(() => {
    if (!isRunning) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const poll = async () => {
      const res = await getScrapingStatus();
      if (res.success) {
        const s: RAScrapingStatus = {
          active: res.active || false,
          total: res.total || 0,
          processed: res.processed || 0,
          saved: res.saved || 0,
          errors: res.errors || 0,
          currentCompany: res.currentCompany || "",
          log: res.log || [],
        };
        setStatus(s);
        setLogs(res.log || []);
        if (!res.active) {
          setIsRunning(false);
          setJobBlocked(false);
        }
      }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning, getScrapingStatus]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleStart = async () => {
    if (selectedAteco.length === 0) return;

    // Check sequential lock
    const checkRes = await getScrapingStatus();
    if (checkRes.success && checkRes.active) {
      setJobBlocked(true);
      return;
    }

    setIsRunning(true);
    setJobBlocked(false);
    setLogs([]);
    setStatus(null);

    const res = await scrapeByAteco({
      atecoCode: selectedAteco[0],
      region: selectedRegions[0] || undefined,
      province: selectedProvinces[0] || undefined,
      delaySeconds: settings.delayDefault,
      batchSize: 5,
    });

    if (res.success) {
      setStatus(prev => prev ? { ...prev, active: false } : null);
    }
    setIsRunning(false);
    setJobBlocked(false);
  };

  const handleStop = async () => {
    await stopScraping();
  };

  const progress = status && status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;
  const phase = status?.active
    ? status.total === 0
      ? "Ricerca risultati..."
      : `Scaricamento profilo ${status.processed + 1} di ${status.total}...`
    : status
      ? "Completato"
      : "";

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-y-auto">
      {/* Extension status */}
      <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${isAvailable
        ? (isDark ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border border-emerald-200")
        : (isDark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200")
      }`}>
        <Plug className="w-3.5 h-3.5" />
        {isAvailable ? "Estensione RA connessa" : "Estensione RA non rilevata — installala e ricarica la pagina"}
      </div>

      {/* Job blocked warning */}
      {jobBlocked && (
        <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl ${isDark
          ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
          : "bg-amber-50 text-amber-600 border border-amber-200"
        }`}>
          <AlertTriangle className="w-3.5 h-3.5" />
          Un job è già in esecuzione. Attendi il completamento prima di avviarne un altro.
        </div>
      )}

      {/* Config form */}
      <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/60 border-white/80"}`}>
        <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-800"}`}>Configura Scraping</h3>

        <div className="grid grid-cols-3 gap-3">
          <MultiSelectPopover
            label="Codice ATECO *"
            placeholder="Seleziona ATECO..."
            options={atecoOptions}
            selected={selectedAteco}
            onToggle={v => setSelectedAteco(prev => toggle(prev, v))}
            onClear={() => setSelectedAteco([])}
            disabled={isRunning}
            isDark={isDark}
          />
          <MultiSelectPopover
            label="Regioni"
            placeholder="Tutte le regioni"
            options={regionOptions}
            selected={selectedRegions}
            onToggle={v => setSelectedRegions(prev => toggle(prev, v))}
            onClear={() => setSelectedRegions([])}
            disabled={isRunning}
            isDark={isDark}
          />
          <MultiSelectPopover
            label="Province"
            placeholder="Tutte le province"
            options={provinceOptions}
            selected={selectedProvinces}
            onToggle={v => setSelectedProvinces(prev => toggle(prev, v))}
            onClear={() => setSelectedProvinces([])}
            disabled={isRunning}
            isDark={isDark}
          />
        </div>

        <div className="flex items-center gap-2 pt-1">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={!isAvailable || selectedAteco.length === 0 || jobBlocked}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-40 ${isDark
                ? "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30"
                : "bg-sky-500 text-white hover:bg-sky-600"
              }`}
            >
              <Play className="w-4 h-4" />
              Avvia Scraping
            </button>
          ) : (
            <button
              onClick={handleStop}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isDark
                ? "bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/30"
                : "bg-rose-500 text-white hover:bg-rose-600"
              }`}
            >
              <Square className="w-4 h-4" />
              Ferma
            </button>
          )}
          <span className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            Delay: {settings.delayDefault}s tra le richieste
          </span>
        </div>
      </div>

      {/* Progress */}
      {status && (
        <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/60 border-white/80"}`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-800"}`}>
                {status.active ? phase : "Scraping completato"}
              </h3>
              {status.currentCompany && status.active && (
                <p className={`text-xs mt-0.5 truncate ${isDark ? "text-sky-400" : "text-sky-600"}`}>
                  ➜ {status.currentCompany}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={`text-[10px] ${isDark ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" : "bg-emerald-50 text-emerald-600"}`}>
                ✅ {status.saved} salvati
              </Badge>
              {status.errors > 0 && (
                <Badge variant="secondary" className={`text-[10px] ${isDark ? "bg-red-500/15 text-red-400 border-red-500/20" : "bg-red-50 text-red-600"}`}>
                  ❌ {status.errors} errori
                </Badge>
              )}
              <Badge variant="secondary" className={`text-[10px] ${isDark ? "bg-white/10 text-slate-300" : "bg-slate-100 text-slate-600"}`}>
                {status.processed}/{status.total}
              </Badge>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className={`rounded-xl border flex-1 min-h-0 flex flex-col ${isDark ? "bg-black/20 border-white/[0.08]" : "bg-slate-50 border-slate-200"}`}>
          <div className={`px-3 py-2 text-xs font-medium border-b ${isDark ? "text-slate-400 border-white/[0.08]" : "text-slate-500 border-slate-200"}`}>
            Log ({logs.length})
          </div>
          <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-0.5 font-mono text-[11px]">
            {logs.map((l, i) => (
              <div key={i} className={isDark ? "text-slate-400" : "text-slate-500"}>
                <span className={isDark ? "text-slate-600" : "text-slate-300"}>
                  {new Date(l.time).toLocaleTimeString()}
                </span>{" "}
                {l.msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!status && !isRunning && (
        <div className="flex-1 flex items-center justify-center">
          <div className={`text-center space-y-2 max-w-md ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            <Download className={`w-12 h-12 mx-auto ${isDark ? "text-white/10" : "text-slate-200"}`} />
            <p className="text-sm">Seleziona uno o più codici ATECO per cercare e scaricare i profili aziendali da Report Aziende.</p>
            <p className="text-xs">Puoi filtrare per regione e provincia. I dati verranno salvati automaticamente nel database.</p>
          </div>
        </div>
      )}
    </div>
  );
}
