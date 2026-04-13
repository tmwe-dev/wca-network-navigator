import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Euro, Users, Calendar, Phone, Mail, Filter, Star, Globe, BarChart3 } from "lucide-react";
import { t } from "@/components/download/theme";

export interface ProspectFilters {
  fatturato_min: string;
  fatturato_max: string;
  dipendenti_min: string;
  dipendenti_max: string;
  anno_fondazione_min: string;
  anno_fondazione_max: string;
  has_phone: boolean;
  has_email: boolean;
  has_phone_and_email: boolean;
  rank_volume_min: number;
  rank_valore_min: number;
  rank_intl: string[];
  rank_score_min: number;
}

export const EMPTY_FILTERS: ProspectFilters = {
  fatturato_min: "",
  fatturato_max: "",
  dipendenti_min: "",
  dipendenti_max: "",
  anno_fondazione_min: "",
  anno_fondazione_max: "",
  has_phone: false,
  has_email: false,
  has_phone_and_email: false,
  rank_volume_min: 0,
  rank_valore_min: 0,
  rank_intl: [],
  rank_score_min: 0,
};

const INTL_OPTIONS = ["MOLTO ALTO", "ALTO", "MEDIO", "BASSO", "MOLTO DIFFICILE"];

interface Props {
  filters: ProspectFilters;
  onChange: (f: ProspectFilters) => void;
  isDark: boolean;
}

function RangeRow({ label, icon: Icon, minVal, maxVal, onMinChange, onMaxChange, isDark, placeholder }: {
  label: string; icon: any; minVal: string; maxVal: string;
  onMinChange: (v: string) => void; onMaxChange: (v: string) => void;
  isDark: boolean; placeholder?: [string, string];
}) {
  const th = t(isDark);
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
      <span className={`text-[11px] w-20 shrink-0 ${th.sub}`}>{label}</span>
      <Input
        type="text"
        inputMode="numeric"
        value={minVal}
        onChange={e => onMinChange(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder={placeholder?.[0] || "Min"}
        className="h-7 text-[11px] px-2 w-24 bg-card border-border placeholder:text-muted-foreground"
      />
      <span className={`text-[10px] ${th.dim}`}>—</span>
      <Input
        type="text"
        inputMode="numeric"
        value={maxVal}
        onChange={e => onMaxChange(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder={placeholder?.[1] || "Max"}
        className="h-7 text-[11px] px-2 w-24 bg-card border-border placeholder:text-muted-foreground"
      />
    </div>
  );
}

function StarSelector({ label, icon: Icon, value, onChange, isDark }: {
  label: string; icon: any; value: number; onChange: (v: number) => void; isDark: boolean;
}) {
  const th = t(isDark);
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5 shrink-0 text-primary/60" />
      <span className={`text-[11px] w-20 shrink-0 ${th.sub}`}>{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(star => (
          <button
            key={star}
            onClick={() => onChange(value === star ? 0 : star)}
            className="p-0.5 transition-all"
            title={value === star ? "Rimuovi filtro" : `Minimo ${star} stelle`}
          >
            <Star className={`w-4 h-4 ${
              star <= value
                ? "text-primary fill-primary"
                : isDark ? "text-white/15" : "text-muted-foreground/30"
            }`} />
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className="text-[9px] font-mono text-primary/60">≥{value}</span>
      )}
    </div>
  );
}

function ChipMultiSelect({ label, icon: Icon, options, selected, onToggle, isDark }: {
  label: string; icon: any; options: string[]; selected: string[];
  onToggle: (v: string) => void; isDark: boolean;
}) {
  const th = t(isDark);
  const selectedSet = new Set(selected);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5 shrink-0 text-primary/60" />
        <span className={`text-[11px] ${th.sub}`}>{label}</span>
      </div>
      <div className="flex flex-wrap gap-1 ml-5">
        {options.map(opt => {
          const active = selectedSet.has(opt);
          // Shorten display labels
          const short = opt
            .replace("SI - ALTA PROBABILITÀ", "Alta")
            .replace("SI - MEDIA PROBABILITÀ", "Media")
            .replace("POSSIBILE", "Possibile")
            .replace("IMPROBABILE", "Improbabile")
            .replace("MOLTO ALTO", "Molto Alto")
            .replace("MOLTO DIFFICILE", "Molto Diff.");
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all ${
                active
                  ? "bg-primary/20 text-primary border-primary/30"
                  : isDark
                    ? "bg-white/[0.03] text-muted-foreground border-white/[0.06] hover:border-white/15"
                    : "bg-card text-muted-foreground border-border hover:border-foreground/30"
              }`}
            >
              {short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ProspectAdvancedFilters({ filters, onChange, isDark }: Props) {
  const th = t(isDark);
  const [open, setOpen] = useState(false);

  const update = (key: keyof ProspectFilters, val: string | boolean | number | string[]) => {
    onChange({ ...filters, [key]: val });
  };

  const toggleArrayItem = (key: "rank_intl", val: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
    update(key, next);
  };

  const activeCount = [
    filters.fatturato_min || filters.fatturato_max,
    filters.dipendenti_min || filters.dipendenti_max,
    filters.anno_fondazione_min || filters.anno_fondazione_max,
    filters.has_phone,
    filters.has_email,
    filters.has_phone_and_email,
    filters.rank_volume_min > 0,
    filters.rank_valore_min > 0,
    filters.rank_intl.length > 0,
    filters.rank_score_min > 0,
  ].filter(Boolean).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
          isDark ? "hover:bg-white/[0.04]" : "hover:bg-muted/50"
        }`}>
          <Filter className="w-4 h-4 text-primary" />
          <span className={`text-xs font-semibold ${th.h2}`}>Filtri Avanzati</span>
          {activeCount > 0 && (
            <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              {activeCount}
            </span>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className={`max-w-md p-0 border-0 overflow-hidden bg-card`}>
        <DialogTitle className="sr-only">Filtri Avanzati</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Filtri Avanzati</span>
            {activeCount > 0 && (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
                {activeCount} attivi
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={() => { onChange({ ...EMPTY_FILTERS }); }}
                className="text-[11px] px-2 py-1 rounded-lg transition-all text-muted-foreground hover:text-foreground hover:bg-muted/50"
              >
                Reset
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Applica filtri
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto text-foreground">

          {/* Sezione: Range Aziendali */}
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            📊 Parametri Aziendali
          </p>

          <RangeRow
            label="Fatturato"
            icon={Euro}
            minVal={filters.fatturato_min}
            maxVal={filters.fatturato_max}
            onMinChange={v => update("fatturato_min", v)}
            onMaxChange={v => update("fatturato_max", v)}
            isDark={isDark}
            placeholder={["€ Min", "€ Max"]}
          />

          <RangeRow
            label="Dipendenti"
            icon={Users}
            minVal={filters.dipendenti_min}
            maxVal={filters.dipendenti_max}
            onMinChange={v => update("dipendenti_min", v)}
            onMaxChange={v => update("dipendenti_max", v)}
            isDark={isDark}
            placeholder={["Min", "Max"]}
          />

          <RangeRow
            label="Fondazione"
            icon={Calendar}
            minVal={filters.anno_fondazione_min}
            maxVal={filters.anno_fondazione_max}
            onMinChange={v => update("anno_fondazione_min", v)}
            onMaxChange={v => update("anno_fondazione_max", v)}
            isDark={isDark}
            placeholder={["Anno da", "Anno a"]}
          />

          {/* Sezione: Contatti */}
          <div className="border-t pt-4 space-y-3 border-border">
            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">
              📞 Disponibilità Contatti
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={filters.has_phone} onCheckedChange={v => update("has_phone", v)} />
              <Phone className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-foreground">Ha numero di telefono</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={filters.has_email} onCheckedChange={v => update("has_email", v)} />
              <Mail className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-foreground">Ha indirizzo email</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={filters.has_phone_and_email} onCheckedChange={v => update("has_phone_and_email", v)} />
              <span className="text-xs font-medium text-emerald-500">📞+📧 Ha entrambi</span>
            </label>
          </div>

          {/* Sezione: Ranking ATECO */}
          <div className="border-t pt-4 space-y-3 border-border">
            <p className="text-[10px] uppercase tracking-wider font-bold text-primary/80">
              ⭐ Ranking ATECO
            </p>

            <StarSelector
              label="Volume"
              icon={BarChart3}
              value={filters.rank_volume_min}
              onChange={v => update("rank_volume_min", v)}
              isDark={isDark}
            />

            <StarSelector
              label="Valore/kg"
              icon={Euro}
              value={filters.rank_valore_min}
              onChange={v => update("rank_valore_min", v)}
              isDark={isDark}
            />

            <ChipMultiSelect
              label="Internazionalità"
              icon={Globe}
              options={INTL_OPTIONS}
              selected={filters.rank_intl}
              onToggle={v => toggleArrayItem("rank_intl", v)}
              isDark={isDark}
            />

            {/* Score slider */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 shrink-0 text-primary/60" />
                <span className="text-xs text-foreground">Score minimo</span>
                <span className={`text-[11px] font-mono font-bold ml-auto ${
                  filters.rank_score_min > 0 ? "text-primary" : "text-muted-foreground"
                }`}>
                  {filters.rank_score_min > 0 ? `≥ ${filters.rank_score_min}` : "Off"}
                </span>
              </div>
              <Slider
                min={0}
                max={20}
                step={1}
                value={[filters.rank_score_min]}
                onValueChange={([v]) => update("rank_score_min", v)}
                className="ml-5"
              />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
