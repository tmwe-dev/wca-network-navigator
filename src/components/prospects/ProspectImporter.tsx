import { useState, useEffect, useRef } from "react";
import { Play, Square, RefreshCw, Download, Plug, AlertTriangle, CheckCircle } from "lucide-react";
import { useRAExtensionBridge, type RAScrapingStatus } from "@/hooks/useRAExtensionBridge";
import { useScrapingSettings } from "@/hooks/useScrapingSettings";
import { Progress } from "@/components/ui/progress";
import { t } from "@/components/download/theme";

interface Props {
  isDark: boolean;
}

export function ProspectImporter({ isDark }: Props) {
  const th = t(isDark);
  const { isAvailable, scrapeByAteco, getScrapingStatus, stopScraping } = useRAExtensionBridge();
  const { settings } = useScrapingSettings();

  const [atecoCode, setAtecoCode] = useState("");
  const [region, setRegion] = useState("");
  const [province, setProvince] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<RAScrapingStatus | null>(null);
  const [logs, setLogs] = useState<Array<{ time: string; msg: string }>>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll status while running
  useEffect(() => {
    if (!isRunning) {
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
        if (!res.active) {
          setIsRunning(false);
        }
      }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning, getScrapingStatus]);

  // Auto-scroll logs
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleStart = async () => {
    if (!atecoCode.trim()) return;
    setIsRunning(true);
    setLogs([]);
    setStatus(null);

    const res = await scrapeByAteco({
      atecoCode: atecoCode.trim(),
      region: region || undefined,
      province: province || undefined,
      delaySeconds: settings.delayDefault,
      batchSize: 5,
    });

    // Final status
    if (res.success) {
      setStatus(prev => prev ? { ...prev, active: false } : null);
    }
    setIsRunning(false);
  };

  const handleStop = async () => {
    await stopScraping();
  };

  const progress = status && status.total > 0 ? Math.round((status.processed / status.total) * 100) : 0;

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

      {/* Config form */}
      <div className={`rounded-xl border p-4 space-y-3 ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/60 border-white/80"}`}>
        <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-800"}`}>Configura Scraping</h3>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Codice ATECO *</label>
            <input
              type="text"
              placeholder="es. 52.29"
              value={atecoCode}
              onChange={(e) => setAtecoCode(e.target.value)}
              disabled={isRunning}
              className={`w-full mt-1 px-3 py-2 rounded-lg text-sm border ${isDark
                ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
              } disabled:opacity-50`}
            />
          </div>
          <div>
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Regione</label>
            <input
              type="text"
              placeholder="es. Lombardia"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={isRunning}
              className={`w-full mt-1 px-3 py-2 rounded-lg text-sm border ${isDark
                ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
              } disabled:opacity-50`}
            />
          </div>
          <div>
            <label className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>Provincia</label>
            <input
              type="text"
              placeholder="es. MI"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              disabled={isRunning}
              className={`w-full mt-1 px-3 py-2 rounded-lg text-sm border ${isDark
                ? "bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                : "bg-white border-slate-200 text-slate-800 placeholder:text-slate-400"
              } disabled:opacity-50`}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {!isRunning ? (
            <button
              onClick={handleStart}
              disabled={!isAvailable || !atecoCode.trim()}
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
            <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-800"}`}>
              {status.active ? "Scraping in corso..." : "Scraping completato"}
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className={isDark ? "text-emerald-400" : "text-emerald-600"}>✅ {status.saved} salvati</span>
              {status.errors > 0 && (
                <span className={isDark ? "text-red-400" : "text-red-600"}>❌ {status.errors} errori</span>
              )}
              <span className={isDark ? "text-slate-400" : "text-slate-500"}>
                {status.processed}/{status.total}
              </span>
            </div>
          </div>

          <Progress value={progress} className="h-2" />

          {status.currentCompany && status.active && (
            <p className={`text-xs truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              ➜ {status.currentCompany}
            </p>
          )}
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

      {/* Empty state instructions */}
      {!status && !isRunning && (
        <div className={`flex-1 flex items-center justify-center`}>
          <div className={`text-center space-y-2 max-w-md ${isDark ? "text-slate-500" : "text-slate-400"}`}>
            <Download className={`w-12 h-12 mx-auto ${isDark ? "text-white/10" : "text-slate-200"}`} />
            <p className="text-sm">Inserisci un codice ATECO per cercare e scaricare i profili aziendali da Report Aziende.</p>
            <p className="text-xs">I dati verranno salvati automaticamente nel database e appariranno nella griglia ATECO.</p>
          </div>
        </div>
      )}
    </div>
  );
}
