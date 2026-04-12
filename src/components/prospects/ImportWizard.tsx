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
  const card = `rounded-xl border ${isDark ? "bg-card/30 border-border" : "bg-card/60 border-border"}`;
  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${active
      ? "bg-primary/20 text-primary border-primary/30"
      : isDark
        ? "bg-muted/30 text-muted-foreground border-border hover:border-primary/20"
        : "bg-card text-muted-foreground border-border hover:border-primary/20"
    }`;
  const btn = (variant: "primary" | "secondary" | "ghost") => {
    if (variant === "primary") return `flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30`;
    if (variant === "secondary") return `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-border`;
    return `flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all text-muted-foreground hover:text-foreground`;
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
                  ? "bg-primary/20 text-primary"
                  : done
                    ? "text-emerald-400 hover:bg-muted/30"
                    : "text-muted-foreground/40"
              }`}
            >
              {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
              <span className={`text-[10px] font-mono ${active ? "" : "hidden sm:inline"}`}>
                {!done && !active && `${s.id}`}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 h-px mx-0.5 ${done ? "bg-emerald-500/40" : "bg-border"}`} />
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
            <h2 className="text-sm font-bold text-foreground">
              Seleziona il settore ATECO
            </h2>
            <p className="text-xs text-muted-foreground">
              Scegli uno o più settori. Puoi espandere ogni sezione per selezionare gruppi specifici.
            </p>
          </div>
          {atecoCodes.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-primary/10 border border-primary/20 text-primary">
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
                  className="w-full flex items-center gap-3 p-3 text-left transition-all hover:bg-muted/30"
                >
                  <span className="text-xl w-8 shrink-0 text-center">{SECTION_ICONS[section.codice] || "📦"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-foreground">
                      Sezione {section.codice}
                    </div>
                    <div className="text-[10px] truncate text-muted-foreground">
                      {section.descrizione}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {selectedInSection > 0 && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                        {selectedInSection}/{groups.length}
                      </span>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); toggleSection(section.codice); }}
                      className={`text-[10px] px-2 py-1 rounded-lg font-medium transition-all border ${
                        allSelected
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-muted/30 text-muted-foreground border-border hover:border-primary/20"
                      }`}
                    >
                      {allSelected ? "✓ Tutti" : "Seleziona tutti"}
                    </button>
                    <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""} text-muted-foreground`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-border">
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {groups.map(g => {
                        const active = atecoCodes.includes(g.codice);
                        return (
                          <button
                            key={g.codice}
                            onClick={() => toggleCode(g.codice)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] border transition-all ${
                              active
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"
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
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">
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
            <h2 className="text-sm font-bold text-foreground">
              Zona geografica
            </h2>
            <p className="text-xs text-muted-foreground">
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
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                Province ({regions.join(", ")})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {visibleProvinces.map(p => (
                  <button
                    key={p.sigla}
                    onClick={() => toggleProvince(p.sigla)}
                    className={`px-2 py-1 rounded-lg text-[11px] border transition-all ${
                      provinces.includes(p.sigla)
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                        : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"
                    }`}
                  >
                    <span className="font-mono font-bold">{p.sigla}</span> {p.nome}
                  </button>
                ))}
              </div>
            </div>
          )}

          {(regions.length > 0 || provinces.length > 0) && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-300">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>
                {regions.length > 0 ? `${regions.join(", ")}` : ""}
                {provinces.length > 0 ? ` · Province: ${provinces.join(", ")}` : ""}
              </span>
            </div>
          )}
        </div>

        {/* Footer fisso */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
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
            ? "bg-primary/20 text-primary border-primary/30"
            : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"
        }`}
      >
        <span className="text-xs font-bold">{label}</span>
        <span className={`text-[10px] ${active ? "" : "text-muted-foreground/60"}`}>{desc}</span>
      </button>
    );

    return (
      <div className="h-full flex flex-col">
        {/* Header fisso */}
        <div className="flex-shrink-0 px-4 pt-4 pb-2 space-y-2">
          <StepBar />
          <div className={`${card} p-3 space-y-1`}>
            <h2 className="text-sm font-bold text-foreground">
              Profilo aziendale <span className="text-xs font-normal text-muted-foreground">(opzionale)</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Filtra per dimensione aziendale e disponibilità di contatti.
            </p>
          </div>
        </div>

        {/* Contenuto scrollabile */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-3">
          {/* Fatturato */}
          <div className={`${card} p-3 space-y-2`}>
            <p className="text-[10px] uppercase tracking-wider font-bold text-primary/80">
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
            <p className="text-[10px] uppercase tracking-wider font-bold text-primary/80">
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
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-400/80">
              📞 Contatti disponibili
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setFilters(f => ({ ...f, has_phone: !f.has_phone, has_phone_and_email: false }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  filters.has_phone
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"
                }`}
              >
                <Phone className="w-3.5 h-3.5" /> Ha telefono
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, has_email: !f.has_email, has_phone_and_email: false }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  filters.has_email
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Ha email
              </button>
              <button
                onClick={() => setFilters(f => ({ ...f, has_phone_and_email: !f.has_phone_and_email, has_phone: false, has_email: false }))}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                  filters.has_phone_and_email
                    ? "bg-primary/20 text-primary border-primary/30"
                    : "bg-muted/20 text-muted-foreground border-border hover:border-primary/20"
                }`}
              >
                <Globe className="w-3.5 h-3.5" /> Entrambi
              </button>
            </div>
          </div>
        </div>

        {/* Footer fisso */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
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
          <h2 className="text-sm font-bold text-foreground">
            Riepilogo e avvio
          </h2>
          <p className="text-xs text-muted-foreground">
            Controlla i parametri e avvia la ricerca su Report Aziende.
          </p>
        </div>
      </div>

      {/* Contenuto scrollabile */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2">
        {/* ATECO */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <Building2 className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Settore ATECO</p>
            {atecoCodes.length > 0 ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {atecoCodes.slice(0, 8).map(c => (
                  <span key={c} className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-primary/15 text-primary">{c}</span>
                ))}
                {atecoCodes.length > 8 && <span className="text-[10px] text-muted-foreground">+{atecoCodes.length - 8} altri</span>}
              </div>
            ) : (
              <p className="text-xs mt-1 text-muted-foreground">Tutti i settori</p>
            )}
          </div>
          <button onClick={() => setStep(1)} className="text-[10px] shrink-0 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30">Modifica</button>
        </div>

        {/* Zona */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Zona geografica</p>
            {regions.length > 0 ? (
              <p className="text-xs mt-1 text-emerald-300">
                {regions.join(", ")}
                {provinces.length > 0 && ` · Prov: ${provinces.join(", ")}`}
              </p>
            ) : (
              <p className="text-xs mt-1 text-muted-foreground">🇮🇹 Tutta Italia</p>
            )}
          </div>
          <button onClick={() => setStep(2)} className="text-[10px] shrink-0 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30">Modifica</button>
        </div>

        {/* Profilo */}
        <div className={`${card} p-3 flex items-start gap-3`}>
          <Search className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Profilo aziendale</p>
            {hasFilters ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {fatturatoPreset !== null && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-primary/15 text-primary border border-primary/20">
                    💰 {FATTURATO_PRESETS[fatturatoPreset].label} ({FATTURATO_PRESETS[fatturatoPreset].desc})
                  </span>
                )}
                {dipendentiPreset !== null && (
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-primary/15 text-primary border border-primary/20">
                    👥 {DIPENDENTI_PRESETS[dipendentiPreset].label} ({DIPENDENTI_PRESETS[dipendentiPreset].desc})
                  </span>
                )}
                {filters.has_phone && <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">📞 Ha telefono</span>}
                {filters.has_email && <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">📧 Ha email</span>}
                {filters.has_phone_and_email && <span className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-primary/15 text-primary border border-primary/20">📞+📧 Entrambi</span>}
              </div>
            ) : (
              <p className="text-xs mt-1 text-muted-foreground">Nessun filtro aggiuntivo</p>
            )}
          </div>
          <button onClick={() => setStep(3)} className="text-[10px] shrink-0 px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/30">Modifica</button>
        </div>

        {/* Extension status */}
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs ${isExtAvailable
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-destructive/10 text-destructive border border-destructive/20"
        }`}>
          <span className={`w-2 h-2 rounded-full shrink-0 ${isExtAvailable ? "bg-emerald-400" : "bg-destructive"} animate-pulse`} />
          {isExtAvailable
            ? "✅ Estensione RA connessa — pronto per la ricerca"
            : "❌ Estensione RA non rilevata — installala e ricarica la pagina prima di procedere"
          }
        </div>
      </div>

      {/* Footer fisso */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border">
        <button onClick={() => setStep(3)} className={btn("secondary")}>
          <ChevronLeft className="w-4 h-4" /> Indietro
        </button>
        <button
          onClick={handleStart}
          disabled={!isExtAvailable}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-40 bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30"
        >
          <Rocket className="w-5 h-5" />
          Cerca Aziende
        </button>
      </div>
    </div>
  );
}
