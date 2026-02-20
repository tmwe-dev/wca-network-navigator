import { useState } from "react";
import { ChevronRight, ChevronLeft, Search, MapPin, Building2, Rocket, Check, Phone, Mail, Globe, SkipForward } from "lucide-react";
import { ATECO_TREE } from "@/data/atecoCategories";
import { REGIONI_ITALIANE, PROVINCE_ITALIANE } from "@/data/italianProvinces";
import type { ProspectFilters } from "./ProspectAdvancedFilters";
import { EMPTY_FILTERS } from "./ProspectAdvancedFilters";

export interface WizardState {
  atecoCodes: string[];
  regions: string[];
  provinces: string[];
  filters: ProspectFilters;
}

interface ImportWizardProps {
  isDark: boolean;
  isExtAvailable: boolean;
  onStart: (state: WizardState) => void;
  initialAtecoCodes?: string[];
  initialRegions?: string[];
  initialProvinces?: string[];
}

// ATECO sections (livello 1) only
const ATECO_SECTIONS = ATECO_TREE.filter(e => e.livello === 1);
// ATECO groups (livello 2) only
const ATECO_GROUPS = ATECO_TREE.filter(e => e.livello === 2);

const SECTION_ICONS: Record<string, string> = {
  A: "🌾", B: "⛏️", C: "🏭", D: "⚡", E: "♻️", F: "🏗️",
  G: "🛒", H: "🚛", I: "🏨", J: "💻", K: "🏦", L: "🏘️",
  M: "🔬", N: "🧹", O: "🏛️", P: "📚", Q: "⚕️", R: "🎭",
  S: "🔧", T: "👩‍👧", U: "🌐",
};

// Fatturato presets (in thousands)
const FATTURATO_PRESETS = [
  { label: "Micro", desc: "< 500K", min: "", max: "500" },
  { label: "Piccola", desc: "500K – 5M", min: "500", max: "5000" },
  { label: "Media", desc: "5M – 50M", min: "5000", max: "50000" },
  { label: "Grande", desc: "> 50M", min: "50000", max: "" },
];

const DIPENDENTI_PRESETS = [
  { label: "Micro", desc: "< 10", min: "", max: "10" },
  { label: "Piccola", desc: "10 – 50", min: "10", max: "50" },
  { label: "Media", desc: "50 – 250", min: "50", max: "250" },
  { label: "Grande", desc: "> 250", min: "250", max: "" },
];

const STEPS = [
  { id: 1, label: "Settore", icon: Building2 },
  { id: 2, label: "Zona", icon: MapPin },
  { id: 3, label: "Profilo", icon: Search },
  { id: 4, label: "Avvia", icon: Rocket },
];

export function ImportWizard({
  isDark, isExtAvailable, onStart,
  initialAtecoCodes = [], initialRegions = [], initialProvinces = [],
}: ImportWizardProps) {
  const [step, setStep] = useState(1);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [atecoCodes, setAtecoCodes] = useState<string[]>(initialAtecoCodes);
  const [regions, setRegions] = useState<string[]>(initialRegions);
  const [provinces, setProvinces] = useState<string[]>(initialProvinces);
  const [filters, setFilters] = useState<ProspectFilters>({ ...EMPTY_FILTERS });
  const [fatturatoPreset, setFatturatoPreset] = useState<number | null>(null);
  const [dipendentiPreset, setDipendentiPreset] = useState<number | null>(null);

  // ── helpers ──
  const toggleCode = (code: string) => {
    setAtecoCodes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const toggleSection = (sectionCode: string) => {
    const groups = ATECO_GROUPS.filter(g => g.padre === sectionCode);
    const groupCodes = groups.map(g => g.codice);
    const allSelected = groupCodes.every(c => atecoCodes.includes(c));
    if (allSelected) {
      setAtecoCodes(prev => prev.filter(c => !groupCodes.includes(c)));
    } else {
      setAtecoCodes(prev => [...new Set([...prev, ...groupCodes])]);
    }
  };

  const toggleRegion = (region: string) => {
    if (region === "__ALL__") {
      setRegions([]);
      setProvinces([]);
      return;
    }
    setRegions(prev => {
      if (prev.includes(region)) {
        // Remove region and its provinces
        const provs = PROVINCE_ITALIANE.filter(p => p.regione === region).map(p => p.sigla);
        setProvinces(pp => pp.filter(p => !provs.includes(p)));
        return prev.filter(r => r !== region);
      }
      return [...prev, region];
    });
  };

  const toggleProvince = (sigla: string) => {
    setProvinces(prev => prev.includes(sigla) ? prev.filter(p => p !== sigla) : [...prev, sigla]);
  };

  const applyFatturatoPreset = (idx: number) => {
    const p = FATTURATO_PRESETS[idx];
    if (fatturatoPreset === idx) {
      setFatturatoPreset(null);
      setFilters(f => ({ ...f, fatturato_min: "", fatturato_max: "" }));
    } else {
      setFatturatoPreset(idx);
      setFilters(f => ({ ...f, fatturato_min: p.min, fatturato_max: p.max }));
    }
  };

  const applyDipendentiPreset = (idx: number) => {
    const p = DIPENDENTI_PRESETS[idx];
    if (dipendentiPreset === idx) {
      setDipendentiPreset(null);
      setFilters(f => ({ ...f, dipendenti_min: "", dipendenti_max: "" }));
    } else {
      setDipendentiPreset(idx);
      setFilters(f => ({ ...f, dipendenti_min: p.min, dipendenti_max: p.max }));
    }
  };

  const handleStart = () => {
    onStart({ atecoCodes, regions, provinces, filters });
  };

  // ── style helpers ──
  const card = `rounded-xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white/60 border-slate-200/70"}`;
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${active
      ? isDark
        ? "bg-sky-500/20 text-sky-300 border-sky-500/30"
        : "bg-sky-100 text-sky-700 border-sky-300"
      : isDark
        ? "bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-white/20"
        : "bg-white/60 text-slate-500 border-slate-200 hover:border-slate-300"
    }`;
  const btn = (variant: "primary" | "secondary" | "ghost") => {
    if (variant === "primary") return `flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${isDark ? "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30" : "bg-sky-500 text-white hover:bg-sky-600"}`;
    if (variant === "secondary") return `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${isDark ? "bg-white/[0.05] text-slate-400 hover:bg-white/[0.08] border border-white/[0.08]" : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"}`;
    return `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`;
  };

  // ── Step bar ──
  const StepBar = () => (
    <div className="flex items-center gap-0">
      {STEPS.map((s, i) => {
        const done = step > s.id;
        const active = step === s.id;
        const Icon = s.icon;
        return (
          <div key={s.id} className="flex items-center">
            <button
              onClick={() => done && setStep(s.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? isDark ? "bg-sky-500/20 text-sky-300" : "bg-sky-100 text-sky-700"
                  : done
                    ? isDark ? "text-emerald-400 hover:bg-white/[0.04]" : "text-emerald-600 hover:bg-emerald-50"
                    : isDark ? "text-slate-600" : "text-slate-400"
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
              <span className={`text-[10px] font-mono ${active ? "" : "hidden sm:inline"}`}>
                {!done && !active && `${s.id}`}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-0.5 ${done ? isDark ? "bg-emerald-500/40" : "bg-emerald-300" : isDark ? "bg-white/10" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  // ════════════════════════════════════════════
  // STEP 1 — SETTORE ATECO
  // ════════════════════════════════════════════
  if (step === 1) {
    return (
      <div className="h-full flex flex-col">
        {/* Header fisso */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
          <StepBar />
          <div className={`${card} p-3 space-y-1`}>
            <h2 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
              Seleziona il settore ATECO
            </h2>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Scegli uno o più settori. Puoi espandere ogni sezione per selezionare gruppi specifici.
            </p>
          </div>
          {atecoCodes.length > 0 && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${isDark ? "bg-sky-500/10 border border-sky-500/20 text-sky-300" : "bg-sky-50 border border-sky-200 text-sky-700"}`}>
              <Check className="w-3.5 h-3.5 shrink-0" />
              <span>{atecoCodes.length} codici selezionati: {atecoCodes.slice(0, 5).join(", ")}{atecoCodes.length > 5 ? `...+${atecoCodes.length - 5}` : ""}</span>
            </div>
          )}
        </div>

        {/* Contenuto scrollabile */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2">
          {ATECO_SECTIONS.map(section => {
            const groups = ATECO_GROUPS.filter(g => g.padre === section.codice);
            const selectedInSection = groups.filter(g => atecoCodes.includes(g.codice)).length;
            const isExpanded = expandedSection === section.codice;
            const allSelected = groups.length > 0 && selectedInSection === groups.length;

            return (
              <div key={section.codice} className={`${card} overflow-hidden`}>
                <button
                  onClick={() => setExpandedSection(isExpanded ? null : section.codice)}
                  className={`w-full flex items-center gap-3 p-3 text-left transition-all hover:${isDark ? "bg-white/[0.03]" : "bg-slate-50/50"}`}
                >
                  <span className="text-xl w-8 shrink-0 text-center">{SECTION_ICONS[section.codice] || "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
                      Sezione {section.codice}
                    </div>
                    <div className={`text-[10px] truncate ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                      {section.descrizione}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedInSection > 0 && (
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${isDark ? "bg-sky-500/20 text-sky-300 border border-sky-500/30" : "bg-sky-50 text-sky-600 border border-sky-200"}`}>
                        {selectedInSection}/{groups.length}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); toggleSection(section.codice); }}
                      className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all border ${
                        allSelected
                          ? isDark ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "bg-sky-100 text-sky-700 border-sky-300"
                          : isDark ? "bg-white/[0.04] text-slate-400 border-white/[0.08] hover:border-white/20" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {allSelected ? "✓ Tutti" : "Seleziona tutti"}
                    </button>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""} ${isDark ? "text-slate-500" : "text-slate-400"}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className={`px-3 pb-3 pt-1 border-t ${isDark ? "border-white/[0.06]" : "border-slate-100"}`}>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {groups.map(g => {
                        const active = atecoCodes.includes(g.codice);
                        return (
                          <button
                            key={g.codice}
                            onClick={() => toggleCode(g.codice)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all ${
                              active
                                ? isDark ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "bg-sky-100 text-sky-700 border-sky-300"
                                : isDark ? "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:border-white/15" : "bg-white/50 text-slate-500 border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            {active && <Check className="w-3 h-3" />}
                            <span className="font-mono font-bold">{g.codice}</span>
                            <span className="truncate max-w-[160px]">{g.descrizione}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer fisso */}
        <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-t ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
          <span className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            {atecoCodes.length === 0 ? "Nessun settore selezionato" : ""}
          </span>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)} className={btn("ghost")}>
              Salta <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setStep(2)} className={btn("primary")}>
              Avanti <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  // STEP 2 — ZONA GEOGRAFICA
  // ════════════════════════════════════════════
  if (step === 2) {
    const visibleProvinces = regions.length > 0
      ? PROVINCE_ITALIANE.filter(p => regions.includes(p.regione))
      : [];

    return (
      <div className="h-full flex flex-col">
        {/* Header fisso */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
          <StepBar />
          <div className={`${card} p-3 space-y-1`}>
            <h2 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
              Zona geografica
            </h2>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Seleziona le regioni di interesse. Poi puoi affinare per provincia.
            </p>
          </div>
        </div>

        {/* Contenuto scrollabile */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
          {/* Tutta Italia chip */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => toggleRegion("__ALL__")}
              className={chip(regions.length === 0)}
            >
              🇮🇹 Tutta Italia
            </button>
            {REGIONI_ITALIANE.map(r => (
              <button key={r} onClick={() => toggleRegion(r)} className={chip(regions.includes(r))}>
                {regions.includes(r) && <Check className="w-3 h-3 inline mr-1" />}
                {r}
              </button>
            ))}
          </div>

          {/* Province */}
          {visibleProvinces.length > 0 && (
            <div className={`${card} p-3 space-y-2`}>
              <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Province ({regions.join(", ")})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleProvinces.map(p => (
                  <button
                    key={p.sigla}
                    onClick={() => toggleProvince(p.sigla)}
                    className={`px-2 py-1 rounded-lg text-[11px] border transition-all ${
                      provinces.includes(p.sigla)
                        ? isDark ? "bg-teal-500/20 text-teal-300 border-teal-500/30" : "bg-teal-50 text-teal-700 border-teal-300"
                        : isDark ? "bg-white/[0.03] text-slate-400 border-white/[0.06] hover:border-white/15" : "bg-white/50 text-slate-500 border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <span className="font-mono font-bold">{p.sigla}</span> {p.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(regions.length > 0 || provinces.length > 0) && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${isDark ? "bg-teal-500/10 border border-teal-500/20 text-teal-300" : "bg-teal-50 border border-teal-200 text-teal-700"}`}>
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>
                {regions.length > 0 ? `${regions.join(", ")}` : ""}
                {provinces.length > 0 ? ` · Province: ${provinces.join(", ")}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Footer fisso */}
        <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-t ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
          <button onClick={() => setStep(1)} className={btn("secondary")}>
            <ChevronLeft className="w-4 h-4" /> Indietro
          </button>
          <button onClick={() => setStep(3)} className={btn("primary")}>
            Avanti <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  // STEP 3 — PROFILO AZIENDALE
  // ════════════════════════════════════════════
  if (step === 3) {
    const presetChip = (active: boolean, label: string, desc: string, onClick: () => void) => (
      <button
        onClick={onClick}
        className={`flex flex-col items-center px-3 py-2 rounded-xl border text-center transition-all ${
          active
            ? isDark ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "bg-sky-100 text-sky-700 border-sky-300"
            : isDark ? "bg-white/[0.03] text-slate-400 border-white/[0.08] hover:border-white/20" : "bg-white/60 text-slate-500 border-slate-200 hover:border-slate-300"
        }`}
      >
        <span className="text-xs font-bold">{label}</span>
        <span className={`text-[10px] ${active ? "" : isDark ? "text-slate-600" : "text-slate-400"}`}>{desc}</span>
      </button>
    );

    return (
      <div className="h-full flex flex-col">
        {/* Header fisso */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
          <StepBar />
          <div className={`${card} p-3 space-y-1`}>
            <h2 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
              Profilo aziendale <span className={`text-xs font-normal ${isDark ? "text-slate-500" : "text-slate-400"}`}>(opzionale)</span>
            </h2>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Filtra per dimensione aziendale e disponibilità di contatti.
            </p>
          </div>
        </div>

        {/* Contenuto scrollabile */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
          {/* Fatturato */}
          <div className={`${card} p-3 space-y-2`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-amber-400/80" : "text-amber-600"}`}>
              💰 Fatturato
            </p>
            <div className="grid grid-cols-4 gap-2">
              {FATTURATO_PRESETS.map((p, i) => presetChip(
                fatturatoPreset === i, p.label, p.desc, () => applyFatturatoPreset(i)
              ))}
            </div>
          </div>

          {/* Dipendenti */}
          <div className={`${card} p-3 space-y-2`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-violet-400/80" : "text-violet-600"}`}>
              👥 Dipendenti
            </p>
            <div className="grid grid-cols-4 gap-2">
              {DIPENDENTI_PRESETS.map((p, i) => presetChip(
                dipendentiPreset === i, p.label, p.desc, () => applyDipendentiPreset(i)
              ))}
            </div>
          </div>

          {/* Contatti */}
          <div className={`${card} p-3 space-y-2`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-emerald-400/80" : "text-emerald-600"}`}>
              📞 Contatti disponibili
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, has_phone: !f.has_phone, has_phone_and_email: false }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  filters.has_phone
                    ? isDark ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : isDark ? "bg-white/[0.03] text-slate-400 border-white/[0.08] hover:border-white/20" : "bg-white/60 text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                <Phone className="w-3.5 h-3.5" /> Ha telefono
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, has_email: !f.has_email, has_phone_and_email: false }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  filters.has_email
                    ? isDark ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : isDark ? "bg-white/[0.03] text-slate-400 border-white/[0.08] hover:border-white/20" : "bg-white/60 text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Ha email
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, has_phone_and_email: !f.has_phone_and_email, has_phone: false, has_email: false }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  filters.has_phone_and_email
                    ? isDark ? "bg-sky-500/20 text-sky-300 border-sky-500/30" : "bg-sky-50 text-sky-700 border-sky-300"
                    : isDark ? "bg-white/[0.03] text-slate-400 border-white/[0.08] hover:border-white/20" : "bg-white/60 text-slate-500 border-slate-200 hover:border-slate-300"
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> Entrambi
              </button>
            </div>
          </div>
        </div>

        {/* Footer fisso */}
        <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-t ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
          <button onClick={() => setStep(2)} className={btn("secondary")}>
            <ChevronLeft className="w-4 h-4" /> Indietro
          </button>
          <div className="flex gap-2">
            <button onClick={() => { setFilters({ ...EMPTY_FILTERS }); setFatturatoPreset(null); setDipendentiPreset(null); setStep(4); }} className={btn("ghost")}>
              Salta <SkipForward className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setStep(4)} className={btn("primary")}>
              Avanti <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════
  // STEP 4 — RIEPILOGO E AVVIO
  // ════════════════════════════════════════════
  const hasFilters = fatturatoPreset !== null || dipendentiPreset !== null || filters.has_phone || filters.has_email || filters.has_phone_and_email;

  return (
    <div className="h-full flex flex-col">
      {/* Header fisso */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
        <StepBar />
        <div className={`${card} p-3 space-y-1`}>
          <h2 className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}>
            Riepilogo e avvio
          </h2>
          <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            Controlla i parametri e avvia la ricerca su Report Aziende.
          </p>
        </div>
      </div>

      {/* Contenuto scrollabile */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2">
        {/* ATECO */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <Building2 className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? "text-sky-400" : "text-sky-500"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>Settore ATECO</p>
            {atecoCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {atecoCodes.slice(0, 8).map(c => (
                  <span key={c} className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${isDark ? "bg-sky-500/15 text-sky-300" : "bg-sky-50 text-sky-700"}`}>{c}</span>
                ))}
                {atecoCodes.length > 8 && <span className={`text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>+{atecoCodes.length - 8} altri</span>}
              </div>
            ) : (
              <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>Tutti i settori</p>
            )}
          </div>
          <button onClick={() => setStep(1)} className={`text-[10px] shrink-0 px-2 py-1 rounded-lg ${isDark ? "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>Modifica</button>
        </div>

        {/* Zona */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? "text-teal-400" : "text-teal-500"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>Zona geografica</p>
            {regions.length > 0 ? (
              <p className={`text-xs mt-1 ${isDark ? "text-teal-300" : "text-teal-700"}`}>
                {regions.join(", ")}
                {provinces.length > 0 && ` · Prov: ${provinces.join(", ")}`}
              </p>
            ) : (
              <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>🇮🇹 Tutta Italia</p>
            )}
          </div>
          <button onClick={() => setStep(2)} className={`text-[10px] shrink-0 px-2 py-1 rounded-lg ${isDark ? "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>Modifica</button>
        </div>

        {/* Profilo */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <Search className={`w-4 h-4 mt-0.5 shrink-0 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
          <div className="flex-1 min-w-0">
            <p className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? "text-slate-500" : "text-slate-400"}`}>Profilo aziendale</p>
            {hasFilters ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {fatturatoPreset !== null && (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-amber-500/15 text-amber-300 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                    💰 {FATTURATO_PRESETS[fatturatoPreset].label} ({FATTURATO_PRESETS[fatturatoPreset].desc})
                  </span>
                )}
                {dipendentiPreset !== null && (
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-violet-500/15 text-violet-300 border border-violet-500/20" : "bg-violet-50 text-violet-700 border border-violet-200"}`}>
                    👥 {DIPENDENTI_PRESETS[dipendentiPreset].label} ({DIPENDENTI_PRESETS[dipendentiPreset].desc})
                  </span>
                )}
                {filters.has_phone && <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>📞 Ha telefono</span>}
                {filters.has_email && <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200"}`}>📧 Ha email</span>}
                {filters.has_phone_and_email && <span className={`px-2 py-0.5 rounded-lg text-[10px] font-medium ${isDark ? "bg-sky-500/15 text-sky-300 border border-sky-500/20" : "bg-sky-50 text-sky-700 border border-sky-200"}`}>📞+📧 Entrambi</span>}
              </div>
            ) : (
              <p className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-slate-400"}`}>Nessun filtro aggiuntivo</p>
            )}
          </div>
          <button onClick={() => setStep(3)} className={`text-[10px] shrink-0 px-2 py-1 rounded-lg ${isDark ? "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"}`}>Modifica</button>
        </div>

        {/* Extension status */}
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${isExtAvailable
          ? isDark ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-600 border border-emerald-200"
          : isDark ? "bg-red-500/10 text-red-400 border border-red-500/20" : "bg-red-50 text-red-600 border border-red-200"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isExtAvailable ? "bg-emerald-400" : "bg-red-400"} animate-pulse`} />
          {isExtAvailable
            ? "✅ Estensione RA connessa — pronto per la ricerca"
            : "❌ Estensione RA non rilevata — installala e ricarica la pagina prima di procedere"
          }
        </div>
      </div>

      {/* Footer fisso */}
      <div className={`flex-shrink-0 flex items-center justify-between px-4 py-3 border-t ${isDark ? "border-white/[0.08]" : "border-slate-200/60"}`}>
        <button onClick={() => setStep(3)} className={btn("secondary")}>
          <ChevronLeft className="w-4 h-4" /> Indietro
        </button>
        <button
          onClick={handleStart}
          disabled={!isExtAvailable}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 ${
            isDark
              ? "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30"
              : "bg-sky-500 text-white hover:bg-sky-600 shadow-md shadow-sky-500/20"
          }`}
        >
          <Rocket className="w-5 h-5" />
          Cerca Aziende
        </button>
      </div>
    </div>
  );
}
