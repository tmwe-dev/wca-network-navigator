import { useState, useEffect, useRef } from "react";
import { Play, Square, Download, Plug, AlertTriangle } from "lucide-react";
import { useRAExtensionBridge, type RAScrapingStatus } from "@/hooks/useRAExtensionBridge";
import { useScrapingSettings } from "@/hooks/useScrapingSettings";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { t } from "@/components/download/theme";

interface Props {
  isDark: boolean;
  atecoCodes: string[];
  regions: string[];
  provinces: string[];
}


export function ProspectImporter({ isDark, atecoCodes, regions, provinces }: Props) {
  const th = t(isDark);
  const { isAvailable, scrapeByAteco, getScrapingStatus, stopScraping } = useRAExtensionBridge();
  const { settings } = useScrapingSettings();
  const [isRunning, setIsRunning] = useState(false);
  const [jobBlocked, setJobBlocked] = useState(false);
  const [status, setStatus] = useState<RAScrapingStatus | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; msg: string }>>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);


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
    if (atecoCodes.length === 0) return;

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
      atecoCodes: atecoCodes,
      regions: regions.length > 0 ? regions : undefined,
      provinces: provinces.length > 0 ? provinces : undefined,
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
        <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-800"}`}>Avvia Scraping</h3>

        {atecoCodes.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {atecoCodes.map(c => (
              <span key={c} className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium ${isDark ? "bg-sky-500/15 text-sky-300 border border-sky-500/25" : "bg-sky-50 text-sky-700 border border-sky-200"}`}>
                {c}
              </span>
            ))}
            {regions.length > 0 && regions.map(r => (
              <span key={r} className={`px-2 py-0.5 rounded text-[10px] font-medium ${isDark ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>
                {r}
              </span>
            ))}
            {provinces.length > 0 && provinces.map(p => (
              <span key={p} className={`px-2 py-0.5 rounded text-[10px] font-medium ${isDark ? "bg-amber-500/15 text-amber-300 border border-amber-500/25" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {p}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={!isAvailable || atecoCodes.length === 0 || jobBlocked}
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
            {atecoCodes.length === 0 ? (
              <>
                <p className="text-sm">Seleziona almeno un codice ATECO dal pannello a sinistra.</p>
                <p className="text-xs">Puoi anche filtrare per regione e provincia.</p>
              </>
            ) : (
              <>
                <p className="text-sm">Premi "Avvia Scraping" per cercare e scaricare i profili aziendali da Report Aziende.</p>
                <p className="text-xs">I dati verranno salvati automaticamente nel database.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
