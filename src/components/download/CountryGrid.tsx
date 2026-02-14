import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Download, Globe, Search, Users, Mail, Phone, CheckCircle, Activity,
  SlidersHorizontal, X, FolderDown,
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

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedCodes.has(c.code));

  const handleSelectAll = () => {
    filtered.forEach(c => {
      if (allFilteredSelected) {
        if (selectedCodes.has(c.code)) onToggle(c.code, c.name);
      } else {
        if (!selectedCodes.has(c.code)) onToggle(c.code, c.name);
      }
    });
  };

  const filterLabel = filterMode === "all" ? "Tutti" : filterMode === "explored" ? "Scansionati" : filterMode === "partial" ? "Parziali" : "Mai esplorati";
  const sortLabel = sortBy === "name" ? "Nome A-Z" : sortBy === "partners" ? "N° partner ↓" : "Completamento";
  const hasActiveFilter = filterMode !== "all" || sortBy !== "name";

  const filters = [
    { key: "all" as const, label: "Tutti", count: WCA_COUNTRIES.length, icon: Globe },
    { key: "explored" as const, label: "Scansionati", count: exploredCount, icon: CheckCircle },
    { key: "partial" as const, label: "Parziali", count: partialCount, icon: Activity },
    { key: "missing" as const, label: "Mai esplorati", count: missingCount, icon: Download },
  ];

  const sorts = [
    { key: "name" as const, label: "Nome A-Z" },
    { key: "partners" as const, label: "N° partner ↓" },
    { key: "completion" as const, label: "Completamento" },
  ];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* === TOOLBAR: Search + Filter Dropdown === */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${th.dim}`} />
          <Input
            placeholder="Cerca paese..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`pl-12 h-11 rounded-2xl text-base ${th.input}`}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button
              className={`relative flex items-center justify-center w-11 h-11 rounded-2xl border transition-all ${
                isDark
                  ? "bg-white/[0.05] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]"
                  : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white shadow-sm"
              }`}
            >
              <SlidersHorizontal className="w-5 h-5" />
              {hasActiveFilter && (
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-sky-500 border-2 border-background" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className={`w-64 p-3 rounded-2xl ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}
          >
            {/* Sort section */}
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${th.dim}`}>Ordinamento</p>
            <div className="flex flex-col gap-1 mb-3">
              {sorts.map(s => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === s.key
                      ? isDark ? "bg-sky-500/20 text-sky-300" : "bg-sky-50 text-sky-700"
                      : isDark ? "text-slate-400 hover:bg-white/[0.05]" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Filter section */}
            <p className={`text-[10px] uppercase tracking-wider font-semibold mb-2 ${th.dim}`}>Filtro</p>
            <div className="flex flex-col gap-1 mb-3">
              {filters.map(f => {
                const Icon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => setFilterMode(f.key)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      filterMode === f.key
                        ? isDark ? "bg-sky-500/20 text-sky-300" : "bg-sky-50 text-sky-700"
                        : isDark ? "text-slate-400 hover:bg-white/[0.05]" : "text-slate-500 hover:bg-slate-50"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="flex-1">{f.label}</span>
                    <span className="font-mono text-[10px] opacity-60">{f.count}</span>
                  </button>
                );
              })}
            </div>

            {/* Select all */}
            <button
              onClick={handleSelectAll}
              className={`w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                allFilteredSelected
                  ? isDark ? "bg-sky-500/20 border-sky-500/30 text-sky-300" : "bg-sky-100 border-sky-300 text-sky-700"
                  : isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-300" : "bg-white/70 border-slate-200 text-slate-600"
              }`}
            >
              {allFilteredSelected ? "Deseleziona" : "Seleziona"} {filtered.length}
            </button>
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter indicator */}
      {hasActiveFilter && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${th.dim}`}>{filterLabel}</span>
          <span className={`text-[10px] ${th.dim}`}>·</span>
          <span className={`text-[10px] uppercase tracking-wider font-semibold ${th.dim}`}>{sortLabel}</span>
          <span className={`text-[10px] font-mono ${th.dim}`}>({filtered.length})</span>
        </div>
      )}

      {/* === SELECTED FLAGS === */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          {selected.map(c => (
            <button
              key={c.code}
              onClick={() => onRemove(c.code)}
              className="group relative text-2xl leading-none hover:scale-110 transition-transform"
              title={c.name}
            >
              {getCountryFlag(c.code)}
              <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                isDark ? "bg-slate-800 border border-slate-600" : "bg-white border border-slate-300 shadow-sm"
              }`}>
                <X className="w-2 h-2" />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* === COUNTRY LIST (single column) === */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2 pr-2">
          {filtered.map(c => {
            const isSelected = selectedCodes.has(c.code);
            const pCount = partnerCounts[c.code] || 0;
            const cCount = cacheCounts[c.code] || 0;
            const hasDirectoryScan = exploredSet.has(c.code);
            const hasDbOnly = !hasDirectoryScan && pCount > 0;
            const isComplete = hasDirectoryScan && cCount > 0 && pCount >= cCount;
            const cs = completeness?.byCountry?.[c.code];
            const contactsTotal = cs?.total_partners || 0;
            const withEmail = cs?.with_personal_email || 0;
            const withPhone = cs?.with_personal_phone || 0;
            const pctEmail = contactsTotal > 0 ? Math.round((withEmail / contactsTotal) * 100) : 0;
            const dlPct = cCount > 0 ? Math.round((pCount / cCount) * 100) : 0;

            // Card tint based on status
            const cardTint = isSelected
              ? isDark
                ? "bg-sky-950/60 border-sky-400/30 ring-1 ring-sky-400/20 shadow-lg shadow-sky-500/10"
                : "bg-sky-50 border-sky-300 ring-1 ring-sky-300/50 shadow-lg shadow-sky-200/40"
              : isComplete
                ? isDark
                  ? "bg-emerald-950/40 border-emerald-500/20 hover:bg-emerald-950/60 hover:border-emerald-400/30"
                  : "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300"
                : hasDirectoryScan
                  ? isDark
                    ? "bg-slate-800/50 border-slate-600/30 hover:bg-slate-800/70 hover:border-slate-500/40"
                    : "bg-white/70 border-slate-200 hover:bg-white hover:border-slate-300"
                  : hasDbOnly
                    ? isDark
                      ? "bg-amber-950/30 border-amber-500/15 hover:bg-amber-950/50 hover:border-amber-400/25"
                      : "bg-amber-50/50 border-amber-200/60 hover:bg-amber-50 hover:border-amber-300"
                    : isDark
                      ? "bg-slate-900/40 border-slate-700/20 hover:bg-slate-800/40 hover:border-slate-600/30"
                      : "bg-slate-50/50 border-slate-200/60 hover:bg-slate-50 hover:border-slate-300";

            const stripeColor = isComplete
              ? "from-emerald-400 to-teal-500"
              : pCount > 0
                ? pctEmail >= 60 ? "from-emerald-400 to-teal-500" : pctEmail >= 30 ? "from-amber-400 to-orange-500" : "from-rose-400 to-red-500"
                : hasDirectoryScan
                  ? "from-sky-400 to-blue-500"
                  : "from-slate-400 to-slate-500";

            return (
              <button
                key={c.code}
                onClick={() => onToggle(c.code, c.name)}
                className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-300 ${cardTint}`}
              >
                {/* Left accent stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${stripeColor} transition-all duration-300 ${
                  isSelected ? "opacity-100" : "opacity-50 group-hover:opacity-90"
                }`} />

                <div className="relative p-3.5 pl-5">
                  {/* Header: flag + name + status */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl leading-none flex-shrink-0">{getCountryFlag(c.code)}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold truncate ${th.h2}`}>{c.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {isComplete && (
                            <span className={`text-[9px] font-semibold uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                              ✓ Completo
                            </span>
                          )}
                          {!isComplete && hasDirectoryScan && (
                            <span className={`text-[9px] font-mono ${th.dim}`}>
                              {pCount}/{cCount} · {dlPct}%
                            </span>
                          )}
                          {hasDirectoryScan && cCount > 0 && (
                            <span className={`inline-flex items-center gap-0.5 text-[9px] font-mono ${isDark ? "text-sky-400" : "text-sky-600"}`}>
                              <FolderDown className="w-2.5 h-2.5" />
                              {cCount} in directory
                            </span>
                          )}
                          {hasDbOnly && (
                            <span className={`text-[9px] font-mono ${isDark ? "text-amber-400/70" : "text-amber-600/70"}`}>
                              {pCount} partner
                            </span>
                          )}
                          {!hasDirectoryScan && pCount === 0 && (
                            <span className={`text-[9px] ${th.dim}`}>Non esplorato</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: contact stats inline */}
                    {pCount > 0 && (
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <Mail className={`w-3.5 h-3.5 ${withEmail > 0 ? (isDark ? "text-sky-400" : "text-sky-500") : th.dim}`} />
                          <span className={`text-xs font-mono font-bold ${withEmail > 0 ? (isDark ? "text-sky-400" : "text-sky-600") : (isDark ? "text-rose-400" : "text-rose-500")}`}>{withEmail}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className={`w-3.5 h-3.5 ${withPhone > 0 ? (isDark ? "text-teal-400" : "text-teal-500") : th.dim}`} />
                          <span className={`text-xs font-mono font-bold ${withPhone > 0 ? (isDark ? "text-teal-400" : "text-teal-600") : (isDark ? "text-rose-400" : "text-rose-500")}`}>{withPhone}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Users className={`w-3.5 h-3.5 ${th.dim}`} />
                          <span className={`text-xs font-mono font-bold ${th.mono}`}>{pCount}</span>
                        </div>
                      </div>
                    )}

                    {isSelected && (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-sky-500/20" : "bg-sky-100"}`}>
                        <CheckCircle className={`w-3.5 h-3.5 ${isDark ? "text-sky-400" : "text-sky-500"}`} />
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  {pCount > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      <div className={`flex-1 h-1 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pctEmail >= 60
                              ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                              : pctEmail >= 30
                                ? "bg-gradient-to-r from-amber-400 to-orange-500"
                                : "bg-gradient-to-r from-rose-400 to-red-500"
                          }`}
                          style={{ width: `${pctEmail}%` }}
                        />
                      </div>
                      <span className={`text-[9px] font-mono tabular-nums w-8 text-right ${
                        pctEmail >= 60 ? (isDark ? "text-emerald-400" : "text-emerald-600") : pctEmail >= 30 ? (isDark ? "text-amber-400" : "text-amber-600") : (isDark ? "text-rose-400" : "text-rose-500")
                      }`}>
                        {pctEmail}%
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
