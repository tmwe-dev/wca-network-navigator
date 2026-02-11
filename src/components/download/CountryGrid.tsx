import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download, Globe, Search, Users, Mail, Phone, CheckCircle, Activity,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useContactCompleteness } from "@/hooks/useContactCompleteness";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { getCountryFlag } from "@/lib/countries";
import { useTheme, t } from "./theme";

interface CountryGridProps {
  selected: { code: string; name: string }[];
  onToggle: (code: string, name: string) => void;
  onRemove: (code: string) => void;
}

export function CountryGrid({ selected, onToggle, onRemove }: CountryGridProps) {
  const isDark = useTheme();
  const th = t(isDark);
  const [search, setSearch] = useState("");
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
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* Selected badges */}
      {selected.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-1.5">
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

      {/* Search + Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
          <Input placeholder="Cerca paese..." value={search} onChange={e => setSearch(e.target.value)} className={`pl-10 ${th.input}`} />
        </div>
        {(["all", "explored", "partial", "missing"] as const).map(mode => {
          const filterLabels = { all: `Tutti (${WCA_COUNTRIES.length})`, explored: `Scansionati (${exploredCount})`, partial: `Parziali (${partialCount})`, missing: `Mai esplorati (${missingCount})` };
          const active = filterMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setFilterMode(mode)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all whitespace-nowrap ${
                active
                  ? isDark ? "bg-white/[0.1] border-white/[0.2] text-white" : "bg-white/90 border-slate-300 text-slate-800 shadow-sm"
                  : isDark ? "bg-white/[0.03] border-white/[0.06] text-slate-400 hover:bg-white/[0.06]" : "bg-white/40 border-slate-200/60 text-slate-500 hover:bg-white/70"
              }`}
            >
              {mode === "all" && <Globe className="w-3 h-3" />}
              {mode === "explored" && <CheckCircle className="w-3 h-3" />}
              {mode === "partial" && <Activity className="w-3 h-3" />}
              {mode === "missing" && <Download className="w-3 h-3" />}
              {filterLabels[mode]}
            </button>
          );
        })}
        <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
          <SelectTrigger className={`w-[140px] h-8 text-xs ${th.selTrigger}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className={th.selContent}>
            <SelectItem value="name">Nome A-Z</SelectItem>
            <SelectItem value="partners">N° partner ↓</SelectItem>
            <SelectItem value="completion">Completamento</SelectItem>
          </SelectContent>
        </Select>
        {/* Select all filtered */}
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
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-all whitespace-nowrap ${
                isDark ? "bg-white/[0.1] border-white/[0.2] text-white hover:bg-white/[0.15]" : "bg-white/90 border-slate-300 text-slate-800 hover:bg-white shadow-sm"
              }`}
            >
              <CheckCircle className="w-3 h-3" />
              {allFilteredSelected ? "Deseleziona" : "Seleziona"} {filtered.length}
            </button>
          );
        })()}
      </div>

      {/* Country grid */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 pr-2">
          {filtered.map(c => {
            const isSelected = selectedCodes.has(c.code);
            const pCount = partnerCounts[c.code] || 0;
            const cCount = cacheCounts[c.code] || 0;
            const hasDirectoryScan = exploredSet.has(c.code);
            const hasDbOnly = !hasDirectoryScan && pCount > 0;
            const isComplete = hasDirectoryScan && cCount > 0 && pCount >= cCount;
            const cs = completeness?.[c.code];
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
                      <span className={`flex items-center gap-1 ${th.dim}`}><Mail className="w-3 h-3" /> Email</span>
                      <span className={`font-mono font-bold ${withEmail > 0 ? (isDark ? "text-emerald-400" : "text-emerald-600") : (isDark ? "text-red-400" : "text-red-500")}`}>{withEmail}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className={`flex items-center gap-1 ${th.dim}`}><Phone className="w-3 h-3" /> Telefono</span>
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
    </div>
  );
}
