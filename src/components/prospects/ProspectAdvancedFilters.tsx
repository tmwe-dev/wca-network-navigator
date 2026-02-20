import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Euro, Users, Calendar, Phone, Mail, Filter, Star, Globe, BarChart3, X } from "lucide-react";
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
      <Icon className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-sky-400/60" : "text-sky-500/60"}`} />
      <span className={`text-[11px] w-20 shrink-0 ${th.sub}`}>{label}</span>
      <Input
        type="text"
        inputMode="numeric"
        value={minVal}
        onChange={e => onMinChange(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder={placeholder?.[0] || "Min"}
        className={`h-7 text-[11px] px-2 w-24 ${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-slate-600" : "bg-white border-slate-200 placeholder:text-slate-400"}`}
      />
      <span className={`text-[10px] ${th.dim}`}>—</span>
      <Input
        type="text"
        inputMode="numeric"
        value={maxVal}
        onChange={e => onMaxChange(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder={placeholder?.[1] || "Max"}
        className={`h-7 text-[11px] px-2 w-24 ${isDark ? "bg-white/5 border-white/10 text-white placeholder:text-slate-600" : "bg-white border-slate-200 placeholder:text-slate-400"}`}
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
      <Icon className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-amber-400/60" : "text-amber-500/60"}`} />
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
                ? "text-amber-400 fill-amber-400"
                : isDark ? "text-white/15" : "text-slate-300"
            }`} />
          </button>
        ))}
      </div>
      {value > 0 && (
        <span className={`text-[9px] font-mono ${isDark ? "text-amber-300/60" : "text-amber-600/60"}`}>≥{value}</span>
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
        <Icon className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-violet-400/60" : "text-violet-500/60"}`} />
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
                  ? isDark
                    ? "bg-violet-500/20 text-violet-300 border-violet-500/30"
                    : "bg-violet-50 text-violet-700 border-violet-300"
                  : isDark
                    ? "bg-white/[0.03] text-slate-500 border-white/[0.06] hover:border-white/15"
                    : "bg-white/50 text-slate-400 border-slate-200 hover:border-slate-300"
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
          isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
        }`}>
          <Filter className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
          <span className={`text-xs font-semibold ${th.h2}`}>Filtri Avanzati</span>
          {activeCount > 0 && (
            <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${isDark ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-600 border border-amber-200"}`}>
              {activeCount}
            </span>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className={`max-w-md p-0 border-0 overflow-hidden ${isDark ? "bg-slate-900" : "bg-white"}`}>
        <DialogTitle className="sr-only">Filtri Avanzati</DialogTitle>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 border-b ${isDark ? "border-white/10" : "border-slate-200"}`}>
          <div className="flex items-center gap-2">
            <Filter className={`w-5 h-5 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
            <span className={`text-sm font-bold ${isDark ? "text-white" : "text-slate-800"}`}>Filtri Avanzati</span>
            {activeCount > 0 && (
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${isDark ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-600 border border-amber-200"}`}>
                {activeCount} attivi
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={() => { onChange({ ...EMPTY_FILTERS }); }}
                className={`text-[11px] px-2 py-1 rounded-lg transition-all ${isDark ? "text-slate-400 hover:text-white hover:bg-white/[0.06]" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
              >
                Reset
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${isDark ? "bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30" : "bg-sky-500 text-white hover:bg-sky-600"}`}
            >
              Applica filtri
            </button>
          </div>
        </div>

        {/* Body */}
        <div className={`px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto ${isDark ? "text-slate-200" : "text-slate-700"}`}>

          {/* Sezione: Range Aziendali */}
          <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-sky-400/80" : "text-sky-600"}`}>
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
          <div className={`border-t pt-4 space-y-3 ${isDark ? "border-white/10" : "border-slate-200"}`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-emerald-400/80" : "text-emerald-600"}`}>
              📞 Disponibilità Contatti
            </p>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={filters.has_phone} onCheckedChange={v => update("has_phone", v)} />
              <Phone className={`w-3.5 h-3.5 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
              <span className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>Ha numero di telefono</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={filters.has_email} onCheckedChange={v => update("has_email", v)} />
              <Mail className={`w-3.5 h-3.5 ${isDark ? "text-slate-400" : "text-slate-500"}`} />
              <span className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>Ha indirizzo email</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Switch checked={filters.has_phone_and_email} onCheckedChange={v => update("has_phone_and_email", v)} />
              <span className={`text-xs font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>📞+📧 Ha entrambi</span>
            </label>
          </div>

          {/* Sezione: Ranking ATECO */}
          <div className={`border-t pt-4 space-y-3 ${isDark ? "border-white/10" : "border-slate-200"}`}>
            <p className={`text-[10px] uppercase tracking-wider font-bold ${isDark ? "text-amber-400/80" : "text-amber-600"}`}>
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
                <Star className={`w-3.5 h-3.5 shrink-0 ${isDark ? "text-amber-400/60" : "text-amber-500/60"}`} />
                <span className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>Score minimo</span>
                <span className={`text-[11px] font-mono font-bold ml-auto ${
                  filters.rank_score_min > 0
                    ? isDark ? "text-amber-300" : "text-amber-600"
                    : isDark ? "text-slate-600" : "text-slate-400"
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
