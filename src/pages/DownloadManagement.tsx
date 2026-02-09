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
  Search, Users, MapPin, Settings2, List, FileDown
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
    if (step === "running") { setStep("configure"); }
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
            {step === "choose" && <StepChoose onSelect={a => { setAction(a); setStep("configure"); }} />}
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
function StepChoose({ onSelect }: { onSelect: (a: ActionType) => void }) {
  const isDark = useTheme();
  const th = t(isDark);
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
  const [showOnlyMissing, setShowOnlyMissing] = useState(false);

  const { data: exploredCodes = [] } = useQuery({
    queryKey: ["explored-countries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("partners")
        .select("country_code")
        .not("country_code", "is", null);
      const unique = new Set((data || []).map(r => r.country_code));
      return Array.from(unique);
    },
    staleTime: 60_000,
  });

  const selectedCodes = new Set(selected.map(c => c.code));
  const exploredSet = new Set(exploredCodes);

  const filtered = WCA_COUNTRIES.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (showOnlyMissing) return !exploredSet.has(c.code);
    return true;
  });

  const missingCount = WCA_COUNTRIES.filter(c => !exploredSet.has(c.code)).length;

  return (
    <div className="flex-1 flex flex-col items-center gap-4 min-h-0">
      <div className="text-center">
        <h2 className={`text-xl mb-1 ${th.h2}`}>Quali paesi vuoi esplorare?</h2>
        <p className={`text-sm ${th.sub}`}>Seleziona uno o più paesi — poi prosegui</p>
      </div>

      {selected.length > 0 && (
        <div className="w-full max-w-xl">
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

      <div className="w-full max-w-xl flex gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
          <Input placeholder="Cerca paese..." value={search} onChange={e => onSearchChange(e.target.value)} className={`pl-10 ${th.input}`} />
        </div>
        <button
          onClick={() => setShowOnlyMissing(!showOnlyMissing)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all whitespace-nowrap ${
            showOnlyMissing
              ? isDark ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-sky-100 border-sky-300 text-sky-700"
              : th.optCard
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Mai esplorati ({missingCount})
        </button>
      </div>

      <ScrollArea className="flex-1 w-full max-w-xl">
        <div className="grid grid-cols-2 gap-2 pr-4">
          {filtered.map(c => {
            const isSelected = selectedCodes.has(c.code);
            const isExplored = exploredSet.has(c.code);
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
                {/* Elegant gradient overlay for explored countries */}
                {isExplored && !isSelected && (
                  <div className={`absolute inset-0 pointer-events-none ${
                    isDark
                      ? "bg-gradient-to-l from-emerald-500/12 via-emerald-500/5 to-transparent"
                      : "bg-gradient-to-l from-emerald-100/80 via-emerald-50/40 to-transparent"
                  }`} />
                )}
                <span className="relative text-lg">{getCountryFlag(c.code)}</span>
                <div className="relative min-w-0 flex-1">
                  <p className="text-sm truncate">{c.name}</p>
                  <p className={`text-xs ${th.dim}`}>{c.code}</p>
                </div>
                {isSelected && <CheckCircle className={`relative w-4 h-4 flex-shrink-0 ${isDark ? "text-amber-400" : "text-sky-500"}`} />}
                {!isSelected && isExplored && (
                  <span className={`relative text-[10px] px-1.5 py-0.5 rounded ${isDark ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 text-emerald-600 border border-emerald-200"}`}>DB</span>
                )}
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {selected.length > 0 && (
        <div className="w-full max-w-xl">
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
// ═══════════════════════════════════════════════════════════════
function DirectoryScanner({ countries, network, onComplete }: {
  countries: { code: string; name: string }[];
  network: string;
  onComplete: (members: DirectoryMember[]) => void;
}) {
  const isDark = useTheme();
  const th = t(isDark);

  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState<number | null>(null);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [currentCountryIdx, setCurrentCountryIdx] = useState(0);
  const [pageTime, setPageTime] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  // Speed control for listing phase
  const [listingDelayIdx, setListingDelayIdx] = useState(3); // default 3s
  const listingDelayRef = useRef(DELAY_VALUES[3] * 1000);
  useEffect(() => { listingDelayRef.current = DELAY_VALUES[listingDelayIdx] * 1000; }, [listingDelayIdx]);

  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const waitWhilePaused = useCallback(async () => {
    while (pauseRef.current && !abortRef.current) await new Promise(r => setTimeout(r, 300));
  }, []);

  const handleStart = useCallback(async () => {
    setIsRunning(true);
    setError(null);
    abortRef.current = false;
    const allMembers: DirectoryMember[] = [];

    for (let ci = 0; ci < countries.length; ci++) {
      if (abortRef.current) break;
      setCurrentCountryIdx(ci);
      const country = countries[ci];
      let page = 1;
      let hasNext = true;

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
            allMembers.push(...newMembers);
            setMembers([...allMembers]);
          }

          setTotalResults(result.pagination.total_results);
          setTotalPages(result.pagination.total_pages);
          hasNext = result.pagination.has_next_page;
          page++;
        } catch (err) {
          setError(err instanceof Error ? err.message : "Errore di rete");
          break;
        }

        // Wait between pages
        if (hasNext && !abortRef.current) {
          await new Promise(r => setTimeout(r, listingDelayRef.current));
        }
      }
    }

    setIsRunning(false);
    setIsComplete(true);
  }, [countries, network, waitWhilePaused]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [members.length]);

  const countryLabel = countries.length === 1
    ? `${getCountryFlag(countries[0].code)} ${countries[0].name}`
    : `${countries.length} paesi`;

  const membersWithId = members.filter(m => m.wca_id);

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
                  FASE 1 — {isComplete ? "COMPLETATA" : isRunning ? "SCANSIONE LISTA" : "PRONTO"}
                  {` • ${countryLabel}`}
                  {network && ` • ${network}`}
                </p>
                {isRunning && (
                  <p className={`text-2xl font-mono ${th.mono}`}>
                    Pagina {currentPage}
                    {totalPages !== null && <span className={`text-sm ml-1 ${th.dim}`}>/{totalPages}</span>}
                    <span className={`text-sm ml-3 ${th.dim}`}>Trovati: {members.length}</span>
                  </p>
                )}
                {isComplete && (
                  <p className={`text-2xl font-mono ${th.mono}`}>
                    {members.length} partner trovati
                    <span className={`text-sm ml-3 ${th.dim}`}>({membersWithId.length} con WCA ID)</span>
                  </p>
                )}
              </div>
              {pageTime !== null && isRunning && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${th.cdBg}`}>
                  <Zap className={`w-3.5 h-3.5 ${th.cdIcon}`} />
                  <span className={`font-mono text-xs ${th.cdText}`}>{(pageTime / 1000).toFixed(1)}s/pagina</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {!isRunning && !isComplete && (
                <Button onClick={handleStart} className={th.btnPri}>
                  <Play className="w-4 h-4 mr-1" /> Avvia Scansione Lista
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
              {isComplete && membersWithId.length > 0 && (
                <Button onClick={() => onComplete(membersWithId)} className={th.btnPri}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Scarica Dettagli ({membersWithId.length})
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Speed control for listing */}
        {(isRunning || (!isRunning && !isComplete)) && (
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
        {totalPages !== null && totalPages > 0 && (
          <div className={`w-full h-1.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
            <div className={`h-full rounded-full transition-all ${isDark ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${(currentPage / totalPages) * 100}%` }} />
          </div>
        )}

        {error && (
          <div className={`p-3 rounded-lg border text-sm ${isDark ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-red-50 border-red-200 text-red-600"}`}>
            ⚠️ {error}
          </div>
        )}

        {/* Live member list */}
        <div className={`flex-1 ${th.panel} border ${th.panelSlate} rounded-2xl p-4 min-h-0 overflow-hidden flex flex-col`}>
          <div className="flex items-center justify-between mb-2">
            <p className={`text-xs ${th.dim}`}>
              <List className="w-3 h-3 inline mr-1" />
              Partner trovati ({members.length})
            </p>
            {totalResults !== null && (
              <p className={`text-xs ${th.dim}`}>Totale directory: {totalResults}</p>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 text-xs font-mono pr-4">
              {members.map((m, i) => (
                <div key={`${m.wca_id || i}-${i}`} className={`flex items-center gap-2 py-1 px-2 rounded animate-fade-in ${th.hover}`}>
                  <span className={`w-12 text-right ${th.logId}`}>{m.wca_id ? `#${m.wca_id}` : "—"}</span>
                  <span className="text-sm">{m.country ? getCountryFlag(m.country) : "🌍"}</span>
                  <span className={`flex-1 truncate ${th.logName}`}>{m.company_name}</span>
                  <span className={`${th.dim}`}>{m.city || ""}</span>
                </div>
              ))}
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
              <span className={`text-xs ${th.body}`}>Partner trovati</span>
              <span className={`font-mono font-bold ${th.hi}`}>{members.length}</span>
            </div>
            <div className="flex justify-between">
              <span className={`text-xs ${th.body}`}>Con WCA ID</span>
              <span className={`font-mono ${th.acEm}`}>{membersWithId.length}</span>
            </div>
            <div className="flex justify-between">
              <span className={`text-xs ${th.body}`}>Pagine lette</span>
              <span className={`font-mono ${th.mono}`}>{currentPage}</span>
            </div>
            {countries.length > 1 && (
              <div className="flex justify-between">
                <span className={`text-xs ${th.body}`}>Paese corrente</span>
                <span className={`text-xs ${th.mono}`}>{countries[currentCountryIdx]?.name || "—"}</span>
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
                return (
                  <div key={c.code} className="flex items-center justify-between">
                    <span className={`text-xs ${th.body}`}>{getCountryFlag(c.code)} {c.name}</span>
                    <span className={`font-mono text-xs ${i < currentCountryIdx ? th.acEm : i === currentCountryIdx && isRunning ? th.hi : th.dim}`}>
                      {countForCountry}
                    </span>
                  </div>
                );
              })}
            </div>
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
  const [delayIndex, setDelayIndex] = useState(4);
  const [pauseEvery, setPauseEvery] = useState("10");
  const [pauseDurationIndex, setPauseDurationIndex] = useState(1);
  const [nightPauseEnabled, setNightPauseEnabled] = useState(false);
  const [nightPauseMinutes, setNightPauseMinutes] = useState("60");

  const delay = DELAY_VALUES[delayIndex];
  const pauseDur = PAUSE_DURATION_VALUES[pauseDurationIndex];
  const pauseEveryN = parseInt(pauseEvery, 10) || 0;
  const totalIds = members.length;

  const ids = members.filter(m => m.wca_id).map(m => m.wca_id!);

  const estimateSeconds = (() => {
    const avgDownloadTime = 3;
    let total = totalIds * (delay + avgDownloadTime);
    if (pauseEveryN > 0) total += Math.floor(totalIds / pauseEveryN) * pauseDur;
    return total;
  })();

  const estimateLabel = estimateSeconds >= 3600
    ? `~${(estimateSeconds / 3600).toFixed(1)} ore`
    : estimateSeconds >= 60
    ? `~${Math.ceil(estimateSeconds / 60)} minuti`
    : `~${estimateSeconds} secondi`;

  const countryLabel = countries.length === 1
    ? `${getCountryFlag(countries[0].code)} ${countries[0].name}`
    : `${countries.length} paesi`;

  const handleStart = () => {
    sessionStorage.setItem("dl_config", JSON.stringify({
      mode: "ids",
      ids,
      delay: delay * 1000,
      pauseEvery: pauseEveryN,
      pauseDuration: pauseDur * 1000,
      nightPauseEnabled,
      nightPauseMs: parseInt(nightPauseMinutes, 10) * 60 * 1000,
      filterNetwork: network,
      filterCountries: countries.map(c => c.code),
      filterCountryNames: countries.map(c => c.name),
    }));
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

        {/* Summary from Phase 1 */}
        <div className={`p-4 rounded-xl border space-y-2 ${th.infoBox}`}>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${th.body}`}>Partner dalla Fase 1</span>
            <span className={`font-mono font-bold ${th.hi}`}>{totalIds}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={`text-sm ${th.body}`}>Con WCA ID (scaricabili)</span>
            <span className={`font-mono font-bold ${th.acEm}`}>{ids.length}</span>
          </div>
        </div>

        {/* Speed */}
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

        {/* Pause every N */}
        <div>
          <label className={`text-xs flex items-center gap-1.5 mb-2 ${th.label}`}>
            <Pause className="w-3.5 h-3.5" />
            Pausa extra ogni N download
          </label>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className={`text-xs mb-1 ${th.dim}`}>Ogni quanti</p>
              <Input type="number" value={pauseEvery} onChange={e => setPauseEvery(e.target.value)} className={th.input} placeholder="10" min={0} />
            </div>
            <div className="flex-1">
              <p className={`text-xs mb-1 ${th.dim}`}>Durata: <span className={`font-mono ${th.hi}`}>{formatDuration(pauseDur)}</span></p>
              <Slider value={[pauseDurationIndex]} onValueChange={([v]) => setPauseDurationIndex(v)} min={0} max={PAUSE_DURATION_VALUES.length - 1} step={1} className="w-full mt-2" />
            </div>
          </div>
        </div>

        {/* Night pause */}
        <div className={`p-4 rounded-xl border ${nightPauseEnabled ? (isDark ? "border-amber-500/30 bg-amber-500/5" : "border-sky-300 bg-sky-50") : th.panelSlate}`}>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={nightPauseEnabled} onCheckedChange={v => setNightPauseEnabled(!!v)} />
            <div>
              <p className={`text-sm ${th.body}`}>Pausa prolungata (notturna)</p>
              <p className={`text-xs ${th.dim}`}>Pausa automatica dopo ciclo completato</p>
            </div>
          </label>
          {nightPauseEnabled && (
            <div className="mt-3 flex items-center gap-2">
              <p className={`text-xs ${th.label}`}>Durata:</p>
              <Input type="number" value={nightPauseMinutes} onChange={e => setNightPauseMinutes(e.target.value)} className={`w-20 ${th.input}`} min={1} />
              <span className={`text-xs ${th.dim}`}>minuti</span>
            </div>
          )}
        </div>

        {/* Time estimate */}
        <div className={`p-3 rounded-lg border text-center ${th.infoBox}`}>
          <p className={`text-xs ${th.dim}`}>Tempo stimato</p>
          <p className={`text-lg font-mono ${th.hi}`}>{estimateLabel}</p>
        </div>

        <Button onClick={handleStart} disabled={ids.length === 0} className={`w-full ${th.btnPri}`}>
          <Zap className="w-4 h-4 mr-2" />
          Avvia Download Dettagli ({ids.length})
        </Button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DOWNLOAD RUNNING (Phase 2: download details by specific IDs)
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
  const [currentIdx, setCurrentIdx] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [startTime] = useState(Date.now());
  const [lastDownloadMs, setLastDownloadMs] = useState<number | null>(null);
  const [avgDownloadMs, setAvgDownloadMs] = useState(0);
  const [detailPartner, setDetailPartner] = useState<ScrapeLog | null>(null);
  const [jsonOpen, setJsonOpen] = useState(false);
  const [showSpeedPanel, setShowSpeedPanel] = useState(false);

  // Live-adjustable speed via refs
  const delayRef = useRef(config.delay || 5000);
  const pauseEveryRef = useRef(config.pauseEvery || 0);
  const pauseDurationRef = useRef(config.pauseDuration || 30000);
  const [liveDelay, setLiveDelay] = useState(() => {
    const ms = config.delay || 5000;
    const idx = DELAY_VALUES.findIndex(v => v * 1000 >= ms);
    return idx >= 0 ? idx : 4;
  });
  const [livePauseEvery, setLivePauseEvery] = useState(String(config.pauseEvery || 10));
  const [livePauseDurIdx, setLivePauseDurIdx] = useState(() => {
    const s = (config.pauseDuration || 30000) / 1000;
    const idx = PAUSE_DURATION_VALUES.findIndex(v => v >= s);
    return idx >= 0 ? idx : 1;
  });

  useEffect(() => { delayRef.current = DELAY_VALUES[liveDelay] * 1000; }, [liveDelay]);
  useEffect(() => { pauseEveryRef.current = parseInt(livePauseEvery, 10) || 0; }, [livePauseEvery]);
  useEffect(() => { pauseDurationRef.current = PAUSE_DURATION_VALUES[livePauseDurIdx] * 1000; }, [livePauseDurIdx]);

  const abortRef = useRef(false);
  const pauseRef = useRef(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const downloadTimesRef = useRef<number[]>([]);

  const totalIds = config.ids?.length || 0;
  const [countryMatches, setCountryMatches] = useState(0);
  const elapsed = (Date.now() - startTime) / 1000 / 60;
  const speed = elapsed > 0.01 ? (stats.found / elapsed).toFixed(1) : "—";
  const successLogs = logs.filter(l => l.status === "success");

  // Prolonged pause
  const [prolongedPause, setProlongedPause] = useState(false);
  const [prolongedCountdown, setProlongedCountdown] = useState(0);
  const prolongedIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleProlongedPause = useCallback((minutes: number) => {
    pauseRef.current = true;
    setIsPaused(true);
    setProlongedPause(true);
    let remaining = minutes * 60;
    setProlongedCountdown(remaining);
    if (prolongedIntervalRef.current) clearInterval(prolongedIntervalRef.current);
    prolongedIntervalRef.current = setInterval(() => {
      remaining--;
      setProlongedCountdown(remaining);
      if (remaining <= 0) {
        if (prolongedIntervalRef.current) clearInterval(prolongedIntervalRef.current);
        setProlongedPause(false);
        pauseRef.current = false;
        setIsPaused(false);
        setProlongedCountdown(0);
      }
    }, 1000);
  }, []);

  const sleep = useCallback((ms: number) =>
    new Promise<void>((resolve) => {
      if (ms <= 0) { resolve(); return; }
      let remaining = Math.ceil(ms / 1000);
      setCountdown(remaining);
      const interval = setInterval(() => { remaining--; setCountdown(remaining); if (remaining <= 0) { clearInterval(interval); resolve(); } }, 1000);
    }), []);

  const waitWhilePaused = useCallback(async () => {
    while (pauseRef.current && !abortRef.current) await new Promise(r => setTimeout(r, 300));
  }, []);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const ids: number[] = config.ids || [];
      let localStats = { found: 0, inserted: 0, updated: 0, notFound: 0, errors: 0 };
      let localCountryMatches = 0;

      for (let i = 0; i < ids.length; i++) {
        if (abortRef.current || !mounted) break;
        await waitWhilePaused();
        if (abortRef.current) break;

        const id = ids[i];
        setCurrentId(id);
        setCurrentIdx(i + 1);

        const dlStart = Date.now();
        try {
          const result = await scrapeWcaPartnerById(id);
          const dlTime = Date.now() - dlStart;
          downloadTimesRef.current.push(dlTime);
          if (mounted) {
            setLastDownloadMs(dlTime);
            setAvgDownloadMs(Math.round(downloadTimesRef.current.reduce((a, b) => a + b, 0) / downloadTimesRef.current.length));
          }

          const log: ScrapeLog = { wcaId: id, status: "error" };

          if (result.success && result.found) {
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
            if (config.filterCountries?.length && result.partner?.country_code && config.filterCountries.includes(result.partner.country_code.toUpperCase())) {
              localCountryMatches++;
              if (mounted) setCountryMatches(localCountryMatches);
            }
          } else if (result.success && !result.found) {
            log.status = "not_found";
            localStats.notFound++;
          } else {
            log.status = "error";
            log.error = result.error;
            localStats.errors++;
          }

          if (mounted) {
            setLogs(prev => [...prev, log].slice(-500));
            setStats({ ...localStats });
          }
        } catch (err) {
          const dlTime = Date.now() - dlStart;
          downloadTimesRef.current.push(dlTime);
          if (mounted) {
            setLastDownloadMs(dlTime);
            setLogs(prev => [...prev, { wcaId: id, status: "error" as const, error: String(err) }].slice(-500));
            localStats.errors++;
            setStats({ ...localStats });
          }
        }

        if (!abortRef.current && mounted && i < ids.length - 1) {
          const pe = pauseEveryRef.current;
          if (pe > 0 && (i + 1) % pe === 0) {
            if (config.nightPauseEnabled && (i + 1) % (pe * 5) === 0) {
              handleProlongedPause(config.nightPauseMs / 60000);
              await waitWhilePaused();
            } else {
              await sleep(pauseDurationRef.current);
            }
          } else {
            await sleep(delayRef.current);
          }
        }
      }

      if (mounted) {
        setIsRunning(false);
        setCurrentId(null);
        setCountdown(0);
        queryClient.invalidateQueries({ queryKey: ["partners"] });
        toast({
          title: abortRef.current ? "Download fermato" : "Download completato",
          description: `Trovati: ${localStats.found}, Nuovi: ${localStats.inserted}, Aggiornati: ${localStats.updated}`,
        });
      }
    };
    run();
    return () => { mounted = false; abortRef.current = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs.length]);

  const formatMs = (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

  return (
    <div className="flex-1 flex gap-6 min-h-0">
      <div className="flex-1 flex flex-col gap-4 min-h-0">
        {/* Header */}
        <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-6`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              {isRunning && !isPaused && <div className={`w-3 h-3 rounded-full animate-pulse ${th.pulse}`} />}
              {isPaused && <Pause className={`w-4 h-4 ${th.acAmber}`} />}
              <div>
                <p className={`text-xs ${th.sub}`}>
                  FASE 2 — {prolongedPause ? "PAUSA PROLUNGATA" : isPaused ? "IN PAUSA" : isRunning ? "SCARICANDO DETTAGLI" : "COMPLETATO"}
                  {config.filterCountryNames?.length > 0 && ` • ${config.filterCountryNames.length === 1 ? config.filterCountryNames[0] : config.filterCountryNames.length + " paesi"}`}
                  {config.filterNetwork && ` • ${config.filterNetwork}`}
                </p>
                <p className={`text-2xl font-mono ${th.mono}`}>
                  {currentId ? `ID #${currentId}` : "—"}
                  <span className={`text-sm ml-3 ${th.dim}`}>{currentIdx}/{totalIds}</span>
                </p>
              </div>
              {prolongedPause && prolongedCountdown > 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${isDark ? "bg-amber-500/10 border-amber-500/30" : "bg-sky-50 border-sky-200"}`}>
                  <Timer className={`w-3.5 h-3.5 ${th.acAmber}`} />
                  <span className={`font-mono text-sm ${th.acAmber}`}>{formatDuration(prolongedCountdown)}</span>
                </div>
              )}
              {!prolongedPause && countdown > 0 && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${th.cdBg}`}>
                  <Timer className={`w-3.5 h-3.5 ${th.cdIcon}`} />
                  <span className={`font-mono text-sm ${th.cdText}`}>{countdown}s</span>
                </div>
              )}
              {lastDownloadMs !== null && (
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${th.cdBg}`}>
                  <Zap className={`w-3.5 h-3.5 ${th.cdIcon}`} />
                  <span className={`font-mono text-xs ${th.cdText}`}>{formatMs(lastDownloadMs)}</span>
                  <span className={`text-xs ${th.dim}`}>media {formatMs(avgDownloadMs)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-wrap">
              {isRunning && (
                <Button size="sm" variant="outline" onClick={() => setShowSpeedPanel(!showSpeedPanel)} className={th.btnPause}>
                  <Settings2 className="w-4 h-4 mr-1" /> Velocità
                </Button>
              )}
              {isRunning && !isPaused && (
                <Button size="sm" variant="outline" onClick={() => { pauseRef.current = true; setIsPaused(true); }} className={th.btnPause}>
                  <Pause className="w-4 h-4 mr-1" /> Pausa
                </Button>
              )}
              {isPaused && !prolongedPause && (
                <Button size="sm" onClick={() => { pauseRef.current = false; setIsPaused(false); }} className={th.btnResume}>
                  <Play className="w-4 h-4 mr-1" /> Riprendi
                </Button>
              )}
              {prolongedPause && (
                <Button size="sm" onClick={() => { if (prolongedIntervalRef.current) clearInterval(prolongedIntervalRef.current); setProlongedPause(false); setProlongedCountdown(0); pauseRef.current = false; setIsPaused(false); }} className={th.btnResume}>
                  <Play className="w-4 h-4 mr-1" /> Interrompi pausa
                </Button>
              )}
              {isRunning && !isPaused && (
                <>
                  <Button size="sm" variant="outline" onClick={() => handleProlongedPause(30)} className={th.btnPause}>
                    <Timer className="w-4 h-4 mr-1" /> 30min
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleProlongedPause(60)} className={th.btnPause}>
                    <Timer className="w-4 h-4 mr-1" /> 1h
                  </Button>
                </>
              )}
              {isRunning && (
                <Button size="sm" variant="outline" onClick={() => { abortRef.current = true; setIsRunning(false); }} className={th.btnStop}>
                  <Square className="w-4 h-4 mr-1" /> Stop
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Live speed adjustment panel */}
        {showSpeedPanel && (
          <div className={`${th.panel} border ${th.panelAmber} rounded-xl p-4 space-y-3`}>
            <p className={`text-xs font-medium ${th.label}`}>⚡ Calibrazione velocità Fase 2</p>
            <div>
              <label className={`text-xs flex items-center gap-1 mb-2 ${th.dim}`}>
                Attesa tra download: <span className={`font-mono ${th.hi}`}>{DELAY_LABELS[DELAY_VALUES[liveDelay]]}</span>
              </label>
              <Slider value={[liveDelay]} onValueChange={([v]) => setLiveDelay(v)} min={0} max={DELAY_VALUES.length - 1} step={1} className="w-full" />
              <div className={`flex justify-between text-xs mt-1 ${th.dim}`}><span>Veloce</span><span>Lento</span></div>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className={`text-xs ${th.dim}`}>Pausa ogni</label>
                <Input type="number" value={livePauseEvery} onChange={e => setLivePauseEvery(e.target.value)} className={`${th.input} h-8 text-sm`} min={0} />
              </div>
              <div className="flex-1">
                <label className={`text-xs ${th.dim}`}>Durata: {formatDuration(PAUSE_DURATION_VALUES[livePauseDurIdx])}</label>
                <Slider value={[livePauseDurIdx]} onValueChange={([v]) => setLivePauseDurIdx(v)} min={0} max={PAUSE_DURATION_VALUES.length - 1} step={1} className="w-full mt-2" />
              </div>
            </div>
          </div>
        )}

        {/* Progress bar */}
        {totalIds > 0 && (
          <div className={`w-full h-1.5 rounded-full ${isDark ? "bg-slate-800" : "bg-slate-200"}`}>
            <div className={`h-full rounded-full transition-all ${isDark ? "bg-amber-500" : "bg-sky-500"}`} style={{ width: `${(currentIdx / totalIds) * 100}%` }} />
          </div>
        )}

        {/* Stats */}
        <div className="flex flex-wrap gap-3">
          <StatBadge label="Trovati" value={stats.found} color="amber" />
          {config.filterCountries?.length > 0 && (
            <StatBadge label={config.filterCountries.length === 1 ? (config.filterCountryNames?.[0] || config.filterCountries[0]) : `${config.filterCountries.length} paesi`} value={countryMatches} color="emerald" icon={<MapPin className="w-3 h-3" />} />
          )}
          <StatBadge label="Nuovi" value={stats.inserted} color="emerald" />
          <StatBadge label="Aggiornati" value={stats.updated} color="blue" />
          <StatBadge label="Vuoti" value={stats.notFound} color="slate" />
          <StatBadge label="Errori" value={stats.errors} color="red" />
          <StatBadge label="Partner/min" value={speed} color="slate" icon={<Zap className="w-3 h-3" />} />
        </div>

        {/* Log */}
        <div className={`flex-1 ${th.panel} border ${th.panelSlate} rounded-2xl p-4 min-h-0 overflow-hidden flex flex-col`}>
          <p className={`text-xs mb-2 ${th.dim}`}>Log attività — Fase 2</p>
          <ScrollArea className="flex-1">
            <div className="space-y-1 text-xs font-mono pr-4">
              {logs.map((log, i) => (
                <div key={`${log.wcaId}-${i}`} className="flex items-center gap-2 py-0.5 animate-fade-in">
                  <span className={`w-16 text-right ${th.logId}`}>#{log.wcaId}</span>
                  {log.status === "success" && log.action === "inserted" && <span className={th.logNew}>● NUOVO</span>}
                  {log.status === "success" && log.action === "updated" && <span className={th.logUpd}>● AGG.</span>}
                  {log.status === "not_found" && <span className={th.logEmpty}>○ vuoto</span>}
                  {log.status === "error" && <span className={th.logErr}>✕ errore</span>}
                  {log.companyName && <span className={`truncate ${th.logName}`}>{log.companyName}</span>}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-72 flex flex-col min-h-0">
        <p className={`text-xs mb-2 ${th.dim}`}>Partner scaricati ({successLogs.length})</p>
        <ScrollArea className="flex-1">
          <div className="space-y-1.5 pr-2">
            {successLogs.map((log, i) => (
              <button key={`${log.wcaId}-${i}`} onClick={() => setDetailPartner(log)} className={`w-full flex items-center gap-2 border rounded-lg px-3 py-2 text-left transition-all animate-fade-in ${th.chipBg}`}>
                <span className="text-sm">{log.countryCode ? getCountryFlag(log.countryCode) : "🌍"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${th.chipName}`}>{log.companyName}</p>
                  <p className={`text-xs ${th.chipSub}`}>{log.city}</p>
                </div>
                <Badge className={`text-[10px] px-1.5 py-0 ${log.action === "inserted" ? th.bdgNew : th.bdgUpd}`}>
                  {log.action === "inserted" ? "Nuovo" : "Agg."}
                </Badge>
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!detailPartner} onOpenChange={() => setDetailPartner(null)}>
        <DialogContent className={`max-w-lg max-h-[80vh] overflow-y-auto ${th.dlgBg}`}>
          <DialogHeader>
            <DialogTitle className={`flex items-center gap-2 ${th.dlgTitle}`}>
              <Building2 className={`w-5 h-5 ${th.acAmber}`} />
              {detailPartner?.companyName}
            </DialogTitle>
            <DialogDescription className={th.dlgSub}>WCA ID #{detailPartner?.wcaId}</DialogDescription>
          </DialogHeader>
          {detailPartner?.partner && (
            <div className="space-y-3 text-sm">
              <div className={`grid grid-cols-2 gap-2 ${th.dlgVal}`}>
                <div><span className={th.dlgField}>Paese:</span> {detailPartner.partner.country_name}</div>
                <div><span className={th.dlgField}>Città:</span> {detailPartner.partner.city}</div>
                {detailPartner.partner.email && <div><span className={th.dlgField}>Email:</span> {detailPartner.partner.email}</div>}
                {detailPartner.partner.phone && <div><span className={th.dlgField}>Tel:</span> {detailPartner.partner.phone}</div>}
                {detailPartner.partner.website && <div className="col-span-2"><span className={th.dlgField}>Sito:</span> {detailPartner.partner.website}</div>}
              </div>
              {detailPartner.partner.networks && detailPartner.partner.networks.length > 0 && (
                <div>
                  <p className={`text-xs mb-1 ${th.dlgField}`}>Network</p>
                  <div className="flex flex-wrap gap-1">
                    {detailPartner.partner.networks.map((n, i) => <Badge key={i} className={`text-xs ${th.bdgNet}`}>{n.name}</Badge>)}
                  </div>
                </div>
              )}
              {detailPartner.aiSummary && (
                <div>
                  <p className={`text-xs mb-1 ${th.dlgField}`}>Riassunto AI</p>
                  <p className={`rounded-lg p-3 text-sm ${th.dlgBox} ${th.body}`}>{detailPartner.aiSummary}</p>
                </div>
              )}
              <div>
                <button onClick={() => setJsonOpen(!jsonOpen)} className={`flex items-center gap-1 text-xs ${th.dim} hover:opacity-80`}>
                  {jsonOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  Dati JSON
                </button>
                {jsonOpen && <pre className={`rounded-lg p-3 text-xs overflow-x-auto max-h-60 mt-1 ${th.dlgBox} ${th.dim}`}>{JSON.stringify(detailPartner.partner, null, 2)}</pre>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
