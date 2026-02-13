import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Euro, Users, Calendar, Phone, Mail, Filter } from "lucide-react";
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
};

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

export function ProspectAdvancedFilters({ filters, onChange, isDark }: Props) {
  const th = t(isDark);
  const [open, setOpen] = useState(false);

  const update = (key: keyof ProspectFilters, val: string | boolean) => {
    onChange({ ...filters, [key]: val });
  };

  const activeCount = [
    filters.fatturato_min || filters.fatturato_max,
    filters.dipendenti_min || filters.dipendenti_max,
    filters.anno_fondazione_min || filters.anno_fondazione_max,
    filters.has_phone,
    filters.has_email,
    filters.has_phone_and_email,
  ].filter(Boolean).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
        isDark ? "hover:bg-white/[0.04]" : "hover:bg-slate-50"
      }`}>
        <Filter className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
        <span className={`text-xs font-semibold ${th.h2}`}>Filtri Avanzati</span>
        {activeCount > 0 && (
          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full ${isDark ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-amber-50 text-amber-600 border border-amber-200"}`}>
            {activeCount}
          </span>
        )}
        {open ? <ChevronDown className={`w-3.5 h-3.5 ml-auto ${th.dim}`} /> : <ChevronRight className={`w-3.5 h-3.5 ml-auto ${th.dim}`} />}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className={`mt-1 p-3 rounded-xl border space-y-3 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-white/40 border-slate-200/60"}`}>
          {/* Fatturato */}
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

          {/* Dipendenti */}
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

          {/* Anno fondazione */}
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

          {/* Contact filters */}
          <div className={`border-t pt-2 space-y-2 ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={filters.has_phone} onCheckedChange={v => update("has_phone", v)} />
              <Phone className={`w-3 h-3 ${th.dim}`} />
              <span className={`text-[11px] ${th.sub}`}>Ha numero di telefono</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={filters.has_email} onCheckedChange={v => update("has_email", v)} />
              <Mail className={`w-3 h-3 ${th.dim}`} />
              <span className={`text-[11px] ${th.sub}`}>Ha indirizzo email</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <Switch checked={filters.has_phone_and_email} onCheckedChange={v => update("has_phone_and_email", v)} />
              <span className={`text-[11px] font-medium ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>📞+📧 Ha entrambi</span>
            </label>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
