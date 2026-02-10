import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Download, Sparkles, Globe, ArrowLeft, Play, Pause, Square,
  Loader2, Timer, Building2, CheckCircle, FlaskConical,
  ArrowRight, Zap, ChevronDown, ChevronRight, Sun, Moon,
  Search, Users, MapPin, Settings2, List, FileDown, Activity, RefreshCw,
  Mail, Phone, XCircle, UserCheck, UserX, Wrench, ShieldCheck, ShieldAlert
} from "lucide-react";
import { WcaBrowser } from "@/components/download/WcaBrowser";
import { JobDataViewer } from "@/components/download/JobDataViewer";
import { useContactCompleteness } from "@/hooks/useContactCompleteness";
import { ResyncConfigure } from "@/components/download/ResyncConfigure";
import {
  scrapeWcaPartnerById,
  scrapeWcaDirectory,
  type ScrapedPartner,
  type DirectoryMember,
  type DirectoryResult,
} from "@/lib/api/wcaScraper";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { useNetworkConfigs, type NetworkConfig } from "@/hooks/useNetworkConfigs";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { WCA_NETWORKS } from "@/data/wcaFilters";
import { getCountryFlag } from "@/lib/countries";
import {
  useDownloadJobs, useCreateDownloadJob, usePauseResumeJob,
  useUpdateJobSpeed, type DownloadJob
} from "@/hooks/useDownloadJobs";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";

// ─── Types ────────────────────────────────────────────────────
type ActionType = "download" | "enrich" | "network" | "resync";
type Step = "choose" | "configure" | "running";

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

// ─── Theme ────────────────────────────────────────────────────
const ThemeCtx = createContext(true);
const useTheme = () => useContext(ThemeCtx);

function t(dark: boolean) {
  return {
    pageBg: dark ? "bg-slate-950" : "bg-slate-100",
    pageGrad1: dark ? "from-slate-950 via-slate-900/95 to-slate-950" : "from-slate-100 via-slate-50 to-slate-100",
    pageGrad2: dark ? "from-slate-800/20" : "from-slate-200/30",
    panel: dark ? "bg-white/[0.06] backdrop-blur-xl border-white/[0.1]" : "bg-white/70 backdrop-blur-xl shadow-xl shadow-slate-200/30 border-white/80",
    panelAmber: dark ? "border-amber-500/20" : "border-sky-300/40",
    panelEmerald: dark ? "border-emerald-500/20" : "border-emerald-300/40",
    panelBlue: dark ? "border-blue-500/20" : "border-blue-300/40",
    panelSlate: dark ? "border-slate-700/50" : "border-slate-200",
    h1: dark ? "text-slate-100" : "text-slate-800",
    h2: dark ? "text-slate-100" : "text-slate-800",
    sub: dark ? "text-slate-400" : "text-slate-500",
    body: dark ? "text-slate-300" : "text-slate-600",
    label: dark ? "text-slate-400" : "text-slate-500",
    dim: dark ? "text-slate-500" : "text-slate-400",
    mono: dark ? "text-slate-100" : "text-slate-800",
    input: dark ? "bg-slate-800/50 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800",
    selTrigger: dark ? "bg-slate-800/50 border-slate-700 text-slate-200" : "bg-white border-slate-300 text-slate-800",
    selContent: dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200",
    cardBg: dark ? "bg-slate-800/40 border-slate-700/50" : "bg-white border-slate-200 shadow-sm",
    back: dark ? "text-slate-400 hover:text-amber-400" : "text-slate-500 hover:text-sky-600",
    btnAct: dark ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-sky-600 hover:bg-sky-700 text-white",
    btnOff: dark ? "border-slate-600 text-slate-300 hover:bg-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-100",
    btnPri: dark ? "bg-amber-600 hover:bg-amber-700 text-white" : "bg-sky-600 hover:bg-sky-700 text-white",
    btnPause: dark ? "border-amber-500/30 text-amber-400 hover:bg-amber-500/10" : "border-sky-400 text-sky-600 hover:bg-sky-50",
    btnResume: "bg-emerald-600 hover:bg-emerald-700 text-white",
    btnStop: dark ? "border-red-500/30 text-red-400 hover:bg-red-500/10" : "border-red-400 text-red-600 hover:bg-red-50",
    btnTest: dark ? "border-blue-500/30 text-blue-400 hover:bg-blue-500/10" : "border-blue-400 text-blue-600 hover:bg-blue-50",
    btnEn: "bg-emerald-600 hover:bg-emerald-700 text-white",
    acAmber: dark ? "text-amber-400" : "text-sky-600",
    acEm: dark ? "text-emerald-400" : "text-emerald-600",
    acBl: dark ? "text-blue-400" : "text-blue-600",
    logNew: dark ? "text-emerald-400" : "text-emerald-600",
    logUpd: dark ? "text-blue-400" : "text-blue-600",
    logEmpty: dark ? "text-slate-600" : "text-slate-400",
    logErr: dark ? "text-red-400" : "text-red-600",
    logId: dark ? "text-slate-600" : "text-slate-400",
    logName: dark ? "text-slate-300" : "text-slate-700",
    chipBg: dark ? "bg-black/50 backdrop-blur-sm border-slate-700/50 hover:border-amber-500/40" : "bg-white border-slate-200 hover:border-sky-400 shadow-sm",
    chipName: dark ? "text-slate-200" : "text-slate-800",
    chipSub: dark ? "text-slate-500" : "text-slate-400",
    bdgNew: dark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200",
    bdgUpd: dark ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : "bg-blue-50 text-blue-700 border-blue-200",
    bdgNet: dark ? "bg-amber-500/10 text-amber-300 border-amber-500/30" : "bg-sky-50 text-sky-700 border-sky-200",
    dlgBg: dark ? "bg-slate-900/95 backdrop-blur-xl border-amber-500/20 text-slate-100" : "bg-white border-slate-200 text-slate-800",
    dlgTitle: dark ? "text-slate-100" : "text-slate-800",
    dlgSub: dark ? "text-slate-400" : "text-slate-500",
    dlgField: dark ? "text-slate-500" : "text-slate-400",
    dlgVal: dark ? "text-slate-300" : "text-slate-700",
    dlgBox: dark ? "bg-slate-800/50" : "bg-slate-50 border border-slate-200",
    pulse: dark ? "bg-amber-400" : "bg-sky-500",
    cdBg: dark ? "bg-slate-800 border-slate-700" : "bg-slate-100 border-slate-300",
    cdText: dark ? "text-slate-300" : "text-slate-600",
    cdIcon: dark ? "text-slate-400" : "text-slate-500",
    dotOn: dark ? "bg-emerald-400" : "bg-emerald-500",
    dotOff: dark ? "bg-slate-600" : "bg-slate-300",
    dotLbl: dark ? "text-slate-400" : "text-slate-500",
    hi: dark ? "text-amber-400" : "text-sky-600",
    divider: dark ? "divide-slate-800" : "divide-slate-200",
    hover: dark ? "hover:bg-slate-800/50" : "hover:bg-slate-50",
    stepAct: dark ? "bg-amber-500 text-white" : "bg-sky-500 text-white",
    stepDone: "bg-emerald-500 text-white",
    stepWait: dark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-400",
    stepLine: dark ? "bg-slate-700" : "bg-slate-200",
    stepLineOk: "bg-emerald-500",
    optCard: dark
      ? "bg-white/[0.04] backdrop-blur-md border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.15] hover:shadow-lg hover:shadow-white/[0.03] text-slate-200 transition-all duration-200"
      : "bg-white/60 backdrop-blur-md border-white/80 hover:bg-white/80 hover:border-slate-300/80 hover:shadow-lg hover:shadow-slate-200/50 text-slate-700 transition-all duration-200",
    infoBox: dark ? "bg-white/[0.04] backdrop-blur-sm border-white/[0.08] text-slate-300" : "bg-white/50 backdrop-blur-sm border-slate-200/60 text-slate-600",
  };
}

const DELAY_VALUES = [0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60];
const DELAY_LABELS: Record<number, string> = { 0: "0s", 1: "1s", 2: "2s", 3: "3s", 5: "5s", 8: "8s", 10: "10s", 15: "15s", 20: "20s", 30: "30s", 45: "45s", 60: "60s" };

// Bookmarklet for session capture
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BOOKMARKLET = `javascript:void(fetch('${SUPABASE_URL}/functions/v1/save-wca-cookie',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({cookie:document.cookie})}).then(r=>r.json()).then(d=>alert(d.message||'Done!')).catch(e=>alert('Errore: '+e.message)))`;

// ─── WCA Session Indicator ───────────────────────────────────
function WcaSessionIndicator() {
  const isDark = useTheme();
  const { status, checkedAt, triggerCheck, isLoading } = useWcaSessionStatus();

  const isOk = status === "ok";
  const dotColor = isOk
    ? (isDark ? "bg-emerald-400" : "bg-emerald-500")
    : (isDark ? "bg-red-400" : "bg-red-500");
  const label = isOk ? "WCA Connesso" : status === "expired" ? "Sessione Scaduta" : "Non configurato";

  return (
    <TooltipProvider>
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <button className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs transition-all ${
                isDark
                  ? "bg-white/[0.04] border-white/[0.1] hover:bg-white/[0.08] text-slate-300"
                  : "bg-white/60 border-slate-200 hover:bg-white/80 text-slate-600"
              }`}>
                <div className={`w-2.5 h-2.5 rounded-full ${dotColor} ${!isOk ? "animate-pulse" : ""}`} />
                <span className="hidden sm:inline">{label}</span>
              </button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>
            <p>{label}</p>
            {checkedAt && <p className="text-xs opacity-70">Ultimo check: {new Date(checkedAt).toLocaleString("it-IT")}</p>}
          </TooltipContent>
        </Tooltip>
        <PopoverContent className={`w-80 ${isDark ? "bg-slate-900 border-slate-700 text-slate-200" : ""}`}>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              {isOk ? <ShieldCheck className="w-5 h-5 text-emerald-500" /> : <ShieldAlert className="w-5 h-5 text-red-500" />}
              <span className="font-medium">{label}</span>
            </div>
            {!isOk && (
              <div className="space-y-2">
                <p className={`text-sm ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  Per attivare la sessione, trascina il bottone qui sotto nella barra dei preferiti, poi cliccalo su wcaworld.com:
                </p>
                <a
                  href={BOOKMARKLET}
                  onClick={e => e.preventDefault()}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-grab active:cursor-grabbing ${
                    isDark ? "bg-amber-600 text-white" : "bg-sky-600 text-white"
                  }`}
                >
                  🔗 Cattura WCA
                </a>
              </div>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={triggerCheck}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
              Verifica ora
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </TooltipProvider>
  );
}

// ─── WCA Session Check Dialog ────────────────────────────────
function WcaSessionDialog({ open, onOpenChange, onRetry }: { open: boolean; onOpenChange: (o: boolean) => void; onRetry: () => void }) {
  const isDark = useTheme();
  const th = t(isDark);
  const { status, triggerCheck, isLoading } = useWcaSessionStatus();

  const handleRetry = async () => {
    await triggerCheck();
    // Short delay to let DB update, then re-check
    setTimeout(() => {
      onRetry();
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={th.dlgBg}>
        <DialogHeader>
          <DialogTitle className={th.dlgTitle}>
            <ShieldAlert className="w-5 h-5 inline mr-2 text-red-500" />
            Sessione WCA non attiva
          </DialogTitle>
          <DialogDescription className={th.dlgSub}>
            Per scaricare i dati dei contatti è necessaria una sessione WCA attiva. Segui questi passaggi:
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <ol className={`text-sm space-y-3 ${th.body}`}>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepAct}`}>1</span>
              <span>Trascina questo bottone nella barra dei preferiti:
                <a
                  href={BOOKMARKLET}
                  onClick={e => e.preventDefault()}
                  className={`inline-flex items-center gap-1 ml-2 px-2 py-1 rounded text-xs font-medium cursor-grab active:cursor-grabbing ${
                    isDark ? "bg-amber-600 text-white" : "bg-sky-600 text-white"
                  }`}
                >
                  🔗 Cattura WCA
                </a>
              </span>
            </li>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepWait}`}>2</span>
              <span>Vai su <a href="https://www.wcaworld.com" target="_blank" rel="noopener" className={`underline ${th.hi}`}>wcaworld.com</a> e fai login</span>
            </li>
            <li className="flex gap-3">
              <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${th.stepWait}`}>3</span>
              <span>Clicca il bookmark "Cattura WCA" — vedrai un alert "Done!"</span>
            </li>
          </ol>

          <Button onClick={handleRetry} disabled={isLoading} className={`w-full ${th.btnPri}`}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Riprova verifica
          </Button>

          {status === "ok" && (
            <div className={`p-3 rounded-lg border text-sm text-center ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
              <CheckCircle className="w-4 h-4 inline mr-1" /> Sessione attiva! Puoi procedere.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main ────────────────────────────────────────────────────
export default function DownloadManagement() {
  const [step, setStep] = useState<Step>("choose");
  const [action, setAction] = useState<ActionType | null>(null);
  const [isDark, setIsDark] = useState(() => {
    const s = localStorage.getItem("dl_theme");
    return s !== null ? s === "dark" : true;
  });

  const toggleTheme = () => setIsDark(p => { const n = !p; localStorage.setItem("dl_theme", n ? "dark" : "light"); return n; });

  const goBack = useCallback(() => {
    if (step === "configure") { setStep("choose"); setAction(null); }
    if (step === "running") { setStep("choose"); setAction(null); }
  }, [step]);

  const th = t(isDark);

  return (
    <ThemeCtx.Provider value={isDark}>
      <div className={`h-[calc(100vh-4rem)] relative overflow-hidden -m-6 ${th.pageBg}`}>
        <div className={`absolute inset-0 bg-gradient-to-br ${th.pageGrad1}`} />
        <div className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] ${th.pageGrad2} via-transparent to-transparent`} />
        <div className="relative z-10 h-full flex flex-col">
          {/* Top bar: back + WCA session indicator + theme toggle */}
          <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
            <div>
              {step !== "choose" && (
                <button onClick={goBack} className={`flex items-center gap-1.5 text-sm transition-colors ${th.back}`}>
                  <ArrowLeft className="w-4 h-4" /> Indietro
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <WcaSessionIndicator />
              <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}>
                {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Content area — scrollable */}
          <div className="flex-1 flex flex-col min-h-0 px-6 pb-6 overflow-auto">
            {step === "choose" && <StepChoose onSelect={a => { setAction(a); setStep("configure"); }} onGoToJobs={() => { setAction("download"); setStep("running"); }} />}
            {step === "configure" && action === "download" && <DownloadWizard onStartRunning={() => setStep("running")} />}
            {step === "configure" && action === "enrich" && <EnrichConfigure onStart={() => setStep("running")} />}
            {step === "configure" && action === "network" && <NetworkConfigure />}
            {step === "configure" && action === "resync" && <ResyncConfigure isDark={isDark} onStartRunning={() => setStep("running")} />}
            {step === "running" && action === "download" && <DownloadRunning />}
            {step === "running" && action === "enrich" && <EnrichRunning />}
            {step === "running" && action === "resync" && <DownloadRunning />}
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 - Choose Action (Simplified: 2 primary + collapsible)
// ═══════════════════════════════════════════════════════════════
function StepChoose({ onSelect, onGoToJobs }: { onSelect: (a: ActionType) => void; onGoToJobs: () => void }) {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: jobs } = useDownloadJobs();
  const activeJobs = (jobs || []).filter(j => j.status === "running" || j.status === "pending" || j.status === "paused");
  const [toolsOpen, setToolsOpen] = useState(false);

  const primaryActions = [
    { type: "download" as ActionType, icon: Download, title: "Scarica Partner", desc: "Cerca partner nella directory WCA per paese e network, poi scarica profili e contatti", color: "amber" },
    { type: "resync" as ActionType, icon: RefreshCw, title: "Aggiorna Contatti", desc: "Ri-scarica partner già salvati per recuperare email e telefoni mancanti", color: "purple" },
  ];

  const advancedActions = [
    { type: "enrich" as ActionType, icon: Sparkles, title: "Arricchisci dal Sito", desc: "Analizza i siti web dei partner con AI", color: "emerald" },
    { type: "network" as ActionType, icon: Globe, title: "Analisi Network", desc: "Verifica la visibilità dei dati per ogni gruppo WCA", color: "blue" },
  ];

  const cMap: Record<string, string> = isDark
    ? { amber: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5", emerald: "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5", blue: "border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5", purple: "border-purple-500/30 hover:border-purple-500/60 hover:bg-purple-500/5" }
    : { amber: "border-sky-200 hover:border-sky-400 hover:bg-sky-50", emerald: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50", blue: "border-blue-200 hover:border-blue-400 hover:bg-blue-50", purple: "border-purple-200 hover:border-purple-400 hover:bg-purple-50" };
  const iMap: Record<string, string> = { amber: th.acAmber, emerald: th.acEm, blue: th.acBl, purple: isDark ? "text-purple-400" : "text-purple-600" };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      {/* Active jobs banner */}
      {activeJobs.length > 0 && (
        <button
          onClick={onGoToJobs}
          className={`w-full max-w-3xl ${th.panel} border ${th.panelAmber} rounded-2xl p-4 text-left cursor-pointer transition-all hover:scale-[1.01] ${isDark ? "hover:border-amber-400/60" : "hover:border-sky-400"}`}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${th.pulse}`} />
              <p className={`text-sm font-medium ${th.h2}`}>
                {activeJobs.length} job {activeJobs.length === 1 ? "attivo" : "attivi"} in background
              </p>
            </div>
            <div className={`flex items-center gap-1 text-xs font-medium ${isDark ? "text-amber-400" : "text-sky-600"}`}>
              Visualizza <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-1.5">
            {activeJobs.map(j => (
              <div key={j.id} className={`flex items-center justify-between text-xs ${th.body}`}>
                <span>{getCountryFlag(j.country_code)} {j.country_name} • {j.network_name}</span>
                <span className={`font-mono ${th.hi}`}>{j.current_index}/{j.total_count}</span>
              </div>
            ))}
          </div>
        </button>
      )}

      <div className="text-center">
        <h1 className={`text-2xl mb-2 ${th.h1}`}>Cosa vuoi fare?</h1>
        <p className={`text-sm ${th.sub}`}>Scegli un'azione per iniziare</p>
      </div>

      {/* Primary actions — 2 cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl w-full">
        {primaryActions.map(a => (
          <button key={a.type} onClick={() => onSelect(a.type)} className={`group ${th.panel} border rounded-2xl p-8 text-left transition-all duration-300 ${cMap[a.color]}`}>
            <a.icon className={`w-10 h-10 mb-4 ${iMap[a.color]}`} />
            <h3 className={`text-lg mb-2 ${th.h2}`}>{a.title}</h3>
            <p className={`text-sm ${th.sub}`}>{a.desc}</p>
            <ArrowRight className={`w-4 h-4 mt-4 transition-colors ${isDark ? "text-slate-600 group-hover:text-slate-300" : "text-slate-300 group-hover:text-slate-600"}`} />
          </button>
        ))}
      </div>

      {/* Collapsible advanced tools */}
      <Collapsible open={toolsOpen} onOpenChange={setToolsOpen} className="w-full max-w-2xl">
        <CollapsibleTrigger className={`flex items-center gap-2 text-sm w-full justify-center py-2 transition-colors ${th.sub} hover:opacity-80`}>
          <Wrench className="w-4 h-4" />
          Strumenti avanzati
          {toolsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
            {advancedActions.map(a => (
              <button key={a.type} onClick={() => onSelect(a.type)} className={`group ${th.panel} border rounded-xl p-5 text-left transition-all duration-300 ${cMap[a.color]}`}>
                <div className="flex items-center gap-3 mb-2">
                  <a.icon className={`w-6 h-6 ${iMap[a.color]}`} />
                  <h3 className={`text-sm font-medium ${th.h2}`}>{a.title}</h3>
                </div>
                <p className={`text-xs ${th.sub}`}>{a.desc}</p>
              </button>
            ))}
          </div>
          {/* WCA Browser Panel */}
          <div className="mt-4">
            <WcaBrowser isDark={isDark} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD WIZARD — Country → Network → Avvia Download (3 steps)
// ═══════════════════════════════════════════════════════════════
type DlSub = "country" | "network" | "download";

function DownloadWizard({ onStartRunning }: { onStartRunning: () => void }) {
  const isDark = useTheme();
  const th = t(isDark);
  const [sub, setSub] = useState<DlSub>("country");
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [networks, setNetworks] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  const labels = ["Scegli Paesi", "Scegli Network", "Avvia Download"];
  const keys: DlSub[] = ["country", "network", "download"];
  const idx = keys.indexOf(sub);

  const goSubBack = () => { if (idx > 0) setSub(keys[idx - 1]); };

  const toggleCountry = (code: string, name: string) => {
    setCountries(prev =>
      prev.some(c => c.code === code)
        ? prev.filter(c => c.code !== code)
        : [...prev, { code, name }]
    );
  };

  const removeCountry = (code: string) => {
    setCountries(prev => prev.filter(c => c.code !== code));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Stepper */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        {idx > 0 && (
          <button onClick={goSubBack} className={`flex items-center gap-1 text-xs whitespace-nowrap ${th.back}`}>
            <ArrowLeft className="w-3 h-3" /> Indietro
          </button>
        )}
        <div className="flex items-center gap-1.5 flex-1 justify-center">
          {labels.map((l, i) => (
            <div key={l} className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono ${i < idx ? th.stepDone : i === idx ? th.stepAct : th.stepWait}`}>
                {i < idx ? "✓" : i + 1}
              </div>
              <span className={`text-[11px] hidden sm:inline ${i === idx ? th.h2 : th.dim}`}>{l}</span>
              {i < labels.length - 1 && <div className={`w-6 h-0.5 ${i < idx ? th.stepLineOk : th.stepLine}`} />}
            </div>
          ))}
        </div>
      </div>

      {sub === "country" && (
        <PickCountry
          search={search}
          onSearchChange={setSearch}
          selected={countries}
          onToggle={toggleCountry}
          onRemove={removeCountry}
          onConfirm={() => setSub("network")}
        />
      )}
      {sub === "network" && countries.length > 0 && (
        <PickNetwork countries={countries} onConfirm={n => { setNetworks(n); setSub("download"); }} />
      )}
      {sub === "download" && countries.length > 0 && (
        <UnifiedDownloadStep
          countries={countries}
          networks={networks}
          onStartRunning={onStartRunning}
        />
      )}
    </div>
  );
}

// ─── Pick Country (multi-select) ─────────────────────────────
function PickCountry({ search, onSearchChange, selected, onToggle, onRemove, onConfirm }: {
  search: string;
  onSearchChange: (s: string) => void;
  selected: { code: string; name: string }[];
  onToggle: (code: string, name: string) => void;
  onRemove: (code: string) => void;
  onConfirm: () => void;
}) {
  const isDark = useTheme();
  const th = t(isDark);
  const [filterMode, setFilterMode] = useState<"all" | "missing" | "explored" | "partial">("all");
  const [sortBy, setSortBy] = useState<"name" | "partners" | "completion">("name");

  const { data: partnerData = {} } = useQuery({
    queryKey: ["partner-counts-by-country-with-type"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("country_code, office_type")
        .not("country_code", "is", null);
      const counts: Record<string, { total: number; hq: number; branch: number }> = {};
      (data || []).forEach(r => {
        if (!counts[r.country_code]) counts[r.country_code] = { total: 0, hq: 0, branch: 0 };
        counts[r.country_code].total++;
        if (r.office_type === "branch") counts[r.country_code].branch++;
        else counts[r.country_code].hq++;
      });
      return counts;
    },
    staleTime: 60_000,
  });
  const partnerCounts: Record<string, number> = {};
  Object.entries(partnerData).forEach(([k, v]) => { partnerCounts[k] = v.total; });

  const { data: cacheData = {} } = useQuery({
    queryKey: ["cache-data-by-country"],
    queryFn: async () => {
      const { data } = await supabase
        .from("directory_cache")
        .select("country_code, total_results, download_verified");
      const result: Record<string, { count: number; verified: boolean }> = {};
      (data || []).forEach((r: any) => {
        const prev = result[r.country_code];
        result[r.country_code] = {
          count: (prev?.count || 0) + (r.total_results || 0),
          verified: prev?.verified !== false ? (r.download_verified === true) : false,
        };
      });
      return result;
    },
    staleTime: 60_000,
  });
  const cacheCounts: Record<string, number> = {};
  Object.entries(cacheData).forEach(([k, v]) => { cacheCounts[k] = v.count; });

  const { data: completeness } = useContactCompleteness();

  const exploredSet = new Set(Object.keys(cacheCounts));
  const partialSet = new Set(Object.keys(partnerCounts).filter(k => !cacheCounts[k]));
  const selectedCodes = new Set(selected.map(c => c.code));

  const filtered = WCA_COUNTRIES.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filterMode === "missing") return !exploredSet.has(c.code) && !partialSet.has(c.code);
    if (filterMode === "explored") return exploredSet.has(c.code);
    if (filterMode === "partial") return partialSet.has(c.code);
    return true;
  }).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "partners") return (partnerCounts[b.code] || 0) - (partnerCounts[a.code] || 0);
    const compA = cacheCounts[a.code] ? (partnerCounts[a.code] || 0) / cacheCounts[a.code] : exploredSet.has(a.code) ? 1 : -1;
    const compB = cacheCounts[b.code] ? (partnerCounts[b.code] || 0) / cacheCounts[b.code] : exploredSet.has(b.code) ? 1 : -1;
    return compA - compB;
  });

  const missingCount = WCA_COUNTRIES.filter(c => !exploredSet.has(c.code) && !partialSet.has(c.code)).length;
  const exploredCount = WCA_COUNTRIES.filter(c => exploredSet.has(c.code)).length;
  const partialCount = WCA_COUNTRIES.filter(c => partialSet.has(c.code)).length;

  return (
    <div className="flex-1 flex flex-col items-center gap-4 min-h-0">
      <div className="text-center">
        <h2 className={`text-xl font-semibold mb-1 ${th.h2}`}>Quali paesi vuoi esplorare?</h2>
        <p className={`text-sm ${th.sub}`}>Seleziona uno o più paesi — poi prosegui</p>
      </div>

      {selected.length > 0 && (
        <div className="w-full max-w-4xl">
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-xs ${th.label}`}>Selezionati:</span>
            <Badge variant="secondary" className="text-xs">{selected.length}</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selected.map(c => (
              <Badge
                key={c.code}
                className={`flex items-center gap-1 cursor-pointer ${isDark ? "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30" : "bg-sky-100 text-sky-700 border-sky-200 hover:bg-sky-200"}`}
                onClick={() => onRemove(c.code)}
              >
                {getCountryFlag(c.code)} {c.name} ✕
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Search + Filters + Sort */}
      <div className="w-full max-w-4xl flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
          <Input placeholder="Cerca paese..." value={search} onChange={e => onSearchChange(e.target.value)} className={`pl-10 ${th.input}`} />
        </div>
        {(["all", "explored", "partial", "missing"] as const).map(mode => {
          const filterLabels = { all: `Tutti (${WCA_COUNTRIES.length})`, explored: `Scansionati (${exploredCount})`, partial: `Dati parziali (${partialCount})`, missing: `Mai esplorati (${missingCount})` };
          const active = filterMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                active
                  ? isDark ? "bg-white/[0.1] border-white/[0.2] text-white shadow-sm" : "bg-white/90 border-slate-300 text-slate-800 shadow-sm"
                  : isDark ? "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06] hover:text-slate-200" : "bg-white/40 border-slate-200/60 text-slate-500 hover:bg-white/70 hover:text-slate-700"
              }`}
            >
              {mode === "all" && <Globe className="w-3.5 h-3.5" />}
              {mode === "explored" && <CheckCircle className="w-3.5 h-3.5" />}
              {mode === "partial" && <Activity className="w-3.5 h-3.5" />}
              {mode === "missing" && <Download className="w-3.5 h-3.5" />}
              {filterLabels[mode]}
            </button>
          );
        })}
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className={`w-[160px] h-9 text-xs ${th.selTrigger}`}>
            <SelectValue placeholder="Ordina per..." />
          </SelectTrigger>
          <SelectContent className={th.selContent}>
            <SelectItem value="name">Nome A-Z</SelectItem>
            <SelectItem value="partners">N° partner ↓</SelectItem>
            <SelectItem value="completion">Completamento</SelectItem>
          </SelectContent>
        </Select>
        {(() => {
          const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedCodes.has(c.code));
          return (
            <button
              onClick={() => {
                filtered.forEach(c => {
                  if (allFilteredSelected) {
                    if (selectedCodes.has(c.code)) onToggle(c.code, c.name);
                  } else {
                    if (!selectedCodes.has(c.code)) onToggle(c.code, c.name);
                  }
                });
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                isDark ? "bg-white/[0.1] border-white/[0.2] text-white hover:bg-white/[0.15]" : "bg-white/90 border-slate-300 text-slate-800 hover:bg-white shadow-sm"
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {allFilteredSelected ? "Deseleziona tutti" : `Seleziona tutti (${filtered.length})`}
            </button>
          );
        })()}
      </div>

      <ScrollArea className="flex-1 w-full max-w-4xl">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 pr-4">
          {filtered.map(c => {
            const isSelected = selectedCodes.has(c.code);
            const pCount = partnerCounts[c.code] || 0;
            const cCount = cacheCounts[c.code] || 0;
            const hasDirectoryScan = cCount > 0;
            const hasDbOnly = pCount > 0 && cCount === 0;
            const isVerified = cacheData[c.code]?.verified === true;
            const isComplete = isVerified;
            const cs = completeness?.byCountry[c.code];
            const contactsTotal = cs?.total_partners || 0;
            const withEmail = cs?.with_personal_email || 0;
            const withPhone = cs?.with_personal_phone || 0;
            const pctEmail = contactsTotal > 0 ? Math.round((withEmail / contactsTotal) * 100) : 0;
            const dlPct = cCount > 0 ? Math.round((pCount / cCount) * 100) : 0;

            return (
              <button
                key={c.code}
                onClick={() => onToggle(c.code, c.name)}
                className={`relative rounded-xl border p-3 text-left transition-all duration-200 ${
                  isSelected
                    ? isDark
                      ? "bg-white/[0.1] border-white/[0.25] ring-1 ring-white/20 shadow-lg shadow-white/[0.05]"
                      : "bg-sky-50/80 border-sky-300/80 ring-1 ring-sky-300/50 shadow-lg shadow-sky-100/50"
                    : th.optCard
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl leading-none">{getCountryFlag(c.code)}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${th.h2}`}>{c.name}</p>
                  </div>
                  {isSelected && <CheckCircle className={`w-4 h-4 flex-shrink-0 ${isDark ? "text-white/70" : "text-sky-500"}`} />}
                </div>

                {(hasDirectoryScan || hasDbOnly) && (
                  <div className="flex items-center gap-1.5 mb-2">
                    {isComplete && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium flex items-center gap-0.5 ${isDark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>
                        <CheckCircle className="w-3 h-3" /> Completo
                      </span>
                    )}
                    {!isComplete && hasDirectoryScan && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-medium ${isDark ? "bg-white/[0.06] text-slate-300" : "bg-slate-100/80 text-slate-600"}`}>
                        {pCount}/{cCount} scaricati ({dlPct}%)
                      </span>
                    )}
                    {hasDbOnly && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${isDark ? "bg-amber-500/10 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                        {pCount} partner (parziale)
                      </span>
                    )}
                  </div>
                )}

                {pCount > 0 && (
                  <div className={`rounded-lg p-2 space-y-1.5 ${isDark ? "bg-white/[0.03]" : "bg-slate-50/60"}`}>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`flex items-center gap-1 ${th.dim}`}><Users className="w-3 h-3" /> Responsabili</span>
                      <span className={`font-mono font-bold ${cs && (withEmail > 0 || withPhone > 0) ? (isDark ? "text-slate-200" : "text-slate-700") : (isDark ? "text-red-400" : "text-red-500")}`}>
                        {cs ? `${withEmail > 0 || withPhone > 0 ? Math.max(withEmail, withPhone) : 0}` : "0"}/{pCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`flex items-center gap-1 ${th.dim}`}><Mail className="w-3 h-3" /> Email personale</span>
                      <span className={`font-mono font-bold ${withEmail > 0 ? (isDark ? "text-emerald-400" : "text-emerald-600") : (isDark ? "text-red-400" : "text-red-500")}`}>{withEmail}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`flex items-center gap-1 ${th.dim}`}><Phone className="w-3 h-3" /> Telefono diretto</span>
                      <span className={`font-mono font-bold ${withPhone > 0 ? (isDark ? "text-emerald-400" : "text-emerald-600") : (isDark ? "text-red-400" : "text-red-500")}`}>{withPhone}</span>
                    </div>
                    <div className={`w-full h-1 rounded-full overflow-hidden mt-1 ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
                      <div className={`h-full rounded-full transition-all ${pctEmail >= 60 ? "bg-emerald-500" : pctEmail >= 30 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${pctEmail}%` }} />
                    </div>
                    <p className={`text-[9px] text-right font-mono ${pctEmail >= 60 ? "text-emerald-500" : pctEmail >= 30 ? "text-amber-500" : "text-red-500"}`}>
                      {pctEmail}% copertura
                    </p>
                  </div>
                )}

                {pCount === 0 && !hasDirectoryScan && (
                  <p className={`text-[10px] ${th.dim}`}>{c.code} — mai esplorato</p>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {selected.length > 0 && (
        <div className="w-full max-w-4xl">
          <Button onClick={onConfirm} className={`w-full ${th.btnPri}`}>
            <ArrowRight className="w-4 h-4 mr-2" />
            Prosegui con {selected.length} {selected.length === 1 ? "paese" : "paesi"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Pick Network (multi-select) ─────────────────────────────
function PickNetwork({ countries, onConfirm }: {
  countries: { code: string; name: string }[];
  onConfirm: (networks: string[]) => void;
}) {
  const isDark = useTheme();
  const th = t(isDark);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allSelected, setAllSelected] = useState(false);

  const countryLabel = countries.length === 1
    ? `${getCountryFlag(countries[0].code)} ${countries[0].name}`
    : `${countries.length} paesi`;

  const toggleNetwork = (n: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
    setAllSelected(false);
  };

  const toggleAll = () => {
    if (allSelected) {
      setAllSelected(false);
      setSelected(new Set());
    } else {
      setAllSelected(true);
      setSelected(new Set());
    }
  };

  const handleConfirm = () => {
    if (allSelected || selected.size === 0) {
      onConfirm([]);
    } else {
      onConfirm(Array.from(selected));
    }
  };

  const canProceed = allSelected || selected.size > 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h2 className={`text-xl mb-1 ${th.h2}`}>Quale network?</h2>
        <p className={`text-sm ${th.sub}`}>{countryLabel} — Seleziona uno o più gruppi WCA</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full">
        <button
          onClick={toggleAll}
          className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${allSelected ? (isDark ? "border-amber-500/60 bg-amber-500/10" : "border-sky-400 bg-sky-50") : th.optCard}`}
        >
          <Checkbox checked={allSelected} className="pointer-events-none" />
          <Globe className={`w-5 h-5 ${th.acAmber}`} />
          <div className="text-left">
            <p className="text-sm font-medium">Tutti i Network</p>
            <p className={`text-xs ${th.dim}`}>Cerca tutti i partner WCA</p>
          </div>
        </button>
        {WCA_NETWORKS.map(n => {
          const isChecked = !allSelected && selected.has(n);
          return (
            <button
              key={n}
              onClick={() => toggleNetwork(n)}
              className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${isChecked ? (isDark ? "border-amber-500/60 bg-amber-500/10" : "border-sky-400 bg-sky-50") : th.optCard} ${allSelected ? "opacity-50" : ""}`}
              disabled={allSelected}
            >
              <Checkbox checked={isChecked} className="pointer-events-none" />
              <Users className={`w-5 h-5 flex-shrink-0 ${th.acAmber}`} />
              <span className="text-sm text-left">{n}</span>
            </button>
          );
        })}
      </div>
      {canProceed && (
        <Button onClick={handleConfirm} className={th.btnPri}>
          <ArrowRight className="w-4 h-4 mr-2" />
          Prosegui con {allSelected ? "tutti i network" : `${selected.size} network`}
        </Button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UNIFIED DOWNLOAD STEP — Auto-scan + download in one step
// ═══════════════════════════════════════════════════════════════
function UnifiedDownloadStep({ countries, networks, onStartRunning }: {
  countries: { code: string; name: string }[];
  networks: string[];
  onStartRunning: () => void;
}) {
  const isDark = useTheme();
  const th = t(isDark);
  const countryCodes = countries.map(c => c.code);
  const networkKeys = networks.length > 0 ? networks : [""];
  const queryClient = useQueryClient();
  const createJob = useCreateDownloadJob();
  const { status: wcaStatus, triggerCheck } = useWcaSessionStatus();
  const [showSessionDialog, setShowSessionDialog] = useState(false);

  // Load cached directory scan
  const { data: cachedEntries = [], isLoading: loadingCache } = useQuery({
    queryKey: ["directory-cache", countryCodes, networkKeys],
    queryFn: async () => {
      let q = supabase
        .from("directory_cache")
        .select("*")
        .in("country_code", countryCodes);
      if (networks.length > 0) {
        q = q.in("network_name", networks);
      } else {
        q = q.eq("network_name", "");
      }
      const { data } = await q;
      return data || [];
    },
    staleTime: 30_000,
  });

  // Load partners already in DB
  const { data: dbPartners = [], isLoading: loadingDb } = useQuery({
    queryKey: ["db-partners-for-countries", countryCodes],
    queryFn: async () => {
      const allWcaIds = cachedEntries.flatMap((e: any) =>
        ((e.members as any[]) || []).map((m: any) => m.wca_id || m.id).filter(Boolean)
      );
      let allPartners: any[] = [];
      const { data: byCountry } = await supabase
        .from("partners")
        .select("wca_id, company_name, city, country_code, country_name, updated_at, rating, partner_type")
        .in("country_code", countryCodes)
        .not("wca_id", "is", null)
        .order("company_name");
      allPartners = byCountry || [];
      if (allWcaIds.length > 0) {
        const foundWcaIds = new Set(allPartners.map(p => p.wca_id));
        const missingWcaIds = allWcaIds.filter((id: number) => !foundWcaIds.has(id));
        if (missingWcaIds.length > 0) {
          const { data: byWcaId } = await supabase
            .from("partners")
            .select("wca_id, company_name, city, country_code, country_name, updated_at, rating, partner_type")
            .in("wca_id", missingWcaIds);
          if (byWcaId) allPartners = [...allPartners, ...byWcaId];
        }
      }
      return (allPartners || []).map(p => ({
        wca_id: p.wca_id!,
        company_name: p.company_name,
        city: p.city,
        country_code: p.country_code,
        country_name: p.country_name,
        updated_at: p.updated_at,
      }));
    },
    staleTime: 30_000,
  });

  // Build cached members
  const cachedMembers: DirectoryMember[] = cachedEntries.flatMap((entry: any) => {
    const members = entry.members as any[];
    return (members || []).map((m: any) => ({
      company_name: m.company_name,
      city: m.city,
      country: m.country,
      country_code: m.country_code || entry.country_code,
      wca_id: m.wca_id,
    }));
  });

  const cachedAt = cachedEntries.length > 0
    ? cachedEntries.reduce((latest: string, e: any) => e.scanned_at > latest ? e.scanned_at : latest, cachedEntries[0].scanned_at)
    : null;

  const hasCache = cachedMembers.length > 0;
  const dbWcaSet = new Set(dbPartners.map(p => p.wca_id));

  // Scanning state (auto-scan if no cache)
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [scannedMembers, setScannedMembers] = useState<DirectoryMember[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentCountryIdx, setCurrentCountryIdx] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [skippedCountries, setSkippedCountries] = useState<string[]>([]);
  const abortRef = useRef(false);
  const listingDelayRef = useRef(0);

  // Auto-start scan if no cache
  useEffect(() => {
    if (!loadingCache && !loadingDb && !hasCache && !isScanning && !scanComplete) {
      handleStartScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCache, loadingDb, hasCache]);

  const saveScanToCache = useCallback(async (countryCode: string, netKey: string, scanned: DirectoryMember[], total: number, pages: number) => {
    const membersJson = scanned.map(m => ({
      company_name: m.company_name,
      city: m.city,
      country: m.country,
      country_code: m.country_code,
      wca_id: m.wca_id,
    }));
    await supabase
      .from("directory_cache")
      .upsert({
        country_code: countryCode,
        network_name: netKey,
        members: membersJson as any,
        total_results: total,
        total_pages: pages,
        scanned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "country_code,network_name" });
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
  }, [queryClient]);

  const handleStartScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    setSkippedCountries([]);
    abortRef.current = false;
    const allMembers: DirectoryMember[] = [];
    const skipped: string[] = [];

    for (let ci = 0; ci < countries.length; ci++) {
      if (abortRef.current) break;
      setCurrentCountryIdx(ci);
      const country = countries[ci];

      for (const netKey of networkKeys) {
        if (abortRef.current) break;
        let page = 1;
        let hasNext = true;
        let countryTotal = 0;
        let countryPages = 0;
        const countryMembers: DirectoryMember[] = [];
        let countryFailed = false;

        while (hasNext && !abortRef.current) {
          setCurrentPage(page);
          const maxRetries = 3;
          let result: DirectoryResult | null = null;
          let lastError = "";

          for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
              result = await scrapeWcaDirectory(country.code, netKey, page);
              if (result.success) break;
              lastError = result.error || "Errore sconosciuto";
              result = null;
            } catch (err) {
              lastError = err instanceof Error ? err.message : "Errore di rete";
              result = null;
            }
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, 2000 * Math.pow(2, attempt - 1)));
            }
          }

          if (!result || !result.success) {
            setScanError(`${country.name}: ${lastError}`);
            countryFailed = true;
            break;
          }

          if (result.members.length > 0) {
            const newMembers = result.members.map(m => ({
              ...m,
              country: m.country || country.name,
              country_code: country.code,
            }));
            countryMembers.push(...newMembers);
            allMembers.push(...newMembers);
            setScannedMembers([...allMembers]);
          }

          countryTotal = result.pagination.total_results;
          countryPages = result.pagination.total_pages;
          hasNext = result.pagination.has_next_page || result.members.length >= 50;
          page++;

          if (hasNext && !abortRef.current) {
            await new Promise(r => setTimeout(r, listingDelayRef.current));
          }
        }

        if (countryFailed) {
          const label = `${country.name} (${country.code})`;
          if (!skipped.includes(label)) {
            skipped.push(label);
            setSkippedCountries([...skipped]);
          }
        }

        if (countryMembers.length > 0) {
          await saveScanToCache(country.code, netKey, countryMembers, countryTotal, countryPages);
        }
      }
    }

    setIsScanning(false);
    setScanComplete(true);
    // Refetch cache after scan
    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
    queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
  }, [countries, networkKeys, saveScanToCache, queryClient]);

  // Determine which members to show
  const sourceMembers = scanComplete ? scannedMembers : cachedMembers;
  const allIds = sourceMembers.filter(m => m.wca_id).map(m => m.wca_id!);
  const uniqueIds = [...new Set(allIds)];
  const missingIds = uniqueIds.filter(id => !dbWcaSet.has(id));
  const downloadedCount = uniqueIds.filter(id => dbWcaSet.has(id)).length;
  const totalCount = uniqueIds.length;

  // Oldest update
  const oldestUpdate = dbPartners.length > 0
    ? dbPartners.reduce((min, p) => (!min || (p.updated_at && p.updated_at < min) ? p.updated_at : min), dbPartners[0].updated_at)
    : null;

  // Speed
  const [delayIndex, setDelayIndex] = useState(4);
  const delay = DELAY_VALUES[delayIndex];
  const [includeExisting, setIncludeExisting] = useState(false);
  const idsToDownload = includeExisting ? uniqueIds : missingIds;

  // Time estimate
  const avgScrapeTime = 15;
  const totalTime = idsToDownload.length * (delay + avgScrapeTime);
  const estimateLabel = totalTime >= 3600
    ? `~${(totalTime / 3600).toFixed(1)} ore`
    : totalTime >= 60
      ? `~${Math.ceil(totalTime / 60)} minuti`
      : `~${totalTime}s`;

  const countryLabel = countries.length === 1
    ? `${getCountryFlag(countries[0].code)} ${countries[0].name}`
    : `${countries.length} paesi`;

  const isLoading = loadingCache || loadingDb;

  // Start download with session check
  const handleStartDownload = async () => {
    // First verify WCA session
    await triggerCheck();
    // Wait a moment for status to update
    await new Promise(r => setTimeout(r, 1500));

    // Re-check status from DB
    const { data: statusData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "wca_session_status")
      .maybeSingle();

    const currentStatus = statusData?.value || "no_cookie";
    if (currentStatus !== "ok") {
      setShowSessionDialog(true);
      return;
    }

    // Proceed with download
    await executeDownload();
  };

  const executeDownload = async () => {
    if (idsToDownload.length === 0) {
      toast({ title: "Nessun partner da scaricare", description: "Tutti i partner sono già nel database." });
      return;
    }

    const idsByCountry = new Map<string, number[]>();
    for (const m of sourceMembers) {
      if (!m.wca_id) continue;
      if (!idsToDownload.includes(m.wca_id)) continue;
      const cc = m.country_code || countries.find(c => c.name === m.country || c.code === m.country)?.code;
      if (!cc) continue;
      if (!idsByCountry.has(cc)) idsByCountry.set(cc, []);
      idsByCountry.get(cc)!.push(m.wca_id);
    }

    for (const country of countries) {
      const countryIds = idsByCountry.get(country.code) || [];
      if (countryIds.length === 0) continue;
      await createJob.mutateAsync({
        country_code: country.code,
        country_name: country.name,
        network_name: networks.length > 0 ? networks.join(", ") : "Tutti",
        wca_ids: countryIds,
        delay_seconds: delay,
      });
    }
    onStartRunning();
  };

  const handleSessionRetry = async () => {
    const { data: statusData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "wca_session_status")
      .maybeSingle();

    if (statusData?.value === "ok") {
      setShowSessionDialog(false);
      toast({ title: "Sessione attiva!", description: "Puoi procedere con il download." });
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className={`w-6 h-6 animate-spin ${th.sub}`} />
        <span className={`ml-2 text-sm ${th.sub}`}>Caricamento dati...</span>
      </div>
    );
  }

  // Scanning in progress
  if (isScanning) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-8 max-w-lg w-full space-y-6 text-center`}>
          <Loader2 className={`w-10 h-10 animate-spin mx-auto ${th.acAmber}`} />
          <div>
            <h2 className={`text-xl mb-2 ${th.h2}`}>Scansione directory in corso...</h2>
            <p className={`text-sm ${th.sub}`}>
              {countries.length > 1 && `Paese ${currentCountryIdx + 1}/${countries.length}: `}
              {countries[currentCountryIdx]?.name} — Pagina {currentPage}
            </p>
            {scannedMembers.length > 0 && (
              <p className={`text-lg font-mono mt-2 ${th.hi}`}>{scannedMembers.length} partner trovati</p>
            )}
          </div>
          {scanError && (
            <div className={`p-3 rounded-lg border text-sm text-left ${isDark ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
              ⚠️ {scanError}
            </div>
          )}
          <Button variant="outline" onClick={() => { abortRef.current = true; setIsScanning(false); setScanComplete(true); }} className={th.btnStop}>
            <Square className="w-4 h-4 mr-1" /> Interrompi
          </Button>
        </div>
      </div>
    );
  }

  // Ready to download (cache exists or scan complete)
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-8 max-w-lg w-full space-y-6`}>
        <div>
          <h2 className={`text-xl mb-1 ${th.h2}`}>Avvia Download</h2>
          <p className={`text-sm ${th.sub}`}>
            {countryLabel} • {networks.length > 0 ? networks.join(", ") : "Tutti i network"}
          </p>
        </div>

        {/* Summary */}
        <div className={`p-4 rounded-xl border space-y-2 ${th.infoBox}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${th.body}`}>Partner nella directory</span>
            <span className={`font-mono font-bold ${th.hi}`}>{totalCount}</span>
          </div>
          <div className={`h-px ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${th.acEm}`}>✓ Già nel database</span>
            <span className={`font-mono font-bold ${th.acEm}`}>{downloadedCount}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${th.hi}`}>↓ Da scaricare</span>
            <span className={`font-mono font-bold ${th.hi}`}>{missingIds.length}</span>
          </div>
          {oldestUpdate && (
            <p className={`text-xs ${th.dim}`}>
              Ultimo aggiornamento più vecchio: {new Date(oldestUpdate).toLocaleDateString("it-IT")}
            </p>
          )}
          {cachedAt && (
            <p className={`text-xs ${th.dim}`}>
              Scansione directory: {new Date(cachedAt).toLocaleString("it-IT")}
            </p>
          )}
        </div>

        {/* Option to include existing */}
        {downloadedCount > 0 && (
          <label className={`flex items-center gap-2 text-sm cursor-pointer ${th.body}`}>
            <Checkbox checked={includeExisting} onCheckedChange={v => setIncludeExisting(!!v)} />
            Ri-scarica anche i {downloadedCount} già presenti (aggiorna dati)
          </label>
        )}

        {/* All downloaded message */}
        {missingIds.length === 0 && !includeExisting && (
          <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            ✅ Tutti i partner sono già nel database! Spunta la casella sopra per aggiornare i profili.
          </div>
        )}

        {/* Background info */}
        {idsToDownload.length > 0 && (
          <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
            🚀 Il download proseguirà in background anche se navighi altrove.
          </div>
        )}

        {/* Speed */}
        {idsToDownload.length > 0 && (
          <div>
            <label className={`text-xs flex items-center gap-1.5 mb-3 ${th.label}`}>
              <Timer className="w-3.5 h-3.5" />
              Velocità: <span className={`font-mono font-bold ${th.hi}`}>{DELAY_LABELS[delay]}</span>
            </label>
            <Slider value={[delayIndex]} onValueChange={([v]) => setDelayIndex(v)} min={0} max={DELAY_VALUES.length - 1} step={1} className="w-full" />
            <div className={`flex justify-between text-xs mt-1 ${th.dim}`}>
              <span>Veloce</span>
              <span>Lento (sicuro)</span>
            </div>
          </div>
        )}

        {/* Time estimate */}
        {idsToDownload.length > 0 && (
          <div className={`p-3 rounded-lg border text-center ${th.infoBox}`}>
            <p className={`text-xs ${th.dim}`}>Tempo stimato</p>
            <p className={`text-lg font-mono ${th.hi}`}>{estimateLabel}</p>
          </div>
        )}

        {/* Main action button */}
        <Button
          onClick={handleStartDownload}
          disabled={idsToDownload.length === 0 || createJob.isPending}
          className={`w-full ${th.btnPri}`}
        >
          {createJob.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
          {idsToDownload.length > 0
            ? `Avvia Download (${idsToDownload.length} partner)`
            : "Tutti già scaricati ✓"
          }
        </Button>

        {/* Secondary: rescan */}
        {hasCache && (
          <Collapsible>
            <CollapsibleTrigger className={`flex items-center gap-1.5 text-xs w-full justify-center ${th.sub} hover:opacity-80`}>
              <Settings2 className="w-3.5 h-3.5" /> Opzioni avanzate <ChevronDown className="w-3 h-3" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3 space-y-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setScanComplete(false);
                  setScannedMembers([]);
                  handleStartScan();
                }}
                className={`w-full text-xs ${th.btnPause}`}
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" /> Aggiorna lista dalla directory
              </Button>
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Skipped countries warning */}
        {skippedCountries.length > 0 && (
          <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" : "bg-yellow-50 border-yellow-200 text-yellow-700"}`}>
            ⚠️ {skippedCountries.length} paes{skippedCountries.length === 1 ? 'e saltato' : 'i saltati'}: {skippedCountries.join(', ')}
          </div>
        )}
      </div>

      {/* Session check dialog */}
      <WcaSessionDialog
        open={showSessionDialog}
        onOpenChange={setShowSessionDialog}
        onRetry={handleSessionRetry}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD RUNNING — Server-side job monitor (realtime)
// ═══════════════════════════════════════════════════════════════
function DownloadRunning() {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: jobs } = useDownloadJobs();
  const pauseResume = usePauseResumeJob();
  const updateSpeed = useUpdateJobSpeed();

  const activeJobs = (jobs || []).filter(j => j.status === "running" || j.status === "pending" || j.status === "paused");
  const recentCompleted = (jobs || []).filter(j => j.status === "completed" || j.status === "cancelled").slice(0, 5);

  if (activeJobs.length === 0 && recentCompleted.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className={`${th.panel} border ${th.panelSlate} rounded-2xl p-8 text-center space-y-4`}>
          <CheckCircle className={`w-10 h-10 mx-auto ${th.acEm}`} />
          <p className={`text-lg ${th.h2}`}>Nessun job attivo</p>
          <p className={`text-sm ${th.sub}`}>Torna indietro per avviare un nuovo download</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-auto">
      {activeJobs.length > 0 && (
        <p className={`text-sm font-medium ${th.h2}`}>
          <Activity className="w-4 h-4 inline mr-1" />
          Job Attivi ({activeJobs.length})
        </p>
      )}
      {activeJobs.map(job => (
        <JobCard key={job.id} job={job} pauseResume={pauseResume} updateSpeed={updateSpeed} />
      ))}
      {recentCompleted.length > 0 && (
        <>
          <p className={`text-sm font-medium mt-4 ${th.dim}`}>Completati di recente</p>
          {recentCompleted.map(job => (
            <JobCard key={job.id} job={job} pauseResume={pauseResume} updateSpeed={updateSpeed} />
          ))}
        </>
      )}
    </div>
  );
}

function JobCard({ job, pauseResume, updateSpeed }: {
  job: DownloadJob;
  pauseResume: ReturnType<typeof usePauseResumeJob>;
  updateSpeed: ReturnType<typeof useUpdateJobSpeed>;
}) {
  const isDark = useTheme();
  const th = t(isDark);
  const [showSpeed, setShowSpeed] = useState(false);
  const [showViewer, setShowViewer] = useState(false);

  const prevIndexRef = useRef(job.current_index);
  const recentTimesRef = useRef<number[]>([]);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    const now = Date.now();
    const diff = job.current_index - prevIndexRef.current;
    if (diff > 0 && prevIndexRef.current > 0) {
      const elapsed = now - lastUpdateRef.current;
      const perProfile = elapsed / diff;
      recentTimesRef.current.push(perProfile);
      if (recentTimesRef.current.length > 10) recentTimesRef.current.shift();
    }
    prevIndexRef.current = job.current_index;
    lastUpdateRef.current = now;
  }, [job.current_index]);

  const recentAvgMs = recentTimesRef.current.length > 0
    ? recentTimesRef.current.reduce((a, b) => a + b, 0) / recentTimesRef.current.length
    : null;

  const progress = job.total_count > 0 ? (job.current_index / job.total_count) * 100 : 0;
  const isActive = job.status === "running" || job.status === "pending";
  const isPaused = job.status === "paused";

  const statusLabel: Record<string, string> = {
    pending: "In attesa", running: "In corso", paused: "In pausa",
    completed: "Completato", cancelled: "Cancellato", error: "Errore",
  };

  const statusColor = isDark
    ? { running: "text-amber-400", paused: "text-yellow-400", completed: "text-emerald-400", cancelled: "text-slate-500", error: "text-red-400", pending: "text-blue-400" }
    : { running: "text-sky-600", paused: "text-yellow-600", completed: "text-emerald-600", cancelled: "text-slate-400", error: "text-red-600", pending: "text-blue-600" };

  const handleSpeedChange = (delayIdx: number) => {
    updateSpeed.mutate({ jobId: job.id, delay_seconds: DELAY_VALUES[delayIdx] });
  };

  const currentDelayIdx = DELAY_VALUES.findIndex(v => v >= job.delay_seconds);
  const delayIdx = currentDelayIdx >= 0 ? currentDelayIdx : 4;
  const [localDelayIdx, setLocalDelayIdx] = useState(delayIdx);
  useEffect(() => setLocalDelayIdx(delayIdx), [delayIdx]);

  return (
    <div className={`${th.panel} border ${isActive ? th.panelAmber : isPaused ? th.panelAmber : th.panelSlate} rounded-2xl p-5 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          {isActive && <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${th.pulse}`} />}
          <div>
            <p className={`text-sm font-medium ${th.h2}`}>
              {getCountryFlag(job.country_code)} {job.country_name}
              <span className={`ml-2 text-xs ${th.dim}`}>{job.network_name}</span>
            </p>
            <p className={`text-xs ${(statusColor as any)[job.status] || th.dim}`}>
              {statusLabel[job.status] || job.status} • {job.current_index}/{job.total_count}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {(job.processed_ids as number[])?.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowViewer(true)} className={th.btnTest} title="Visualizza dati scaricati">
              <List className="w-3.5 h-3.5 mr-1" /> Dati
            </Button>
          )}
          {isActive && (
            <>
              <Button size="sm" variant="outline" onClick={() => setShowSpeed(!showSpeed)} className={th.btnPause}>
                <Settings2 className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => pauseResume.mutate({ jobId: job.id, action: "pause" })} className={th.btnPause}>
                <Pause className="w-3.5 h-3.5 mr-1" /> Pausa
              </Button>
              <Button size="sm" variant="outline" onClick={() => pauseResume.mutate({ jobId: job.id, action: "cancel" })} className={th.btnStop}>
                <Square className="w-3.5 h-3.5 mr-1" /> Stop
              </Button>
            </>
          )}
          {isPaused && (
            <>
              <Button size="sm" onClick={() => pauseResume.mutate({ jobId: job.id, action: "resume" })} className={th.btnResume}>
                <Play className="w-3.5 h-3.5 mr-1" /> Riprendi
              </Button>
              <Button size="sm" variant="outline" onClick={() => pauseResume.mutate({ jobId: job.id, action: "cancel" })} className={th.btnStop}>
                <Square className="w-3.5 h-3.5 mr-1" /> Annulla
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className={`w-full h-1.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
        <div className={`h-full rounded-full transition-all ${isDark ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${progress}%` }} />
      </div>

      {/* Timing metrics */}
      {(isActive || isPaused) && job.current_index > 0 && (() => {
        const elapsedMs = new Date(job.updated_at).getTime() - new Date(job.created_at).getTime();
        const elapsedSec = Math.max(elapsedMs / 1000, 1);
        const avgSec = elapsedSec / job.current_index;
        const recentAvgSec = recentAvgMs ? recentAvgMs / 1000 : null;
        const etaBaseSec = recentAvgSec ?? avgSec;
        const remainingSec = etaBaseSec * (job.total_count - job.current_index);
        const fmtTime = (s: number) => {
          if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
          if (s >= 60) return `${Math.floor(s / 60)}min ${Math.floor(s % 60)}s`;
          return `${Math.floor(s)}s`;
        };
        return (
          <div className={`grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs p-3 rounded-lg border ${th.infoBox}`}>
            <div className={`flex items-center gap-1.5 ${th.body}`}>
              <Timer className="w-3 h-3 flex-shrink-0" />
              <span>Media: <span className={`font-mono font-bold ${th.dim}`}>{avgSec.toFixed(1)}s</span>/profilo</span>
            </div>
            <div className={`flex items-center gap-1.5 ${th.body}`}>
              <Zap className="w-3 h-3 flex-shrink-0" />
              <span>Corrente: <span className={`font-mono font-bold ${th.hi}`}>{recentAvgSec ? `${recentAvgSec.toFixed(1)}s` : "—"}</span>/profilo</span>
            </div>
            <div className={`flex items-center gap-1.5 ${th.body}`}>
              <Activity className="w-3 h-3 flex-shrink-0" />
              <span>Velocità: <span className={`font-mono font-bold ${th.hi}`}>{recentAvgSec ? `${(60 / recentAvgSec).toFixed(1)}` : (job.current_index / elapsedSec * 60).toFixed(1)}</span>/min</span>
            </div>
            <div className={`flex items-center gap-1.5 ${th.body}`}>
              <ArrowRight className="w-3 h-3 flex-shrink-0" />
              <span>Rimanenti: <span className={`font-mono font-bold ${th.hi}`}>~{fmtTime(remainingSec)}</span></span>
            </div>
          </div>
        );
      })()}

      {/* Last processed */}
      {job.last_processed_company && (
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-xs ${th.dim}`}>
            Ultimo: <span className={th.logName}>{job.last_processed_company}</span>
            <span className={`ml-2 ${th.logId}`}>#{job.last_processed_wca_id}</span>
          </p>
          {job.last_contact_result && (() => {
            const r = job.last_contact_result;
            if (r === 'email+phone') return <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white border-0"><Mail className="w-3 h-3 mr-0.5" /><Phone className="w-3 h-3 mr-0.5" /> Email + Tel</Badge>;
            if (r === 'email_only') return <Badge className="text-[10px] px-1.5 py-0 bg-blue-500 text-white border-0"><Mail className="w-3 h-3 mr-0.5" /> Solo Email</Badge>;
            if (r === 'phone_only') return <Badge className="text-[10px] px-1.5 py-0 bg-blue-500 text-white border-0"><Phone className="w-3 h-3 mr-0.5" /> Solo Tel</Badge>;
            return <Badge className="text-[10px] px-1.5 py-0 bg-red-500/80 text-white border-0"><XCircle className="w-3 h-3 mr-0.5" /> No contatti</Badge>;
          })()}
        </div>
      )}

      {/* Contact extraction summary */}
      {(job.contacts_found_count > 0 || job.contacts_missing_count > 0) && (() => {
        const found = job.contacts_found_count || 0;
        const missing = job.contacts_missing_count || 0;
        const total = found + missing;
        const pct = total > 0 ? Math.round((found / total) * 100) : 0;
        return (
          <div className={`text-xs p-2 rounded-lg border ${th.infoBox}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={th.body}>
                Contatti trovati: <span className="font-mono font-bold text-emerald-500">{found}</span>/{total} ({pct}%)
                <span className="mx-2">|</span>
                Mancanti: <span className="font-mono font-bold text-red-400">{missing}</span>
              </span>
            </div>
            <div className={`w-full h-1.5 rounded-full flex overflow-hidden ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
              <div className="h-full bg-red-500/60 transition-all" style={{ width: `${100 - pct}%` }} />
            </div>
          </div>
        );
      })()}

      {/* Speed control */}
      {showSpeed && (isActive || isPaused) && (
        <div className={`p-3 rounded-lg border ${th.infoBox}`}>
          <label className={`text-xs flex items-center gap-1.5 mb-2 ${th.label}`}>
            <Timer className="w-3 h-3" />
            Delay: <span className={`font-mono font-bold ${th.hi}`}>{DELAY_LABELS[DELAY_VALUES[localDelayIdx]]}</span>
          </label>
          <Slider value={[localDelayIdx]} onValueChange={([v]) => setLocalDelayIdx(v)} onValueCommit={([v]) => handleSpeedChange(v)} min={0} max={DELAY_VALUES.length - 1} step={1} className="w-full" />
        </div>
      )}

      {/* Error */}
      {job.error_message && (
        <p className={`text-xs ${th.logErr}`}>⚠️ {job.error_message}</p>
      )}

      {/* Completed info */}
      {job.status === "completed" && job.completed_at && (
        <p className={`text-xs ${th.dim}`}>
          Completato il {new Date(job.completed_at).toLocaleString("it-IT")}
        </p>
      )}

      <JobDataViewer
        open={showViewer}
        onOpenChange={setShowViewer}
        processedIds={(job.processed_ids as number[]) || []}
        countryName={job.country_name}
        countryCode={job.country_code}
        networkName={job.network_name}
        isDark={isDark}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Enrich Configure
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
      let query = supabase.from("partners").select("id, company_name, city, country_code, website, enriched_at, partner_type, rating").not("website", "is", null).order("company_name");
      if (filterCountry) query = query.eq("country_code", filterCountry);
      if (filterType) query = query.eq("partner_type", filterType as any);
      if (onlyNotEnriched) query = query.is("enriched_at", null);
      const { data, error } = await query.limit(500);
      if (error) throw error;
      return data as EnrichPartner[];
    },
  });

  return (
    <div className="flex-1 flex items-start justify-center pt-8">
      <div className={`${th.panel} border ${th.panelEmerald} rounded-2xl p-8 max-w-2xl w-full space-y-4`}>
        <div>
          <h2 className={`text-xl mb-1 ${th.h2}`}>Arricchimento dal Sito</h2>
          <p className={`text-sm ${th.sub}`}>Seleziona partner da arricchire con AI</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select value={filterCountry || "__all__"} onValueChange={v => setFilterCountry(v === "__all__" ? "" : v)}>
            <SelectTrigger className={th.selTrigger}><SelectValue placeholder="Tutti i paesi" /></SelectTrigger>
            <SelectContent className={th.selContent}>
              <SelectItem value="__all__">Tutti i paesi</SelectItem>
              {WCA_COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.code} — {c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterType || "__all__"} onValueChange={v => setFilterType(v === "__all__" ? "" : v)}>
            <SelectTrigger className={th.selTrigger}><SelectValue placeholder="Tutti i tipi" /></SelectTrigger>
            <SelectContent className={th.selContent}>
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
            <Checkbox checked={onlyNotEnriched} onCheckedChange={v => setOnlyNotEnriched(!!v)} />
            Solo non arricchiti
          </label>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className={`w-6 h-6 animate-spin ${th.sub}`} /></div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <button onClick={() => { if (selected.size === (partners?.length || 0)) setSelected(new Set()); else setSelected(new Set(partners?.map(p => p.id))); }} className={`text-xs ${th.sub} hover:opacity-80`}>
                {selected.size === (partners?.length || 0) ? "Deseleziona" : `Seleziona tutti (${partners?.length || 0})`}
              </button>
              <span className={`text-xs ${th.dim}`}>{selected.size} selezionati</span>
            </div>
            <ScrollArea className={`h-60 border rounded-lg ${th.panelSlate}`}>
              <div className={th.divider}>
                {partners?.map(p => (
                  <div key={p.id} onClick={() => setSelected(prev => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })} className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${th.hover}`}>
                    <Checkbox checked={selected.has(p.id)} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm truncate ${th.chipName}`}>{p.company_name}</p>
                      <p className={`text-xs ${th.chipSub}`}>{p.city}, {p.country_code}</p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </>
        )}
        <Button onClick={() => { sessionStorage.setItem("enrich_ids", JSON.stringify(Array.from(selected))); onStart(); }} disabled={selected.size === 0} className={`w-full ${th.btnEn}`}>
          <Sparkles className="w-4 h-4 mr-2" />
          Avvia Arricchimento ({selected.size})
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Enrich Running
// ═══════════════════════════════════════════════════════════════
function EnrichRunning() {
  const isDark = useTheme();
  const th = t(isDark);
  const ids: string[] = JSON.parse(sessionStorage.getItem("enrich_ids") || "[]");
  const [current, setCurrent] = useState(0);
  const [isRunning, setIsRunning] = useState(true);
  const [results, setResults] = useState<{ id: string; success: boolean }[]>([]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      for (let i = 0; i < ids.length; i++) {
        if (!mounted) break;
        setCurrent(i + 1);
        try {
          const { data: partner } = await supabase.from("partners").select("id, website").eq("id", ids[i]).single();
          if (partner?.website) {
            await supabase.functions.invoke("enrich-partner-website", { body: { partnerId: partner.id, website: partner.website } });
            if (mounted) setResults(prev => [...prev, { id: ids[i], success: true }]);
          }
        } catch { if (mounted) setResults(prev => [...prev, { id: ids[i], success: false }]); }
        if (i < ids.length - 1) await new Promise(r => setTimeout(r, 3000));
      }
      if (mounted) { setIsRunning(false); toast({ title: "Arricchimento completato", description: `${results.length} partner processati` }); }
    };
    run();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className={`${th.panel} border ${th.panelEmerald} rounded-2xl p-8 max-w-md w-full text-center space-y-6`}>
        {isRunning ? (
          <>
            <Loader2 className={`w-10 h-10 animate-spin mx-auto ${th.acEm}`} />
            <p className={`text-lg ${th.h2}`}>Arricchimento in corso...</p>
            <p className={`text-sm ${th.sub}`}>{current} di {ids.length}</p>
          </>
        ) : (
          <>
            <CheckCircle className={`w-10 h-10 mx-auto ${th.acEm}`} />
            <p className={`text-lg ${th.h2}`}>Completato</p>
          </>
        )}
        <div className="flex justify-center gap-4">
          <StatBadge label="Successo" value={results.filter(r => r.success).length} color="emerald" />
          <StatBadge label="Errori" value={results.filter(r => !r.success).length} color="red" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Network Configure
// ═══════════════════════════════════════════════════════════════
function NetworkConfigure() {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: configs, isLoading, updateConfig } = useNetworkConfigs();
  const [testing, setTesting] = useState<string | null>(null);

  const handleTest = async (config: NetworkConfig) => {
    setTesting(config.id);
    try {
      const sampleIds = [11470, 11471, 11472];
      let hasEmails = false, hasNames = false, hasPhones = false;
      for (const id of sampleIds) {
        const result = await scrapeWcaPartnerById(id);
        if (result.success && result.found && result.partner) {
          if (result.partner.email) hasEmails = true;
          if (result.partner.contacts?.some(c => c.name && c.name !== c.title)) { hasEmails = true; hasNames = true; }
          if (result.partner.phone) hasPhones = true;
        }
      }
      updateConfig.mutate({ id: config.id, has_contact_emails: hasEmails, has_contact_names: hasNames, has_contact_phones: hasPhones, sample_tested_at: new Date().toISOString() });
      toast({ title: "Test completato", description: `Email: ${hasEmails ? "Sì" : "No"} | Nomi: ${hasNames ? "Sì" : "No"} | Tel: ${hasPhones ? "Sì" : "No"}` });
    } catch (err) {
      toast({ title: "Errore nel test", description: String(err), variant: "destructive" });
    } finally { setTesting(null); }
  };

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><Loader2 className={`w-8 h-8 animate-spin ${th.sub}`} /></div>;

  return (
    <div className="flex-1 flex items-start justify-center pt-8">
      <div className={`${th.panel} border ${th.panelBlue} rounded-2xl p-8 max-w-2xl w-full space-y-4`}>
        <div>
          <h2 className={`text-xl mb-1 ${th.h2}`}>Analisi Network</h2>
          <p className={`text-sm ${th.sub}`}>Seleziona i gruppi WCA di cui sei membro e testa la visibilità dei dati</p>
        </div>
        <div className="space-y-2">
          {configs?.map(config => {
            const tested = !!config.sample_tested_at;
            const allOk = tested && config.has_contact_emails && config.has_contact_names && config.has_contact_phones;
            const cardBorder = tested
              ? (allOk
                ? (isDark ? "border-emerald-500/40 bg-emerald-500/5" : "border-emerald-300 bg-emerald-50/50")
                : (isDark ? "border-amber-500/40 bg-amber-500/5" : "border-amber-300 bg-amber-50/50"))
              : th.cardBg;
            return (
              <div key={config.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${cardBorder}`}>
                <div className="flex items-center gap-3">
                  <Checkbox checked={config.is_member} onCheckedChange={() => updateConfig.mutate({ id: config.id, is_member: !config.is_member })} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${th.chipName}`}>{config.network_name}</p>
                      {tested && (
                        <Badge className={`text-[10px] px-1.5 py-0 ${allOk
                          ? (isDark ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-emerald-100 text-emerald-700 border-emerald-200")
                          : (isDark ? "bg-amber-500/20 text-amber-400 border-amber-500/30" : "bg-amber-100 text-amber-700 border-amber-200")
                        }`}>
                          {allOk ? <><CheckCircle className="w-3 h-3 mr-0.5" /> Verificato</> : "Parziale"}
                        </Badge>
                      )}
                    </div>
                    {tested && <p className={`text-xs ${th.dim}`}>Testato: {new Date(config.sample_tested_at!).toLocaleDateString("it-IT")}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {tested && (
                    <div className="flex items-center gap-2 text-xs">
                      <StatusDot ok={config.has_contact_emails} label="Email" />
                      <StatusDot ok={config.has_contact_names} label="Nomi" />
                      <StatusDot ok={config.has_contact_phones} label="Tel" />
                    </div>
                  )}
                  {config.is_member && (
                    <Button size="sm" variant="outline" onClick={() => handleTest(config)} disabled={testing !== null} className={th.btnTest}>
                      {testing === config.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                      <span className="ml-1">{tested ? "Ri-testa" : "Test"}</span>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Shared ──────────────────────────────────────────────────
function StatBadge({ label, value, color }: { label: string; value: number | string; color: string; icon?: React.ReactNode }) {
  const isDark = useTheme();
  const cc: Record<string, Record<string, string>> = {
    dark: { amber: "bg-amber-500/10 border-amber-500/30 text-amber-400", emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", blue: "bg-blue-500/10 border-blue-500/30 text-blue-400", red: "bg-red-500/10 border-red-500/30 text-red-400", slate: "bg-slate-500/10 border-slate-500/30 text-slate-400" },
    light: { amber: "bg-sky-50 border-sky-200 text-sky-700", emerald: "bg-emerald-50 border-emerald-200 text-emerald-700", blue: "bg-blue-50 border-blue-200 text-blue-700", red: "bg-red-50 border-red-200 text-red-700", slate: "bg-slate-100 border-slate-200 text-slate-600" },
  };
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${cc[isDark ? "dark" : "light"][color] || cc[isDark ? "dark" : "light"].slate}`}>
      <span className="font-mono text-sm">{value}</span><span className="text-xs opacity-60">{label}</span>
    </div>
  );
}

function StatusDot({ ok, label }: { ok: boolean; label: string }) {
  const isDark = useTheme();
  const th = t(isDark);
  return (
    <div className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${ok ? th.dotOn : th.dotOff}`} />
      <span className={th.dotLbl}>{label}</span>
    </div>
  );
}
