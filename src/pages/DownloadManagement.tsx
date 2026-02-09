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
  Loader2, Timer, Building2, CheckCircle, FlaskConical,
  ArrowRight, Zap, ChevronDown, ChevronRight, Sun, Moon,
  Search, Users, MapPin, Settings2, List, FileDown, Activity
} from "lucide-react";
import {
  scrapeWcaPartnerById,
  scrapeWcaDirectory,
  type ScrapedPartner,
  type DirectoryMember,
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

// ─── Theme ────────────────────────────────────────────────────
const ThemeCtx = createContext(true);
const useTheme = () => useContext(ThemeCtx);

function t(dark: boolean) {
  return {
    pageBg: dark ? "bg-slate-950" : "bg-slate-50",
    pageGrad1: dark ? "from-slate-950 via-slate-900 to-slate-950" : "from-slate-100 via-white to-slate-100",
    pageGrad2: dark ? "from-amber-900/10" : "from-sky-200/30",
    panel: dark ? "bg-black/40 backdrop-blur-xl" : "bg-white/80 backdrop-blur-lg shadow-lg",
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
      ? "bg-slate-800/50 border-slate-700/50 hover:border-amber-500/40 hover:bg-slate-800/80 text-slate-200"
      : "bg-white border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 text-slate-700 shadow-sm",
    infoBox: dark ? "bg-slate-800/50 border-slate-700 text-slate-300" : "bg-slate-50 border-slate-200 text-slate-600",
  };
}

const DELAY_VALUES = [0, 1, 2, 3, 5, 8, 10, 15, 20, 30, 45, 60];
const DELAY_LABELS: Record<number, string> = { 0: "0s", 1: "1s", 2: "2s", 3: "3s", 5: "5s", 8: "8s", 10: "10s", 15: "15s", 20: "20s", 30: "30s", 45: "45s", 60: "60s" };
const PAUSE_DURATION_VALUES = [10, 30, 60, 120, 300, 600, 1800, 3600];
const formatDuration = (s: number) => s >= 3600 ? `${(s / 3600).toFixed(0)}h` : s >= 60 ? `${(s / 60).toFixed(0)}min` : `${s}s`;

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
          {/* Compact top bar: back + theme toggle */}
          <div className="flex items-center justify-between px-6 py-2 flex-shrink-0">
            <div>
              {step !== "choose" && (
                <button onClick={goBack} className={`flex items-center gap-1.5 text-sm transition-colors ${th.back}`}>
                  <ArrowLeft className="w-4 h-4" /> Indietro
                </button>
              )}
            </div>
            <button onClick={toggleTheme} className={`p-2 rounded-xl transition-all ${isDark ? "bg-slate-800/60 hover:bg-slate-700/60 text-amber-400" : "bg-white/80 hover:bg-white shadow-sm text-sky-600"}`}>
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          {/* Content area — scrollable */}
          <div className="flex-1 flex flex-col min-h-0 px-6 pb-6 overflow-auto">
            {step === "choose" && <StepChoose onSelect={a => { setAction(a); setStep("configure"); }} onGoToJobs={() => { setAction("download"); setStep("running"); }} />}
            {step === "configure" && action === "download" && <DownloadWizard onStartRunning={() => setStep("running")} />}
            {step === "configure" && action === "enrich" && <EnrichConfigure onStart={() => setStep("running")} />}
            {step === "configure" && action === "network" && <NetworkConfigure />}
            {step === "running" && action === "download" && <DownloadRunning />}
            {step === "running" && action === "enrich" && <EnrichRunning />}
          </div>
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
// STEP 1 - Choose Action
// ═══════════════════════════════════════════════════════════════
function StepChoose({ onSelect, onGoToJobs }: { onSelect: (a: ActionType) => void; onGoToJobs: () => void }) {
  const isDark = useTheme();
  const th = t(isDark);
  const { data: jobs } = useDownloadJobs();
  const activeJobs = (jobs || []).filter(j => j.status === "running" || j.status === "pending" || j.status === "paused");

  const actions = [
    { type: "download" as ActionType, icon: Download, title: "Scarica Partner", desc: "Scegli paese e network, cerca la lista, poi scarica i dettagli", color: "amber" },
    { type: "enrich" as ActionType, icon: Sparkles, title: "Arricchisci dal Sito", desc: "Leggi siti web di partner già scaricati con AI", color: "emerald" },
    { type: "network" as ActionType, icon: Globe, title: "Analisi Network", desc: "Verifica a quali gruppi WCA hai accesso ai dati", color: "blue" },
  ];
  const cMap: Record<string, string> = isDark
    ? { amber: "border-amber-500/30 hover:border-amber-500/60 hover:bg-amber-500/5", emerald: "border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/5", blue: "border-blue-500/30 hover:border-blue-500/60 hover:bg-blue-500/5" }
    : { amber: "border-sky-200 hover:border-sky-400 hover:bg-sky-50", emerald: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50", blue: "border-blue-200 hover:border-blue-400 hover:bg-blue-50" };
  const iMap: Record<string, string> = { amber: th.acAmber, emerald: th.acEm, blue: th.acBl };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      {/* Active jobs banner — clickable */}
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        {actions.map(a => (
          <button key={a.type} onClick={() => onSelect(a.type)} className={`group ${th.panel} border rounded-2xl p-8 text-left transition-all duration-300 ${cMap[a.color]}`}>
            <a.icon className={`w-10 h-10 mb-4 ${iMap[a.color]}`} />
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
// DOWNLOAD WIZARD — Country → Network → Fase1: Lista → Fase2: Dettagli
// ═══════════════════════════════════════════════════════════════
type DlSub = "country" | "network" | "listing" | "details";

function DownloadWizard({ onStartRunning }: { onStartRunning: () => void }) {
  const isDark = useTheme();
  const th = t(isDark);
  const [sub, setSub] = useState<DlSub>("country");
  const [countries, setCountries] = useState<{ code: string; name: string }[]>([]);
  const [network, setNetwork] = useState("");
  const [search, setSearch] = useState("");
  const [discoveredMembers, setDiscoveredMembers] = useState<DirectoryMember[]>([]);

  const labels = ["Paesi", "Network", "Fase 1: Lista", "Fase 2: Dettagli"];
  const keys: DlSub[] = ["country", "network", "listing", "details"];
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

  const handleListingComplete = (members: DirectoryMember[]) => {
    setDiscoveredMembers(members);
    setSub("details");
  };

  const handleSaveIdsOnly = () => {
    // Return to country selection after saving IDs
    setSub("country");
    setCountries([]);
    setNetwork("");
    setDiscoveredMembers([]);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Compact stepper + back in one row */}
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
        <PickNetwork country={countries[0]} onSelect={n => { setNetwork(n); setSub("listing"); }} />
      )}
      {sub === "listing" && countries.length > 0 && (
        <DirectoryScanner
          countries={countries}
          network={network}
          onComplete={handleListingComplete}
          onSaveIdsOnly={handleSaveIdsOnly}
        />
      )}
      {sub === "details" && discoveredMembers.length > 0 && (
        <Phase2Config
          countries={countries}
          network={network}
          members={discoveredMembers}
          onStart={onStartRunning}
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

  // Partner counts per country with office_type breakdown
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

  // Directory cache data per country (counts + verified flag)
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

  const exploredSet = new Set(Object.keys(cacheCounts)); // Explored = has directory scan
  const partialSet = new Set(Object.keys(partnerCounts).filter(k => !cacheCounts[k])); // DB only, no scan
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
    // completion: show incomplete first (have cache but not fully downloaded)
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
        <h2 className={`text-xl mb-1 ${th.h2}`}>Quali paesi vuoi esplorare?</h2>
        <p className={`text-sm ${th.sub}`}>Seleziona uno o più paesi — poi prosegui</p>
      </div>

      {selected.length > 0 && (
        <div className="w-full max-w-3xl">
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
      <div className="w-full max-w-3xl flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
          <Input placeholder="Cerca paese..." value={search} onChange={e => onSearchChange(e.target.value)} className={`pl-10 ${th.input}`} />
        </div>
        {/* Filter buttons */}
        {(["all", "explored", "partial", "missing"] as const).map(mode => {
          const labels = { all: `Tutti (${WCA_COUNTRIES.length})`, explored: `Scansionati (${exploredCount})`, partial: `Dati parziali (${partialCount})`, missing: `Mai esplorati (${missingCount})` };
          const active = filterMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all whitespace-nowrap ${
                active
                  ? isDark ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-sky-100 border-sky-300 text-sky-700"
                  : th.optCard
              }`}
            >
              {mode === "all" && <Globe className="w-3.5 h-3.5" />}
              {mode === "explored" && <CheckCircle className="w-3.5 h-3.5" />}
              {mode === "partial" && <Activity className="w-3.5 h-3.5" />}
              {mode === "missing" && <Download className="w-3.5 h-3.5" />}
              {labels[mode]}
            </button>
          );
        })}
        {/* Sort */}
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
      </div>

      <ScrollArea className="flex-1 w-full max-w-3xl">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pr-4">
          {filtered.map(c => {
            const isSelected = selectedCodes.has(c.code);
            const pCount = partnerCounts[c.code] || 0;
            const cCount = cacheCounts[c.code] || 0;
            const hasDirectoryScan = cCount > 0;
            const hasDbOnly = pCount > 0 && cCount === 0;
            const isExplored = hasDirectoryScan;
            const isVerified = cacheData[c.code]?.verified === true;
            const isComplete = isVerified;
            return (
              <button
                key={c.code}
                onClick={() => onToggle(c.code, c.name)}
                className={`relative flex items-center gap-2 p-3 rounded-lg border transition-all text-left overflow-hidden ${
                  isSelected
                    ? isDark ? "bg-amber-500/15 border-amber-500/40 ring-1 ring-amber-500/30" : "bg-sky-50 border-sky-300 ring-1 ring-sky-300"
                    : th.optCard
                }`}
              >
                {/* Green gradient only for scanned countries */}
                {isExplored && !isSelected && (
                  <div className={`absolute inset-0 pointer-events-none ${
                    isDark
                      ? "bg-gradient-to-l from-emerald-500/12 via-emerald-500/5 to-transparent"
                      : "bg-gradient-to-l from-emerald-100/80 via-emerald-50/40 to-transparent"
                  }`} />
                )}
                {/* Orange gradient for DB-only (partial data) */}
                {hasDbOnly && !isSelected && (
                  <div className={`absolute inset-0 pointer-events-none ${
                    isDark
                      ? "bg-gradient-to-l from-orange-500/10 via-orange-500/3 to-transparent"
                      : "bg-gradient-to-l from-orange-100/60 via-orange-50/30 to-transparent"
                  }`} />
                )}
                <span className="relative text-lg">{getCountryFlag(c.code)}</span>
                <div className="relative min-w-0 flex-1">
                  <p className="text-sm truncate">{c.name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {hasDirectoryScan && (
                      <>
                        <span className={`text-[10px] ${th.acEm}`}>{pCount}/{cCount}</span>
                        {pCount > 0 && partnerData[c.code] && (partnerData[c.code].branch > 0) && (
                          <span className={`text-[10px] ${th.dim}`}>({partnerData[c.code].hq}HQ+{partnerData[c.code].branch}B)</span>
                        )}
                      </>
                    )}
                    {hasDbOnly && (
                      <>
                        <span className={`text-[10px] ${isDark ? "text-orange-400" : "text-orange-600"}`}>{pCount} partner (lista ?)</span>
                        {partnerData[c.code] && partnerData[c.code].branch > 0 && (
                          <span className={`text-[10px] ${th.dim}`}>({partnerData[c.code].hq}HQ+{partnerData[c.code].branch}B)</span>
                        )}
                      </>
                    )}
                    {!hasDirectoryScan && !hasDbOnly && (
                      <span className={`text-[10px] ${th.dim}`}>{c.code}</span>
                    )}
                  </div>
                </div>
                {isSelected && <CheckCircle className={`relative w-4 h-4 flex-shrink-0 ${isDark ? "text-amber-400" : "text-sky-500"}`} />}
                {!isSelected && isComplete && (
                  <span className={`relative text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${isDark ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>
                    <CheckCircle className="w-3 h-3" /> Completo
                  </span>
                )}
                {!isSelected && !isComplete && hasDirectoryScan && (
                  <span className={`relative text-[10px] px-1.5 py-0.5 rounded font-mono ${isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>{pCount}/{cCount}</span>
                )}
                {!isSelected && hasDbOnly && (
                  <span className={`relative text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-orange-500/15 text-orange-400 border border-orange-500/30" : "bg-orange-50 text-orange-600 border border-orange-200"}`}>Parziale</span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {selected.length > 0 && (
        <div className="w-full max-w-3xl">
          <Button onClick={onConfirm} className={`w-full ${th.btnPri}`}>
            <ArrowRight className="w-4 h-4 mr-2" />
            Prosegui con {selected.length} {selected.length === 1 ? "paese" : "paesi"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Pick Network ────────────────────────────────────────────
function PickNetwork({ country, onSelect }: {
  country: { code: string; name: string };
  onSelect: (n: string) => void;
}) {
  const isDark = useTheme();
  const th = t(isDark);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6">
      <div className="text-center">
        <h2 className={`text-xl mb-1 ${th.h2}`}>Quale network?</h2>
        <p className={`text-sm ${th.sub}`}>
          {getCountryFlag(country.code)} {country.name} — Vuoi filtrare per un gruppo WCA specifico?
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl w-full">
        <button onClick={() => onSelect("")} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${th.optCard}`}>
          <Globe className={`w-5 h-5 ${th.acAmber}`} />
          <div className="text-left">
            <p className="text-sm font-medium">Tutti i Network</p>
            <p className={`text-xs ${th.dim}`}>Cerca tutti i partner WCA</p>
          </div>
        </button>
        {WCA_NETWORKS.map(n => (
          <button key={n} onClick={() => onSelect(n)} className={`flex items-center gap-3 p-4 rounded-xl border transition-all ${th.optCard}`}>
            <Users className={`w-5 h-5 flex-shrink-0 ${th.acAmber}`} />
            <span className="text-sm text-left">{n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FASE 1: Directory Scanner — scrapes the listing page by page
// Uses directory_cache to remember previous scans
// ═══════════════════════════════════════════════════════════════
function DirectoryScanner({ countries, network, onComplete, onSaveIdsOnly }: {
  countries: { code: string; name: string }[];
  network: string;
  onComplete: (members: DirectoryMember[]) => void;
  onSaveIdsOnly?: () => void;
}) {
  const isDark = useTheme();
  const th = t(isDark);
  const countryCodes = countries.map(c => c.code);
  const networkKey = network || "";

  // 1) Load cached directory scan for these countries
  const { data: cachedEntries = [], isLoading: loadingCache } = useQuery({
    queryKey: ["directory-cache", countryCodes, networkKey],
    queryFn: async () => {
      const { data } = await supabase
        .from("directory_cache")
        .select("*")
        .in("country_code", countryCodes)
        .eq("network_name", networkKey);
      return data || [];
    },
    staleTime: 30_000,
  });

  // 2) Load partners already in DB for these countries
  const { data: dbPartners = [], isLoading: loadingDb } = useQuery({
    queryKey: ["db-partners-for-countries", countryCodes],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("wca_id, company_name, city, country_code, country_name, updated_at, rating, partner_type")
        .in("country_code", countryCodes)
        .not("wca_id", "is", null)
        .order("company_name");
      return (data || []).map(p => ({
        wca_id: p.wca_id!,
        company_name: p.company_name,
        city: p.city,
        country_code: p.country_code,
        country_name: p.country_name,
        updated_at: p.updated_at,
        rating: p.rating,
        partner_type: p.partner_type,
      }));
    },
    staleTime: 30_000,
  });

  // Build cached members from directory_cache
  const cachedMembers: DirectoryMember[] = cachedEntries.flatMap((entry: any) => {
    const members = entry.members as any[];
    return (members || []).map((m: any) => ({
      company_name: m.company_name,
      city: m.city,
      country: m.country,
      wca_id: m.wca_id,
    }));
  });

  const cachedTotalResults = cachedEntries.reduce((sum: number, e: any) => sum + (e.total_results || 0), 0);
  const cachedAt = cachedEntries.length > 0
    ? cachedEntries.reduce((latest: string, e: any) => e.scanned_at > latest ? e.scanned_at : latest, cachedEntries[0].scanned_at)
    : null;

  // Cross-reference: which cached members are already downloaded?
  const dbWcaSet = new Set(dbPartners.map(p => p.wca_id));
  const dbPartnerMap = new Map(dbPartners.map(p => [p.wca_id, p]));

  // The authoritative member list: cached if available, otherwise DB-only
  const hasCache = cachedMembers.length > 0;

  // Build unified list with status
  type MemberWithStatus = DirectoryMember & { inDb: boolean; updatedAt?: string | null; rating?: number | null; partnerType?: string | null };

  const buildMemberList = (source: DirectoryMember[]): MemberWithStatus[] => {
    const seen = new Set<number>();
    const result: MemberWithStatus[] = [];
    for (const m of source) {
      if (m.wca_id && seen.has(m.wca_id)) continue;
      if (m.wca_id) seen.add(m.wca_id);
      const dbP = m.wca_id ? dbPartnerMap.get(m.wca_id) : undefined;
      result.push({
        ...m,
        inDb: m.wca_id ? dbWcaSet.has(m.wca_id) : false,
        updatedAt: dbP?.updated_at,
        rating: dbP?.rating,
        partnerType: dbP?.partner_type,
      });
    }
    // Also add DB partners not in the source list
    for (const p of dbPartners) {
      if (!seen.has(p.wca_id)) {
        seen.add(p.wca_id);
        result.push({
          company_name: p.company_name,
          city: p.city,
          country: p.country_name,
          wca_id: p.wca_id,
          inDb: true,
          updatedAt: p.updated_at,
          rating: p.rating,
          partnerType: p.partner_type,
        });
      }
    }
    return result;
  };

  // Scanning state
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [scannedMembers, setScannedMembers] = useState<DirectoryMember[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [currentCountryIdx, setCurrentCountryIdx] = useState(0);
  const [pageTime, setPageTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);

  // Which list to show
  const sourceMembers = hasScanned ? scannedMembers : (hasCache ? cachedMembers : []);
  const members = buildMemberList(sourceMembers);

  const downloadedCount = members.filter(m => m.inDb).length;
  const missingCount = members.filter(m => !m.inDb && m.wca_id).length;
  const totalCount = members.length;

  // Detail dialog
  const [selectedMember, setSelectedMember] = useState<MemberWithStatus | null>(null);

  // Speed control
  const [listingDelayIdx, setListingDelayIdx] = useState(0);
  const listingDelayRef = useRef(DELAY_VALUES[0] * 1000);
  useEffect(() => { listingDelayRef.current = DELAY_VALUES[listingDelayIdx] * 1000; }, [listingDelayIdx]);

  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const waitWhilePaused = useCallback(async () => {
    while (pauseRef.current && !abortRef.current) await new Promise(r => setTimeout(r, 300));
  }, []);

  // Save scan results to directory_cache
  const saveScanToCache = useCallback(async (countryCode: string, scanned: DirectoryMember[], total: number, pages: number) => {
    const membersJson = scanned.map(m => ({
      company_name: m.company_name,
      city: m.city,
      country: m.country,
      wca_id: m.wca_id,
    }));

    await supabase
      .from("directory_cache")
      .upsert({
        country_code: countryCode,
        network_name: networkKey,
        members: membersJson as any,
        total_results: total,
        total_pages: pages,
        scanned_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "country_code,network_name" });

    queryClient.invalidateQueries({ queryKey: ["directory-cache"] });
  }, [networkKey, queryClient]);

  const handleStart = useCallback(async () => {
    setIsRunning(true);
    setHasScanned(true);
    setError(null);
    abortRef.current = false;
    const allMembers: DirectoryMember[] = [];

    for (let ci = 0; ci < countries.length; ci++) {
      if (abortRef.current) break;
      setCurrentCountryIdx(ci);
      const country = countries[ci];
      let page = 1;
      let hasNext = true;
      let countryTotal = 0;
      let countryPages = 0;
      const countryMembers: DirectoryMember[] = [];

      while (hasNext && !abortRef.current) {
        await waitWhilePaused();
        if (abortRef.current) break;

        setCurrentPage(page);
        const start = Date.now();

        try {
          const result = await scrapeWcaDirectory(country.code, network, page);
          const elapsed = Date.now() - start;
          setPageTime(elapsed);

          if (!result.success) {
            setError(result.error || "Errore sconosciuto");
            break;
          }

          if (result.members.length > 0) {
            const newMembers = result.members.map(m => ({
              ...m,
              country: m.country || country.name,
            }));
            countryMembers.push(...newMembers);
            allMembers.push(...newMembers);
            setScannedMembers([...allMembers]);
          }

          countryTotal = result.pagination.total_results;
          countryPages = result.pagination.total_pages;
          setTotalResults(result.pagination.total_results);
          setTotalPages(result.pagination.total_pages);
          // Deterministic: if we got 50 results, assume there's more
          hasNext = result.pagination.has_next_page || result.members.length >= 50;
          page++;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Errore di rete");
          break;
        }

        if (hasNext && !abortRef.current) {
          await new Promise(r => setTimeout(r, listingDelayRef.current));
        }
      }

      // Save this country's results to cache
      if (countryMembers.length > 0) {
        await saveScanToCache(country.code, countryMembers, countryTotal, countryPages);
      }
    }

    setIsRunning(false);
    setIsComplete(true);
  }, [countries, network, waitWhilePaused, saveScanToCache]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [members.length]);

  const countryLabel = countries.length === 1
    ? `${getCountryFlag(countries[0].code)} ${countries[0].name}`
    : `${countries.length} paesi`;

  const membersWithId = members.filter(m => m.wca_id);
  const missingMembers = members.filter(m => !m.inDb && m.wca_id);

  const isLoading = loadingCache || loadingDb;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className={`w-6 h-6 animate-spin ${th.sub}`} />
        <span className={`ml-2 text-sm ${th.sub}`}>Caricamento dati...</span>
      </div>
    );
  }

  // Determine header status text
  const headerStatus = isComplete
    ? "COMPLETATA"
    : isRunning
      ? "SCANSIONE LISTA"
      : hasCache
        ? "DATI DALLA CACHE"
        : dbPartners.length > 0
          ? "SOLO DATABASE"
          : "PRONTO";

  return (
    <div className="flex-1 flex gap-6 min-h-0">
      {/* Left: controls + log */}
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Header */}
        <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-6`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              {isRunning && !isPaused && <div className={`w-3 h-3 rounded-full animate-pulse ${th.pulse}`} />}
              {isPaused && <Pause className={`w-4 h-4 ${th.acAmber}`} />}
              <div>
                <p className={`text-xs ${th.sub}`}>
                  FASE 1 — {headerStatus} • {countryLabel}
                  {network && ` • ${network}`}
                </p>

                {/* Summary numbers */}
                {!isRunning && !isComplete && totalCount > 0 && (
                  <div>
                    <p className={`text-2xl font-mono ${th.mono}`}>
                      {totalCount} partner
                      {hasCache && <span className={`text-sm ml-2 ${th.dim}`}>(dalla directory)</span>}
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className={`text-sm font-medium ${th.acEm}`}>✓ {downloadedCount} scaricati</span>
                      {missingCount > 0 && (
                        <span className={`text-sm font-medium ${th.hi}`}>↓ {missingCount} da scaricare</span>
                      )}
                    </div>
                  </div>
                )}

                {!isRunning && !isComplete && totalCount === 0 && (
                  <p className={`text-lg ${th.mono}`}>Nessun dato disponibile — avvia la scansione</p>
                )}

                {isRunning && (
                  <p className={`text-2xl font-mono ${th.mono}`}>
                    Pagina {currentPage}
                    {totalPages !== null && <span className={`text-sm ml-1 ${th.dim}`}>/{totalPages}</span>}
                    <span className={`text-sm ml-3 ${th.dim}`}>Trovati: {scannedMembers.length}</span>
                  </p>
                )}
                {isComplete && (
                  <div>
                    <p className={`text-2xl font-mono ${th.mono}`}>
                      {totalCount} partner nella directory
                    </p>
                    <div className="flex items-center gap-4 mt-1">
                      <span className={`text-sm font-medium ${th.acEm}`}>✓ {downloadedCount} scaricati</span>
                      {missingCount > 0 && (
                        <span className={`text-sm font-medium ${th.hi}`}>↓ {missingCount} da scaricare</span>
                      )}
                    </div>
                  </div>
                )}

                {pageTime !== null && isRunning && (
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border mt-2 w-fit ${th.cdBg}`}>
                    <Zap className={`w-3.5 h-3.5 ${th.cdIcon}`} />
                    <span className={`font-mono text-xs ${th.cdText}`}>{(pageTime / 1000).toFixed(1)}s/pagina</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {/* Main actions */}
              {!isRunning && !isComplete && missingCount > 0 && (
                <Button onClick={() => onComplete(missingMembers as DirectoryMember[])} className={th.btnPri}>
                  <Download className="w-4 h-4 mr-1" /> Scarica {missingCount} mancanti
                </Button>
              )}
              {!isRunning && !isComplete && totalCount > 0 && onSaveIdsOnly && (
                <Button variant="outline" onClick={() => {
                  toast({ title: "✅ Lista ID salvata nella cache", description: `${totalCount} ID dalla directory sono stati salvati per ${countryLabel}. Torna qui quando vuoi scaricare i profili completi.` });
                  onSaveIdsOnly();
                }} className={th.btnPause}>
                  <List className="w-4 h-4 mr-1" /> Salva solo lista ID
                </Button>
              )}
              {!isRunning && !isComplete && downloadedCount > 0 && missingCount === 0 && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isDark ? "bg-emerald-500/10 text-emerald-400" : "bg-emerald-50 text-emerald-700"}`}>
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Tutti scaricati ✓</span>
                </div>
              )}
              {!isRunning && (
                <Button onClick={handleStart} variant="outline" className={th.btnPause}>
                  <Play className="w-4 h-4 mr-1" /> {hasCache || dbPartners.length > 0 ? "Ri-scansiona" : "Avvia Scansione"}
                </Button>
              )}
              {isRunning && !isPaused && (
                <Button size="sm" variant="outline" onClick={() => { pauseRef.current = true; setIsPaused(true); }} className={th.btnPause}>
                  <Pause className="w-4 h-4 mr-1" /> Pausa
                </Button>
              )}
              {isPaused && (
                <Button size="sm" onClick={() => { pauseRef.current = false; setIsPaused(false); }} className={th.btnResume}>
                  <Play className="w-4 h-4 mr-1" /> Riprendi
                </Button>
              )}
              {isRunning && (
                <Button size="sm" variant="outline" onClick={() => { abortRef.current = true; setIsRunning(false); setIsComplete(true); }} className={th.btnStop}>
                  <Square className="w-4 h-4 mr-1" /> Stop
                </Button>
              )}
              {isComplete && missingCount > 0 && (
                <Button onClick={() => onComplete(missingMembers as DirectoryMember[])} className={th.btnPri}>
                  <Download className="w-4 h-4 mr-2" />
                  Scarica {missingCount} mancanti
                </Button>
              )}
              {isComplete && totalCount > 0 && onSaveIdsOnly && (
                <Button variant="outline" onClick={() => {
                  toast({ title: "✅ Lista ID salvata nella cache", description: `${totalCount} ID dalla directory sono stati salvati per ${countryLabel}. Torna qui quando vuoi scaricare i profili completi.` });
                  onSaveIdsOnly();
                }} className={th.btnPause}>
                  <List className="w-4 h-4 mr-1" /> Salva solo lista ID
                </Button>
              )}
              {isComplete && downloadedCount > 0 && missingCount === 0 && (
                <Button onClick={() => onComplete(membersWithId as DirectoryMember[])} variant="outline" className={th.btnPause}>
                  <FileDown className="w-4 h-4 mr-1" /> Aggiorna tutti ({downloadedCount})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Speed control */}
        {isRunning && (
          <div className={`${th.panel} border ${th.panelSlate} rounded-xl p-4`}>
            <label className={`text-xs flex items-center gap-1.5 mb-2 ${th.label}`}>
              <Timer className="w-3.5 h-3.5" />
              Velocità Fase 1 (tra pagine): <span className={`font-mono font-bold ${th.hi}`}>{DELAY_LABELS[DELAY_VALUES[listingDelayIdx]]}</span>
            </label>
            <Slider value={[listingDelayIdx]} onValueChange={([v]) => setListingDelayIdx(v)} min={0} max={DELAY_VALUES.length - 1} step={1} className="w-full" />
            <div className={`flex justify-between text-xs mt-1 ${th.dim}`}>
              <span>Veloce</span>
              <span>Lento (sicuro)</span>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {totalPages !== null && totalPages > 0 && isRunning && (
          <div className={`w-full h-1.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
            <div className={`h-full rounded-full transition-all ${isDark ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${(currentPage / totalPages) * 100}%` }} />
          </div>
        )}

        {error && (
          <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
            ⚠️ {error}
          </div>
        )}

        {/* Cache info */}
        {!isRunning && !isComplete && cachedAt && (
          <div className={`px-3 py-2 rounded-lg border text-xs ${th.infoBox}`}>
            📋 Ultima scansione directory: {new Date(cachedAt).toLocaleString("it-IT")}
            {cachedTotalResults > 0 && ` • ${cachedTotalResults} risultati trovati`}
          </div>
        )}

        {/* Live member list */}
        <div className={`flex-1 ${th.panel} border ${th.panelSlate} rounded-2xl p-4 min-h-0 overflow-hidden flex flex-col`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs ${th.dim}`}>
              <List className="w-3 h-3 inline mr-1" />
              Partner ({totalCount})
              {downloadedCount > 0 && <span className={`ml-2 ${th.acEm}`}>• {downloadedCount} nel DB</span>}
              {missingCount > 0 && <span className={`ml-2 ${th.hi}`}>• {missingCount} mancanti</span>}
            </p>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-0.5 text-xs font-mono pr-4">
              {members.map((m, i) => (
                <div
                  key={`${m.wca_id || i}-${i}`}
                  onClick={() => setSelectedMember(m)}
                  className={`flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors ${th.hover} ${m.inDb ? "" : isDark ? "opacity-60" : "opacity-50"}`}
                >
                  <span className={`w-12 text-right ${th.logId}`}>{m.wca_id ? `#${m.wca_id}` : "—"}</span>
                  {m.inDb ? (
                    <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${th.acEm}`} />
                  ) : (
                    <Download className={`w-3.5 h-3.5 flex-shrink-0 ${th.dim}`} />
                  )}
                  <span className={`flex-1 truncate ${th.logName}`}>{m.company_name}</span>
                  <span className={`${th.dim}`}>{m.city || ""}</span>
                </div>
              ))}
              {members.length === 0 && (
                <p className={`text-center text-sm py-6 ${th.dim}`}>
                  Nessun partner trovato. Avvia la scansione per cercare nella directory WCA.
                </p>
              )}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right: summary */}
      <div className="w-64 flex flex-col gap-3 min-h-0">
        <div className={`${th.panel} border ${th.panelSlate} rounded-xl p-4 space-y-3`}>
          <p className={`text-xs font-medium ${th.label}`}>Riepilogo</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className={`text-xs font-medium ${th.acEm}`}>✓ Scaricati</span>
              <span className={`font-mono font-bold ${th.acEm}`}>{downloadedCount}</span>
            </div>
            <div className="flex justify-between">
              <span className={`text-xs font-medium ${th.hi}`}>↓ Mancanti</span>
              <span className={`font-mono font-bold ${th.hi}`}>{missingCount}</span>
            </div>
            <div className={`h-px ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
            <div className="flex justify-between">
              <span className={`text-xs ${th.body}`}>Totale</span>
              <span className={`font-mono font-bold ${th.mono}`}>{totalCount}</span>
            </div>
            <div className="flex justify-between">
              <span className={`text-xs ${th.body}`}>Con WCA ID</span>
              <span className={`font-mono ${th.mono}`}>{membersWithId.length}</span>
            </div>
            {isRunning && (
              <div className="flex justify-between">
                <span className={`text-xs ${th.body}`}>Pagine lette</span>
                <span className={`font-mono ${th.mono}`}>{currentPage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Per-country breakdown */}
        {countries.length > 0 && (
          <div className={`${th.panel} border ${th.panelSlate} rounded-xl p-4`}>
            <p className={`text-xs font-medium mb-2 ${th.label}`}>Paesi</p>
            <div className="space-y-1">
              {countries.map((c, i) => {
                const countForCountry = members.filter(m => m.country === c.name || m.country === c.code).length;
                const dlCount = members.filter(m => (m.country === c.name || m.country === c.code) && m.inDb).length;
                return (
                  <div key={c.code} className="flex items-center justify-between">
                    <span className={`text-xs ${th.body}`}>{getCountryFlag(c.code)} {c.name}</span>
                    <span className={`font-mono text-xs ${th.dim}`}>
                      <span className={th.acEm}>{dlCount}</span>/{countForCountry}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Selected partner detail */}
        {selectedMember && (
          <div className={`${th.panel} border ${th.panelAmber} rounded-xl p-4 space-y-2`}>
            <p className={`text-xs font-medium ${th.label}`}>Dettaglio</p>
            <p className={`text-sm font-medium ${th.h2}`}>{selectedMember.company_name}</p>
            {selectedMember.wca_id && <p className={`text-xs ${th.dim}`}>WCA ID: #{selectedMember.wca_id}</p>}
            {selectedMember.city && <p className={`text-xs ${th.body}`}><MapPin className="w-3 h-3 inline mr-1" />{selectedMember.city}</p>}
            {selectedMember.country && <p className={`text-xs ${th.body}`}>{selectedMember.country}</p>}
            {selectedMember.inDb && (
              <div className={`mt-2 p-2 rounded-lg ${isDark ? "bg-emerald-500/10" : "bg-emerald-50"}`}>
                <p className={`text-xs font-medium ${th.acEm}`}>✓ Nel database</p>
                {selectedMember.updatedAt && (
                  <p className={`text-xs ${th.dim}`}>Aggiornato: {new Date(selectedMember.updatedAt).toLocaleDateString("it-IT")}</p>
                )}
                {selectedMember.partnerType && (
                  <p className={`text-xs ${th.dim}`}>Tipo: {selectedMember.partnerType}</p>
                )}
                {selectedMember.rating && (
                  <p className={`text-xs ${th.dim}`}>Rating: {selectedMember.rating}/5</p>
                )}
              </div>
            )}
            {!selectedMember.inDb && (
              <div className={`mt-2 p-2 rounded-lg ${isDark ? "bg-amber-500/10" : "bg-amber-50"}`}>
                <p className={`text-xs ${th.hi}`}>↓ Non ancora scaricato</p>
              </div>
            )}
            <button onClick={() => setSelectedMember(null)} className={`text-xs mt-1 ${th.back}`}>Chiudi</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FASE 2 Config: Speed settings before downloading details
// ═══════════════════════════════════════════════════════════════
function Phase2Config({ countries, network, members, onStart }: {
  countries: { code: string; name: string }[];
  network: string;
  members: DirectoryMember[];
  onStart: () => void;
}) {
  const isDark = useTheme();
  const th = t(isDark);
  const createJob = useCreateDownloadJob();
  const [includeExisting, setIncludeExisting] = useState(false);

  const allIds = members.filter(m => m.wca_id).map(m => m.wca_id!);

  // Cross-reference with partners already in DB
  const { data: existingWcaIds = [], isLoading: checkingDb } = useQuery({
    queryKey: ["existing-wca-ids", allIds],
    queryFn: async () => {
      if (allIds.length === 0) return [];
      const { data } = await supabase
        .from("partners")
        .select("wca_id, updated_at")
        .in("wca_id", allIds);
      return (data || []).map(r => ({ wca_id: r.wca_id!, updated_at: r.updated_at }));
    },
    staleTime: 30_000,
  });

  const existingSet = new Set(existingWcaIds.map(e => e.wca_id));
  const missingIds = allIds.filter(id => !existingSet.has(id));
  const alreadyDownloaded = allIds.filter(id => existingSet.has(id));
  const idsToDownload = includeExisting ? allIds : missingIds;

  // Oldest update date for existing partners
  const oldestUpdate = existingWcaIds.length > 0
    ? existingWcaIds.reduce((min, e) => (!min || (e.updated_at && e.updated_at < min) ? e.updated_at : min), existingWcaIds[0].updated_at)
    : null;

  // Speed
  const [delayIndex, setDelayIndex] = useState(4);
  const delay = DELAY_VALUES[delayIndex];

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

  const handleStart = async () => {
    if (idsToDownload.length === 0) {
      toast({ title: "Nessun partner da scaricare", description: "Tutti i partner sono già nel database." });
      return;
    }
    for (const country of countries) {
      await createJob.mutateAsync({
        country_code: country.code,
        country_name: country.name,
        network_name: network || "Tutti",
        wca_ids: idsToDownload,
        delay_seconds: delay,
      });
    }
    onStart();
  };

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-8 max-w-lg w-full space-y-6`}>
        <div>
          <h2 className={`text-xl mb-1 ${th.h2}`}>Fase 2 — Download Dettagli</h2>
          <p className={`text-sm ${th.sub}`}>
            {countryLabel} • {network || "Tutti i network"}
          </p>
        </div>

        {checkingDb ? (
          <div className="flex items-center justify-center py-4 gap-2">
            <Loader2 className={`w-4 h-4 animate-spin ${th.sub}`} />
            <span className={`text-sm ${th.sub}`}>Verifico partner già scaricati...</span>
          </div>
        ) : (
          <>
            {/* Summary from Phase 1 with DB cross-reference */}
            <div className={`p-4 rounded-xl border space-y-2 ${th.infoBox}`}>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${th.body}`}>Partner dalla Fase 1</span>
                <span className={`font-mono font-bold ${th.hi}`}>{members.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${th.body}`}>Con WCA ID</span>
                <span className={`font-mono ${th.mono}`}>{allIds.length}</span>
              </div>
              <div className={`h-px ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
              <div className="flex items-center justify-between">
                <span className={`text-sm font-medium ${th.acEm}`}>✓ Già nel database</span>
                <span className={`font-mono font-bold ${th.acEm}`}>{alreadyDownloaded.length}</span>
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
            </div>

            {/* Option to re-download existing */}
            {alreadyDownloaded.length > 0 && (
              <label className={`flex items-center gap-2 text-sm cursor-pointer ${th.body}`}>
                <Checkbox checked={includeExisting} onCheckedChange={v => setIncludeExisting(!!v)} />
                Aggiorna anche i {alreadyDownloaded.length} già presenti nel DB
              </label>
            )}

            {/* Info: background processing */}
            {idsToDownload.length > 0 && (
              <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                🚀 Il download proseguirà in background anche se navighi altrove.
              </div>
            )}

            {idsToDownload.length === 0 && (
              <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"}`}>
                ✅ Tutti i partner sono già nel database! Spunta la casella sopra per aggiornare i profili esistenti.
              </div>
            )}

            {/* Speed */}
            {idsToDownload.length > 0 && (
              <div>
                <label className={`text-xs flex items-center gap-1.5 mb-3 ${th.label}`}>
                  <Timer className="w-3.5 h-3.5" />
                  Velocità Fase 2: <span className={`font-mono font-bold ${th.hi}`}>{DELAY_LABELS[delay]}</span>
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

            <Button onClick={handleStart} disabled={idsToDownload.length === 0 || createJob.isPending} className={`w-full ${th.btnPri}`}>
              {createJob.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              {idsToDownload.length > 0
                ? `Avvia Download in Background (${idsToDownload.length})`
                : "Tutti già scaricati ✓"
              }
            </Button>
          </>
        )}
      </div>
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

  const progress = job.total_count > 0 ? (job.current_index / job.total_count) * 100 : 0;
  const isActive = job.status === "running" || job.status === "pending";
  const isPaused = job.status === "paused";

  const statusLabel: Record<string, string> = {
    pending: "In attesa",
    running: "In corso",
    paused: "In pausa",
    completed: "Completato",
    cancelled: "Cancellato",
    error: "Errore",
  };

  const statusColor = isDark
    ? { running: "text-amber-400", paused: "text-yellow-400", completed: "text-emerald-400", cancelled: "text-slate-500", error: "text-red-400", pending: "text-blue-400" }
    : { running: "text-sky-600", paused: "text-yellow-600", completed: "text-emerald-600", cancelled: "text-slate-400", error: "text-red-600", pending: "text-blue-600" };

  const handleSpeedChange = (delayIdx: number) => {
    updateSpeed.mutate({ jobId: job.id, delay_seconds: DELAY_VALUES[delayIdx] });
  };

  const currentDelayIdx = DELAY_VALUES.findIndex(v => v >= job.delay_seconds);
  const delayIdx = currentDelayIdx >= 0 ? currentDelayIdx : 4;

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
        const netSec = Math.max(avgSec - job.delay_seconds, 0);
        const remainingSec = avgSec * (job.total_count - job.current_index);
        const perMin = (job.current_index / elapsedSec) * 60;

        const fmtTime = (s: number) => {
          if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}min`;
          if (s >= 60) return `${Math.floor(s / 60)}min ${Math.floor(s % 60)}s`;
          return `${Math.floor(s)}s`;
        };

        return (
          <div className={`grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs p-3 rounded-lg border ${th.infoBox}`}>
            <div className={`flex items-center gap-1.5 ${th.body}`}>
              <Timer className="w-3 h-3 flex-shrink-0" />
              <span>Media: <span className={`font-mono font-bold ${th.hi}`}>{avgSec.toFixed(1)}s</span>/profilo</span>
            </div>
            <div className={`flex items-center gap-1.5 ${th.body}`}>
              <Zap className="w-3 h-3 flex-shrink-0" />
              <span>Scraping netto: <span className={`font-mono font-bold ${th.hi}`}>{netSec.toFixed(1)}s</span></span>
            </div>
            <div className={`flex items-center gap-1.5 ${th.body}`}>
              <Activity className="w-3 h-3 flex-shrink-0" />
              <span>Velocità: <span className={`font-mono font-bold ${th.hi}`}>{perMin.toFixed(1)}</span>/min</span>
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
        <p className={`text-xs ${th.dim}`}>
          Ultimo: <span className={th.logName}>{job.last_processed_company}</span>
          <span className={`ml-2 ${th.logId}`}>#{job.last_processed_wca_id}</span>
        </p>
      )}

      {/* Speed control */}
      {showSpeed && (isActive || isPaused) && (
        <div className={`p-3 rounded-lg border ${th.infoBox}`}>
          <label className={`text-xs flex items-center gap-1.5 mb-2 ${th.label}`}>
            <Timer className="w-3 h-3" />
            Delay: <span className={`font-mono font-bold ${th.hi}`}>{DELAY_LABELS[DELAY_VALUES[delayIdx]]}</span>
          </label>
          <Slider value={[delayIdx]} onValueChange={([v]) => handleSpeedChange(v)} min={0} max={DELAY_VALUES.length - 1} step={1} className="w-full" />
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
function StatBadge({ label, value, color, icon }: { label: string; value: number | string; color: string; icon?: React.ReactNode }) {
  const isDark = useTheme();
  const cc: Record<string, Record<string, string>> = {
    dark: { amber: "bg-amber-500/10 border-amber-500/30 text-amber-400", emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400", blue: "bg-blue-500/10 border-blue-500/30 text-blue-400", red: "bg-red-500/10 border-red-500/30 text-red-400", slate: "bg-slate-500/10 border-slate-500/30 text-slate-400" },
    light: { amber: "bg-sky-50 border-sky-200 text-sky-700", emerald: "bg-emerald-50 border-emerald-200 text-emerald-700", blue: "bg-blue-50 border-blue-200 text-blue-700", red: "bg-red-50 border-red-200 text-red-700", slate: "bg-slate-100 border-slate-200 text-slate-600" },
  };
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border ${cc[isDark ? "dark" : "light"][color] || cc[isDark ? "dark" : "light"].slate}`}>
      {icon}<span className="font-mono text-sm">{value}</span><span className="text-xs opacity-60">{label}</span>
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
