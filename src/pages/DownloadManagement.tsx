import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download, Sparkles, Globe, ArrowLeft, Play, Pause, Square,
  Loader2, Timer, Building2, CheckCircle, XCircle, FlaskConical,
  ArrowRight, Zap, ChevronDown, ChevronRight, Sun, Moon
} from "lucide-react";
import { scrapeWcaPartnerById, type ScrapeSingleResult, type ScrapedPartner } from "@/lib/api/wcaScraper";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useNetworkConfigs, type NetworkConfig } from "@/hooks/useNetworkConfigs";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { getCountryFlag } from "@/lib/countries";

// ─── Types ────────────────────────────────────────────────────
type ActionType = "download" | "enrich" | "network";
type Step = "choose" | "configure" | "running";

interface ScrapeLog {
  wcaId: number;
  status: "success" | "not_found" | "error";
  action?: string;
  companyName?: string;
  city?: string;
  countryCode?: string;
  aiSummary?: string;
  partner?: ScrapedPartner;
  error?: string;
}

interface EnrichPartner {
  id: string;
  company_name: string;
  city: string;
  country_code: string;
  website: string | null;
  enriched_at: string | null;
  partner_type: string | null;
  rating: number | null;
}

// ─── Theme Context ────────────────────────────────────────────
const ThemeCtx = createContext(true);
const useTheme = () => useContext(ThemeCtx);

// Theme helpers — returns class strings based on dark/light
function t(dark: boolean) {
  return {
    // Page
    pageBg: dark ? "bg-slate-950" : "bg-slate-50",
    pageGrad1: dark ? "from-slate-950 via-slate-900 to-slate-950" : "from-slate-100 via-white to-slate-100",
    pageGrad2: dark ? "from-amber-900/10" : "from-sky-200/30",
    // Panels
    panel: dark ? "bg-black/40 backdrop-blur-xl" : "bg-white/80 backdrop-blur-lg shadow-lg",
    panelBorderAmber: dark ? "border-amber-500/20" : "border-sky-300/40",
    panelBorderEmerald: dark ? "border-emerald-500/20" : "border-emerald-300/40",
    panelBorderBlue: dark ? "border-blue-500/20" : "border-blue-300/40",
    panelBorderSlate: dark ? "border-slate-700/50" : "border-slate-200",
    // Text
    h1: dark ? "text-slate-100" : "text-slate-800",
    h2: dark ? "text-slate-100" : "text-slate-800",
    sub: dark ? "text-slate-400" : "text-slate-500",
    body: dark ? "text-slate-300" : "text-slate-600",
    label: dark ? "text-slate-400" : "text-slate-500",
    dimText: dark ? "text-slate-500" : "text-slate-400",
    monoText: dark ? "text-slate-100" : "text-slate-800",
    // Inputs
    input: dark ? "bg-slate-800/50 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800",
    selectTrigger: dark ? "bg-slate-800/50 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800",
    selectContent: dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200",
    // Cards
    cardBg: dark ? "bg-slate-800/40 border-slate-700/50" : "bg-white border-slate-200 shadow-sm",
    // Buttons
    backBtn: dark ? "text-slate-400 hover:text-amber-400" : "text-slate-500 hover:text-sky-600",
    btnActive: dark ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-sky-600 hover:bg-sky-700 text-white",
    btnInactive: dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100",
    btnPrimary: dark ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-sky-600 hover:bg-sky-700 text-white",
    btnPause: dark ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "border-sky-400 text-sky-600 hover:bg-sky-50",
    btnResume: dark ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white",
    btnStop: dark ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-400 text-red-600 hover:bg-red-50",
    btnTest: dark ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10" : "border-blue-400 text-blue-600 hover:bg-blue-50",
    btnEnrich: dark ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white",
    // Action cards
    accentAmber: dark ? "text-amber-400" : "text-sky-600",
    accentEmerald: dark ? "text-emerald-400" : "text-emerald-600",
    accentBlue: dark ? "text-blue-400" : "text-blue-600",
    // Log
    logNew: dark ? "text-emerald-400" : "text-emerald-600",
    logUpd: dark ? "text-blue-400" : "text-blue-600",
    logEmpty: dark ? "text-slate-600" : "text-slate-400",
    logError: dark ? "text-red-400" : "text-red-600",
    logId: dark ? "text-slate-600" : "text-slate-400",
    logName: dark ? "text-slate-300" : "text-slate-700",
    // Partner chips
    chipBg: dark ? "bg-black/50 backdrop-blur-sm border-slate-700/50 hover:border-amber-500/40" : "bg-white border-slate-200 hover:border-sky-400 shadow-sm",
    chipName: dark ? "text-slate-200" : "text-slate-800",
    chipCity: dark ? "text-slate-500" : "text-slate-400",
    // Badge variants
    badgeNew: dark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200",
    badgeUpd: dark ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-blue-50 text-blue-700 border-blue-200",
    badgeNetwork: dark ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-sky-50 text-sky-700 border-sky-200",
    // Dialog
    dialogBg: dark ? "bg-slate-900/95 backdrop-blur-xl border-amber-500/20 text-slate-100" : "bg-white border-slate-200 text-slate-800",
    dialogTitle: dark ? "text-slate-100" : "text-slate-800",
    dialogSub: dark ? "text-slate-400" : "text-slate-500",
    dialogField: dark ? "text-slate-500" : "text-slate-400",
    dialogValue: dark ? "text-slate-300" : "text-slate-700",
    dialogAiBox: dark ? "bg-slate-800/50" : "bg-slate-50 border border-slate-200",
    // Misc
    pulse: dark ? "bg-amber-400" : "bg-sky-500",
    countdown: dark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300",
    countdownText: dark ? "text-slate-300" : "text-slate-600",
    countdownIcon: dark ? "text-slate-400" : "text-slate-500",
    statusDotOn: dark ? "bg-emerald-400" : "bg-emerald-500",
    statusDotOff: dark ? "bg-slate-600" : "bg-slate-300",
    statusText: dark ? "text-slate-400" : "text-slate-500",
    highlightId: dark ? "text-amber-400" : "text-sky-600",
    divider: dark ? "divide-slate-800" : "divide-slate-200",
    listHover: dark ? "hover:bg-slate-800/50" : "hover:bg-slate-50",
  };
}

// ─── Delay presets ────────────────────────────────────────────
const DELAY_VALUES = [0, 1, 3, 5, 10, 30];
const DELAY_LABELS: Record<number, string> = { 0: "0s", 1: "1s", 3: "3s", 5: "5s", 10: "10s", 30: "30s" };

// ─── Main Component ──────────────────────────────────────────
export default function DownloadManagement() {
  const [step, setStep] = useState<Step>("choose");
  const [action, setAction] = useState<ActionType | null>(null);
  const [isDark, setIsDark] = useState(() => {
    const stored = localStorage.getItem("dl_theme");
    return stored !== null ? stored === "dark" : true;
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem("dl_theme", next ? "dark" : "light");
      return next;
    });
  };

  const goBack = useCallback(() => {
    if (step === "configure") { setStep("choose"); setAction(null); }
    if (step === "running") { setStep("configure"); }
  }, [step]);

  const selectAction = (a: ActionType) => {
    setAction(a);
    setStep("configure");
  };

  const th = t(isDark);

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className={`h-[calc(100vh-4rem)] relative overflow-hidden -m-6 ${th.pageBg}`}>
        {/* Gradient background */}
        <div className={`absolute inset-0 bg-gradient-to-br ${th.pageGrad1}`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${th.pageGrad2} via-transparent to-transparent`} />

        <div className="relative z-10 h-full flex flex-col p-6">
          {/* Top bar: back + theme toggle */}
          <div className="flex items-center justify-between mb-4">
            <div>
              {step !== "choose" && (
                <button
                  onClick={goBack}
                  className={`flex items-center gap-1.5 text-sm transition-colors ${th.backBtn}`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Indietro
                </button>
              )}
            </div>
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-xl transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}
              title={isDark ? "Modalità chiara" : "Modalità scura"}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {step === "choose" && <StepChoose onSelect={selectAction} />}
          {step === "configure" && action === "download" && <DownloadConfigure onStart={() => setStep("running")} />}
          {step === "configure" && action === "enrich" && <EnrichConfigure onStart={() => setStep("running")} />}
          {step === "configure" && action === "network" && <NetworkConfigure />}
          {step === "running" && action === "download" && <DownloadRunning />}
          {step === "running" && action === "enrich" && <EnrichRunning />}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 - Choose Action
// ═══════════════════════════════════════════════════════════════
function StepChoose({ onSelect }: { onSelect: (a: ActionType) => void }) {
  const isDark = useTheme();
  const th = t(isDark);

  const actions = [
    {
      type: "download" as ActionType,
      icon: Download,
      title: "Scarica Partner",
      desc: "Download sequenziale dalla directory WCA, manuale o automatico",
      color: "amber",
    },
    {
      type: "enrich" as ActionType,
      icon: Sparkles,
      title: "Arricchisci dal Sito",
      desc: "Leggi siti web di partner già scaricati con AI",
      color: "emerald",
    },
    {
      type: "network" as ActionType,
      icon: Globe,
      title: "Analisi Network",
      desc: "Verifica a quali gruppi WCA hai accesso ai dati",
      color: "blue",
    },
  ];

  const colorMap: Record<string, string> = isDark
    ? {
        amber: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5",
        emerald: "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5",
        blue: "border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5",
      }
    : {
        amber: "border-sky-200 hover:border-sky-400 hover:bg-sky-50",
        emerald: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50",
        blue: "border-blue-200 hover:border-blue-400 hover:bg-blue-50",
      };

  const iconColorMap: Record<string, string> = {
    amber: th.accentAmber,
    emerald: th.accentEmerald,
    blue: th.accentBlue,
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className={`text-2xl mb-2 ${th.h1}`}>Cosa vuoi fare?</h1>
        <p className={`text-sm ${th.sub}`}>Scegli un'azione per iniziare</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        {actions.map((a) => (
          <button
            key={a.type}
            onClick={() => onSelect(a.type)}
            className={`group ${th.panel} border rounded-2xl p-8 text-left transition-all duration-300 ${colorMap[a.color]}`}
          >
            <a.icon className={`w-10 h-10 mb-4 ${iconColorMap[a.color]}`} />
            <h3 className={`text-lg mb-2 ${th.h2}`}>{a.title}</h3>
            <p className={`text-sm ${th.sub}`}>{a.desc}</p>
            <ArrowRight className={`w-4 h-4 mt-4 transition-colors ${isDark ? "text-slate-600 group-hover:text-slate-300" : "text-slate-300 group-hover:text-slate-600"}`} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 2A - Download Configure
// ═══════════════════════════════════════════════════════════════
function DownloadConfigure({ onStart }: { onStart: () => void }) {
  const isDark = useTheme();
  const th = t(isDark);

  const [mode, setMode] = useState<"manual" | "auto">("auto");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [delayIndex, setDelayIndex] = useState(3);
  const [pauseEvery, setPauseEvery] = useState("10");
  const [pauseDuration, setPauseDuration] = useState("30");

  const savedLastId = parseInt(localStorage.getItem("wca_scraper_last_id") || "0", 10);

  const handleStart = () => {
    sessionStorage.setItem("dl_config", JSON.stringify({
      mode,
      rangeStart: parseInt(rangeStart, 10) || 1,
      rangeEnd: parseInt(rangeEnd, 10) || 999999,
      delay: DELAY_VALUES[delayIndex] * 1000,
      pauseEvery: parseInt(pauseEvery, 10) || 0,
      pauseDuration: parseInt(pauseDuration, 10) * 1000 || 30000,
      savedLastId,
    }));
    onStart();
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className={`${th.panel} border ${th.panelBorderAmber} rounded-2xl p-8 max-w-lg w-full space-y-6`}>
        <div>
          <h2 className={`text-xl mb-1 ${th.h2}`}>Configura Download</h2>
          <p className={`text-sm ${th.sub}`}>Imposta modalità e velocità di scaricamento</p>
        </div>

        {/* Mode */}
        <div className="flex gap-2">
          <Button
            variant={mode === "manual" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("manual")}
            className={mode === "manual" ? th.btnActive : th.btnInactive}
          >
            Manuale
          </Button>
          <Button
            variant={mode === "auto" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("auto")}
            className={mode === "auto" ? th.btnActive : th.btnInactive}
          >
            Automatico
          </Button>
        </div>

        {mode === "manual" ? (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={`text-xs ${th.label}`}>ID Inizio</label>
              <Input type="number" placeholder="es. 11470" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className={th.input} />
            </div>
            <div className="flex-1">
              <label className={`text-xs ${th.label}`}>ID Fine</label>
              <Input type="number" placeholder="es. 11500" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className={th.input} />
            </div>
          </div>
        ) : (
          <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-slate-800/50 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
            Parte da ID <span className={`font-mono ${th.highlightId}`}>{savedLastId > 0 ? savedLastId + 1 : 1}</span> e procede finché non lo fermi.
            {savedLastId > 0 && (
              <p className={`mt-1 text-xs ${th.dimText}`}>
                Ultimo ID: #{savedLastId}
                <button onClick={() => localStorage.removeItem("wca_scraper_last_id")} className={`ml-2 underline ${th.highlightId}`}>
                  Reset
                </button>
              </p>
            )}
          </div>
        )}

        {/* Delay slider */}
        <div>
          <label className={`text-xs flex items-center gap-1.5 mb-3 ${th.label}`}>
            <Timer className="w-3.5 h-3.5" />
            Attesa tra download: <span className={`font-mono ${th.highlightId}`}>{DELAY_LABELS[DELAY_VALUES[delayIndex]]}</span>
          </label>
          <Slider value={[delayIndex]} onValueChange={([v]) => setDelayIndex(v)} min={0} max={DELAY_VALUES.length - 1} step={1} className="w-full" />
          <div className={`flex justify-between text-xs mt-1 ${th.dimText}`}>
            {DELAY_VALUES.map(v => <span key={v}>{DELAY_LABELS[v]}</span>)}
          </div>
        </div>

        {/* Pause every N */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className={`text-xs ${th.label}`}>Pausa extra ogni</label>
            <Input type="number" value={pauseEvery} onChange={(e) => setPauseEvery(e.target.value)} className={th.input} placeholder="10" />
          </div>
          <div className="flex-1">
            <label className={`text-xs ${th.label}`}>partner, durata (s)</label>
            <Input type="number" value={pauseDuration} onChange={(e) => setPauseDuration(e.target.value)} className={th.input} placeholder="30" />
          </div>
        </div>

        <Button onClick={handleStart} disabled={mode === "manual" && !rangeStart} className={`w-full ${th.btnPrimary}`}>
          <Zap className="w-4 h-4 mr-2" />
          Avvia Download
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 3A - Download Running (LIVE)
// ═══════════════════════════════════════════════════════════════
function DownloadRunning() {
  const isDark = useTheme();
  const th = t(isDark);
  const queryClient = useQueryClient();
  const config = JSON.parse(sessionStorage.getItem("dl_config") || "{}");

  const [isRunning, setIsRunning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [stats, setStats] = useState({ found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 });
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [startTime] = useState(Date.now());
  const [detailPartner, setDetailPartner] = useState<ScrapeLog | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);

  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const elapsed = (Date.now() - startTime) / 1000 / 60;
  const speed = elapsed > 0.01 ? (stats.found / elapsed).toFixed(1) : "—";

  const successLogs = logs.filter(l => l.status === "success");

  const sleep = useCallback((ms: number) =>
    new Promise<void>((resolve) => {
      if (ms <= 0) { resolve(); return; }
      let remaining = Math.ceil(ms / 1000);
      setCountdown(remaining);
      const interval = setInterval(() => {
        remaining--;
        setCountdown(remaining);
        if (remaining <= 0) { clearInterval(interval); resolve(); }
      }, 1000);
    }), []);

  const waitWhilePaused = useCallback(async () => {
    while (pauseRef.current && !abortRef.current) {
      await new Promise(r => setTimeout(r, 300));
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const startId = config.mode === "auto" ? (config.savedLastId > 0 ? config.savedLastId + 1 : 1) : config.rangeStart;
      const endId = config.mode === "auto" ? 999999 : config.rangeEnd;
      const delay = config.delay || 5000;
      const pauseEvery = config.pauseEvery || 0;
      const pauseDur = config.pauseDuration || 30000;

      let localStats = { found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 };
      let processed = 0;
      let consecutiveNotFound = 0;

      for (let id = startId; id <= endId; id++) {
        if (abortRef.current || !mounted) break;
        await waitWhilePaused();
        if (abortRef.current) break;

        setCurrentId(id);

        try {
          const result = await scrapeWcaPartnerById(id);
          const log: ScrapeLog = { wcaId: id, status: "error" };

          if (result.success && result.found) {
            consecutiveNotFound = 0;
            log.status = "success";
            log.action = result.action;
            log.companyName = result.partner?.company_name;
            log.city = result.partner?.city;
            log.countryCode = result.partner?.country_code;
            log.aiSummary = result.aiClassification?.summary;
            log.partner = result.partner;
            localStats.found++;
            if (result.action === "inserted") localStats.inserted++;
            if (result.action === "updated") localStats.updated++;
          } else if (result.success && !result.found) {
            log.status = "not_found";
            localStats.notFound++;
            consecutiveNotFound++;
            if (config.mode === "manual" && consecutiveNotFound > 200) break;
            if (config.mode === "auto" && consecutiveNotFound > 500) break;
          } else {
            log.status = "error";
            log.error = result.error;
            localStats.errors++;
          }

          if (mounted) {
            setLogs(prev => [...prev, log].slice(-500));
            setStats({ ...localStats });
          }

          localStorage.setItem("wca_scraper_last_id", String(id));
        } catch (err) {
          if (mounted) {
            setLogs(prev => [...prev, { wcaId: id, status: "error" as const, error: String(err) }].slice(-500));
            localStats.errors++;
            setStats({ ...localStats });
          }
        }

        processed++;

        if (!abortRef.current && mounted) {
          if (pauseEvery > 0 && processed % pauseEvery === 0) {
            await sleep(pauseDur);
          } else {
            await sleep(delay);
          }
        }
      }

      if (mounted) {
        setIsRunning(false);
        setCurrentId(null);
        setCountdown(0);
        queryClient.invalidateQueries({ queryKey: ["partners"] });
        toast({
          title: abortRef.current ? "Download in pausa" : "Download completato",
          description: `Trovati: ${localStats.found}, Nuovi: ${localStats.inserted}, Aggiornati: ${localStats.updated}`,
        });
      }
    };

    run();
    return () => { mounted = false; abortRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs.length]);

  const handlePause = () => { pauseRef.current = true; setIsPaused(true); };
  const handleResume = () => { pauseRef.current = false; setIsPaused(false); };
  const handleStop = () => { abortRef.current = true; setIsRunning(false); };

  return (
    <div className="flex-1 flex gap-6 min-h-0">
      {/* Center panel */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Current ID indicator */}
        <div className={`${th.panel} border ${th.panelBorderAmber} rounded-2xl p-6`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isRunning && (
                <div className={`w-3 h-3 rounded-full animate-pulse ${th.pulse}`} />
              )}
              <div>
                <p className={`text-xs ${th.sub}`}>
                  {isPaused ? "IN PAUSA" : isRunning ? "SCARICANDO" : "COMPLETATO"}
                </p>
                <p className={`text-2xl font-mono ${th.monoText}`}>
                  {currentId ? `ID #${currentId}` : "—"}
                </p>
              </div>
              {countdown > 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${th.countdown}`}>
                  <Timer className={`w-3.5 h-3.5 ${th.countdownIcon}`} />
                  <span className={`font-mono text-sm ${th.countdownText}`}>{countdown}s</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {isRunning && !isPaused && (
                <Button size="sm" variant="outline" onClick={handlePause} className={th.btnPause}>
                  <Pause className="w-4 h-4 mr-1" /> Pausa
                </Button>
              )}
              {isPaused && (
                <Button size="sm" onClick={handleResume} className={th.btnResume}>
                  <Play className="w-4 h-4 mr-1" /> Riprendi
                </Button>
              )}
              {isRunning && (
                <Button size="sm" variant="outline" onClick={handleStop} className={th.btnStop}>
                  <Square className="w-4 h-4 mr-1" /> Stop
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Stats badges */}
        <div className="flex flex-wrap gap-3">
          <StatBadge label="Trovati" value={stats.found} color="amber" />
          <StatBadge label="Nuovi" value={stats.inserted} color="emerald" />
          <StatBadge label="Aggiornati" value={stats.updated} color="blue" />
          <StatBadge label="Errori" value={stats.errors} color="red" />
          <StatBadge label="Partner/min" value={speed} color="slate" icon={<Zap className="w-3 h-3" />} />
        </div>

        {/* Log feed */}
        <div className={`flex-1 ${th.panel} border ${th.panelBorderSlate} rounded-2xl p-4 min-h-0 overflow-hidden flex flex-col`}>
          <p className={`text-xs mb-2 ${th.dimText}`}>Log attività</p>
          <ScrollArea className="flex-1">
            <div className="space-y-1 text-xs font-mono pr-4">
              {logs.map((log, i) => (
                <div key={`${log.wcaId}-${i}`} className="flex items-center gap-2 py-0.5 animate-fade-in">
                  <span className={`w-16 text-right ${th.logId}`}>#{log.wcaId}</span>
                  {log.status === "success" && log.action === "inserted" && <span className={th.logNew}>● NUOVO</span>}
                  {log.status === "success" && log.action === "updated" && <span className={th.logUpd}>● AGG.</span>}
                  {log.status === "not_found" && <span className={th.logEmpty}>○ vuoto</span>}
                  {log.status === "error" && <span className={th.logError}>✕ errore</span>}
                  {log.companyName && <span className={`truncate ${th.logName}`}>{log.companyName}</span>}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right panel - floating partner list */}
      <div className="w-72 flex flex-col min-h-0">
        <p className={`text-xs mb-2 ${th.dimText}`}>Partner scaricati ({successLogs.length})</p>
        <ScrollArea className="flex-1">
          <div className="space-y-1.5 pr-2">
            {successLogs.map((log, i) => (
              <button
                key={`${log.wcaId}-${i}`}
                onClick={() => setDetailPartner(log)}
                className={`w-full flex items-center gap-2 border rounded-lg px-3 py-2 text-left transition-all animate-fade-in ${th.chipBg}`}
              >
                <span className="text-sm">{log.countryCode ? getCountryFlag(log.countryCode) : "🌍"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${th.chipName}`}>{log.companyName}</p>
                  <p className={`text-xs ${th.chipCity}`}>{log.city}</p>
                </div>
                <Badge className={`text-[10px] px-1.5 py-0 ${log.action === "inserted" ? th.badgeNew : th.badgeUpd}`}>
                  {log.action === "inserted" ? "Nuovo" : "Agg."}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail popup */}
      <Dialog open={!!detailPartner} onOpenChange={() => setDetailPartner(null)}>
        <DialogContent className={`max-w-lg max-h-[80vh] overflow-y-auto ${th.dialogBg}`}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${th.dialogTitle}`}>
              <Building2 className={`w-5 h-5 ${th.accentAmber}`} />
              {detailPartner?.companyName}
            </DialogTitle>
            <DialogDescription className={th.dialogSub}>
              WCA ID #{detailPartner?.wcaId}
            </DialogDescription>
          </DialogHeader>
          {detailPartner?.partner && (
            <div className="space-y-3 text-sm">
              <div className={`grid grid-cols-2 gap-2 ${th.dialogValue}`}>
                <div><span className={th.dialogField}>Paese:</span> {detailPartner.partner.country_name}</div>
                <div><span className={th.dialogField}>Città:</span> {detailPartner.partner.city}</div>
                {detailPartner.partner.email && <div><span className={th.dialogField}>Email:</span> {detailPartner.partner.email}</div>}
                {detailPartner.partner.phone && <div><span className={th.dialogField}>Tel:</span> {detailPartner.partner.phone}</div>}
                {detailPartner.partner.website && (
                  <div className="col-span-2"><span className={th.dialogField}>Sito:</span> {detailPartner.partner.website}</div>
                )}
              </div>
              {detailPartner.partner.networks && detailPartner.partner.networks.length > 0 && (
                <div>
                  <p className={`text-xs mb-1 ${th.dialogField}`}>Network</p>
                  <div className="flex flex-wrap gap-1">
                    {detailPartner.partner.networks.map((n, i) => (
                      <Badge key={i} className={`text-xs ${th.badgeNetwork}`}>{n.name}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {detailPartner.aiSummary && (
                <div>
                  <p className={`text-xs mb-1 ${th.dialogField}`}>Riassunto AI</p>
                  <p className={`rounded-lg p-3 text-sm ${th.dialogAiBox} ${th.body}`}>{detailPartner.aiSummary}</p>
                </div>
              )}
              <div>
                <button onClick={() => setJsonOpen(!jsonOpen)} className={`flex items-center gap-1 text-xs ${th.dimText} hover:opacity-80`}>
                  {jsonOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Dati JSON
                </button>
                {jsonOpen && (
                  <pre className={`rounded-lg p-3 text-xs overflow-x-auto max-h-60 mt-1 ${th.dialogAiBox} ${th.dimText}`}>
                    {JSON.stringify(detailPartner.partner, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 2B - Enrich Configure
// ═══════════════════════════════════════════════════════════════
function EnrichConfigure({ onStart }: { onStart: () => void }) {
  const isDark = useTheme();
  const th = t(isDark);

  const [filterCountry, setFilterCountry] = useState("");
  const [filterType, setFilterType] = useState("");
  const [onlyNotEnriched, setOnlyNotEnriched] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: partners, isLoading } = useQuery({
    queryKey: ["enrichment-partners", filterCountry, filterType, onlyNotEnriched],
    queryFn: async () => {
      let query = supabase
        .from("partners")
        .select("id, company_name, city, country_code, website, enriched_at, partner_type, rating")
        .not("website", "is", null)
        .order("company_name");
      if (filterCountry) query = query.eq("country_code", filterCountry);
      if (filterType) query = query.eq("partner_type", filterType as any);
      if (onlyNotEnriched) query = query.is("enriched_at", null);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as EnrichPartner[];
    },
  });

  const handleStart = () => {
    sessionStorage.setItem("enrich_ids", JSON.stringify(Array.from(selected)));
    onStart();
  };

  return (
    <div className="flex-1 flex items-start justify-center pt-8">
      <div className={`${th.panel} border ${th.panelBorderEmerald} rounded-2xl p-8 max-w-2xl w-full space-y-4`}>
        <div>
          <h2 className={`text-xl mb-1 ${th.h2}`}>Arricchimento dal Sito</h2>
          <p className={`text-sm ${th.sub}`}>Seleziona partner da arricchire con AI</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Select value={filterCountry || "__all__"} onValueChange={v => setFilterCountry(v === "__all__" ? "" : v)}>
            <SelectTrigger className={th.selectTrigger}><SelectValue placeholder="Tutti i paesi" /></SelectTrigger>
            <SelectContent className={th.selectContent}>
              <SelectItem value="__all__">Tutti i paesi</SelectItem>
              {WCA_COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType || "__all__"} onValueChange={v => setFilterType(v === "__all__" ? "" : v)}>
            <SelectTrigger className={th.selectTrigger}><SelectValue placeholder="Tutti i tipi" /></SelectTrigger>
            <SelectContent className={th.selectContent}>
              <SelectItem value="__all__">Tutti i tipi</SelectItem>
              <SelectItem value="freight_forwarder">Freight Forwarder</SelectItem>
              <SelectItem value="customs_broker">Customs Broker</SelectItem>
              <SelectItem value="carrier">Carrier</SelectItem>
              <SelectItem value="nvocc">NVOCC</SelectItem>
              <SelectItem value="3pl">3PL</SelectItem>
              <SelectItem value="courier">Courier</SelectItem>
            </SelectContent>
          </Select>
          <label className={`flex items-center gap-2 text-sm ${th.body}`}>
            <Checkbox checked={onlyNotEnriched} onCheckedChange={(v) => setOnlyNotEnriched(!!v)} />
            Solo non arricchiti
          </label>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className={`w-6 h-6 animate-spin ${th.sub}`} /></div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  if (selected.size === (partners?.length || 0)) setSelected(new Set());
                  else setSelected(new Set(partners?.map(p => p.id)));
                }}
                className={`text-xs ${th.sub} hover:opacity-80`}
              >
                {selected.size === (partners?.length || 0) ? "Deseleziona" : `Seleziona tutti (${partners?.length || 0})`}
              </button>
              <span className={`text-xs ${th.dimText}`}>{selected.size} selezionati</span>
            </div>
            <ScrollArea className={`h-60 border rounded-lg ${th.panelBorderSlate}`}>
              <div className={th.divider}>
                {partners?.map(p => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelected(prev => {
                        const next = new Set(prev);
                        next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                        return next;
                      });
                    }}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${th.listHover}`}
                  >
                    <Checkbox checked={selected.has(p.id)} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${th.chipName}`}>{p.company_name}</p>
                      <p className={`text-xs ${th.chipCity}`}>{p.city}, {p.country_code}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}

        <Button onClick={handleStart} disabled={selected.size === 0} className={`w-full ${th.btnEnrich}`}>
          <Sparkles className="w-4 h-4 mr-2" />
          Avvia Arricchimento ({selected.size})
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 3B - Enrich Running
// ═══════════════════════════════════════════════════════════════
function EnrichRunning() {
  const isDark = useTheme();
  const th = t(isDark);
  const ids: string[] = JSON.parse(sessionStorage.getItem("enrich_ids") || "[]");
  const [current, setCurrent] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [results, setResults] = useState<{id: string; success: boolean}[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      for (let i = 0; i < ids.length; i++) {
        if (!mounted) break;
        setCurrent(i + 1);
        try {
          const { data: partner } = await supabase.from("partners").select("id, website").eq("id", ids[i]).single();
          if (partner?.website) {
            await supabase.functions.invoke("enrich-partner-website", {
              body: { partnerId: partner.id, website: partner.website },
            });
            if (mounted) setResults(prev => [...prev, { id: ids[i], success: true }]);
          }
        } catch {
          if (mounted) setResults(prev => [...prev, { id: ids[i], success: false }]);
        }
        if (i < ids.length - 1) await new Promise(r => setTimeout(r, 3000));
      }
      if (mounted) {
        setIsRunning(false);
        toast({ title: "Arricchimento completato", description: `${results.length} partner processati` });
      }
    };
    run();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const successCount = results.filter(r => r.success).length;
  const errorCount = results.filter(r => !r.success).length;

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className={`${th.panel} border ${th.panelBorderEmerald} rounded-2xl p-8 max-w-md w-full text-center space-y-6`}>
        {isRunning ? (
          <>
            <Loader2 className={`w-10 h-10 animate-spin mx-auto ${th.accentEmerald}`} />
            <p className={`text-lg ${th.h2}`}>Arricchimento in corso...</p>
            <p className={`text-sm ${th.sub}`}>{current} di {ids.length}</p>
          </>
        ) : (
          <>
            <CheckCircle className={`w-10 h-10 mx-auto ${th.accentEmerald}`} />
            <p className={`text-lg ${th.h2}`}>Completato</p>
          </>
        )}
        <div className="flex justify-center gap-4">
          <StatBadge label="Successo" value={successCount} color="emerald" />
          <StatBadge label="Errori" value={errorCount} color="red" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 2C - Network Configure
// ═══════════════════════════════════════════════════════════════
function NetworkConfigure() {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: configs, isLoading, updateConfig } = useNetworkConfigs();
  const [testing, setTesting] = useState<string | null>(null);

  const handleToggle = (config: NetworkConfig) => {
    updateConfig.mutate({ id: config.id, is_member: !config.is_member });
  };

  const handleTest = async (config: NetworkConfig) => {
    setTesting(config.id);
    try {
      const sampleIds = [11470, 11471, 11472];
      let hasEmails = false, hasNames = false, hasPhones = false;
      for (const id of sampleIds) {
        const result = await scrapeWcaPartnerById(id);
        if (result.success && result.found && result.partner) {
          if (result.partner.email) hasEmails = true;
          if (result.partner.contacts?.some(c => c.name && c.name !== c.title)) hasNames = true;
          if (result.partner.contacts?.some(c => c.email)) { hasEmails = true; hasNames = true; }
          if (result.partner.phone) hasPhones = true;
        }
      }
      updateConfig.mutate({
        id: config.id,
        has_contact_emails: hasEmails,
        has_contact_names: hasNames,
        has_contact_phones: hasPhones,
        sample_tested_at: new Date().toISOString(),
      });
      toast({
        title: "Test completato",
        description: `Email: ${hasEmails ? "Sì" : "No"} | Nomi: ${hasNames ? "Sì" : "No"} | Tel: ${hasPhones ? "Sì" : "No"}`,
      });
    } catch (err) {
      toast({ title: "Errore nel test", description: String(err), variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className={`w-8 h-8 animate-spin ${th.sub}`} /></div>;

  return (
    <div className="flex-1 flex items-start justify-center pt-8">
      <div className={`${th.panel} border ${th.panelBorderBlue} rounded-2xl p-8 max-w-2xl w-full space-y-4`}>
        <div>
          <h2 className={`text-xl mb-1 ${th.h2}`}>Analisi Network</h2>
          <p className={`text-sm ${th.sub}`}>Seleziona i gruppi WCA di cui sei membro e testa la visibilità dei dati</p>
        </div>

        <div className="space-y-2">
          {configs?.map(config => (
            <div key={config.id} className={`flex items-center justify-between p-4 rounded-xl border ${th.cardBg}`}>
              <div className="flex items-center gap-3">
                <Checkbox checked={config.is_member} onCheckedChange={() => handleToggle(config)} />
                <div>
                  <p className={`text-sm ${th.chipName}`}>{config.network_name}</p>
                  {config.sample_tested_at && (
                    <p className={`text-xs ${th.dimText}`}>
                      Testato: {new Date(config.sample_tested_at).toLocaleDateString("it-IT")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {config.sample_tested_at && (
                  <div className="flex items-center gap-2 text-xs">
                    <StatusDot ok={config.has_contact_emails} label="Email" />
                    <StatusDot ok={config.has_contact_names} label="Nomi" />
                    <StatusDot ok={config.has_contact_phones} label="Tel" />
                  </div>
                )}
                {config.is_member && (
                  <Button size="sm" variant="outline" onClick={() => handleTest(config)} disabled={testing !== null} className={th.btnTest}>
                    {testing === config.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                    <span className="ml-1">Test</span>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────
function StatBadge({ label, value, color, icon }: { label: string; value: number | string; color: string; icon?: React.ReactNode }) {
  const isDark = useTheme();
  const colorClasses: Record<string, Record<string, string>> = {
    dark: {
      amber: "bg-amber-500/10 border-amber-500/30 text-amber-400",
      emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
      blue: "bg-blue-500/10 border-blue-500/30 text-blue-400",
      red: "bg-red-500/10 border-red-500/30 text-red-400",
      slate: "bg-slate-500/10 border-slate-500/30 text-slate-400",
    },
    light: {
      amber: "bg-sky-50 border-sky-200 text-sky-700",
      emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
      blue: "bg-blue-50 border-blue-200 text-blue-700",
      red: "bg-red-50 border-red-200 text-red-700",
      slate: "bg-slate-100 border-slate-200 text-slate-600",
    },
  };
  const mode = isDark ? "dark" : "light";
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${colorClasses[mode][color] || colorClasses[mode].slate}`}>
      {icon}
      <span className="font-mono text-sm">{value}</span>
      <span className="text-xs opacity-60">{label}</span>
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  const isDark = useTheme();
  const th = t(isDark);
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${ok ? th.statusDotOn : th.statusDotOff}`} />
      <span className={th.statusText}>{label}</span>
    </div>
  );
}
