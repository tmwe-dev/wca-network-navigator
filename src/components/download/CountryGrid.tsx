import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download, Globe, Search, Users, Mail, Phone, CheckCircle, Activity,
  ArrowDownAZ, ListChecks, X,
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

  const filters = [
    { key: "all" as const, label: "Tutti", count: WCA_COUNTRIES.length, icon: Globe },
    { key: "explored" as const, label: "Scansionati", count: exploredCount, icon: CheckCircle },
    { key: "partial" as const, label: "Parziali", count: partialCount, icon: Activity },
    { key: "missing" as const, label: "Mai esplorati", count: missingCount, icon: Download },
  ];

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* === TOOLBAR === */}
      <div className={`rounded-2xl border p-3 ${isDark ? "bg-white/[0.03] backdrop-blur-xl border-white/[0.08]" : "bg-white/50 backdrop-blur-xl border-white/80 shadow-sm"}`}>
        {/* Row 1: Search + Sort + Select All */}
        <div className="flex items-center gap-2 mb-2.5">
          <div className="relative flex-1">
            <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
            <Input
              placeholder="Cerca paese..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className={`pl-10 h-9 rounded-xl text-sm ${th.input}`}
            />
          </div>

          <Select value={sortBy} onValueChange={v => setSortBy(v as any)}>
            <SelectTrigger className={`w-[150px] h-9 rounded-xl text-xs gap-1 ${th.selTrigger}`}>
              <ArrowDownAZ className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={th.selContent}>
              <SelectItem value="name">Nome A-Z</SelectItem>
              <SelectItem value="partners">N° partner ↓</SelectItem>
              <SelectItem value="completion">Completamento</SelectItem>
            </SelectContent>
          </Select>

          <button
            onClick={handleSelectAll}
            className={`flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-medium transition-all whitespace-nowrap border ${
              allFilteredSelected
                ? isDark ? "bg-sky-500/20 border-sky-500/30 text-sky-300 hover:bg-sky-500/30" : "bg-sky-100 border-sky-300 text-sky-700 hover:bg-sky-200"
                : isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]" : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white shadow-sm"
            }`}
          >
            <ListChecks className="w-3.5 h-3.5" />
            {allFilteredSelected ? "Deseleziona" : "Seleziona"} {filtered.length}
          </button>
        </div>

        {/* Row 2: Filter tabs */}
        <div className={`flex items-center gap-1 p-0.5 rounded-xl ${isDark ? "bg-white/[0.03]" : "bg-slate-100/60"}`}>
          {filters.map(f => {
            const active = filterMode === f.key;
            const Icon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setFilterMode(f.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? isDark
                      ? "bg-white/[0.1] text-white shadow-sm shadow-white/[0.05]"
                      : "bg-white text-slate-800 shadow-sm"
                    : isDark
                      ? "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                      : "text-slate-400 hover:text-slate-600 hover:bg-white/50"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{f.label}</span>
                <span className={`text-[10px] font-mono ${active ? "opacity-70" : "opacity-50"}`}>{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* === SELECTED BADGES === */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`text-[10px] uppercase tracking-wider font-semibold mr-1 ${th.dim}`}>
            {selected.length} selezionati
          </span>
          {selected.slice(0, 12).map(c => (
            <Badge
              key={c.code}
              className={`flex items-center gap-1 cursor-pointer text-[10px] py-0.5 transition-all ${
                isDark
                  ? "bg-sky-500/15 text-sky-300 border-sky-500/25 hover:bg-sky-500/25"
                  : "bg-sky-50 text-sky-700 border-sky-200 hover:bg-sky-100"
              }`}
              onClick={() => onRemove(c.code)}
            >
              {getCountryFlag(c.code)} {c.name} <X className="w-2.5 h-2.5 opacity-50" />
            </Badge>
          ))}
          {selected.length > 12 && (
            <span className={`text-[10px] ${th.dim}`}>+{selected.length - 12} altri</span>
          )}
        </div>
      )}

      {/* === COUNTRY GRID === */}
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

            // Determine the accent color for the left stripe
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
                className={`group relative overflow-hidden rounded-xl border text-left transition-all duration-300 ${
                  isSelected
                    ? isDark
                      ? "bg-sky-500/[0.08] border-sky-400/30 ring-1 ring-sky-400/20 shadow-lg shadow-sky-500/[0.08]"
                      : "bg-sky-50/80 border-sky-300 ring-1 ring-sky-300/50 shadow-lg shadow-sky-200/40"
                    : isDark
                      ? "bg-white/[0.03] backdrop-blur-md border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.15] hover:shadow-xl hover:shadow-sky-500/[0.04]"
                      : "bg-white/50 backdrop-blur-md border-white/70 hover:bg-white/80 hover:border-slate-300 hover:shadow-xl hover:shadow-slate-200/60"
                }`}
              >
                {/* Left accent stripe */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${stripeColor} transition-all duration-300 ${
                  isSelected ? "opacity-100" : "opacity-40 group-hover:opacity-80"
                }`} />

                {/* Hover glow effect */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none ${
                  isDark
                    ? "bg-gradient-to-br from-sky-500/[0.04] via-transparent to-transparent"
                    : "bg-gradient-to-br from-sky-100/30 via-transparent to-transparent"
                }`} />

                <div className="relative p-3 pl-4">
                  {/* Header: flag + name + status */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-2xl leading-none flex-shrink-0">{getCountryFlag(c.code)}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold truncate ${th.h2}`}>{c.name}</p>
                        {/* Status line */}
                        <div className="flex items-center gap-1.5 mt-0.5">
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
                    {isSelected && (
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-sky-500/20" : "bg-sky-100"}`}>
                        <CheckCircle className={`w-3.5 h-3.5 ${isDark ? "text-sky-400" : "text-sky-500"}`} />
                      </div>
                    )}
                  </div>

                  {/* Stats row — compact horizontal layout */}
                  {pCount > 0 && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-3 text-[10px]">
                        <div className="flex items-center gap-1">
                          <Users className={`w-3 h-3 ${th.dim}`} />
                          <span className={th.dim}>Resp.</span>
                          <span className={`font-mono font-bold ${withEmail > 0 || withPhone > 0 ? th.mono : (isDark ? "text-rose-400" : "text-rose-500")}`}>
                            {cs ? Math.max(withEmail, withPhone) : 0}/{pCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Mail className={`w-3 h-3 ${withEmail > 0 ? (isDark ? "text-sky-400" : "text-sky-500") : th.dim}`} />
                          <span className={`font-mono font-bold ${withEmail > 0 ? (isDark ? "text-sky-400" : "text-sky-600") : (isDark ? "text-rose-400" : "text-rose-500")}`}>{withEmail}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Phone className={`w-3 h-3 ${withPhone > 0 ? (isDark ? "text-teal-400" : "text-teal-500") : th.dim}`} />
                          <span className={`font-mono font-bold ${withPhone > 0 ? (isDark ? "text-teal-400" : "text-teal-600") : (isDark ? "text-rose-400" : "text-rose-500")}`}>{withPhone}</span>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="flex items-center gap-2">
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
