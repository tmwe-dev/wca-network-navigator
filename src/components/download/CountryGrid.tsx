import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

import {
  Search, CheckCircle, X, CheckSquare,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountryStats } from "@/hooks/useCountryStats";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { getCountryFlag } from "@/lib/countries";
import { useTheme, t } from "./theme";

export type FilterKey = "all" | "todo" | "no_profile" | "done" | "missing";

interface CountryGridProps {
  selected: { code: string; name: string }[];
  onToggle: (code: string, name: string) => void;
  onRemove: (code: string) => void;
  filterMode: FilterKey;
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
}

type SortKey = "name" | "partners" | "directory" | "completion";

export function CountryGrid({ selected, onToggle, onRemove, filterMode }: CountryGridProps) {
  const isDark = useTheme();
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("name");

  const { data: statsData } = useCountryStats();
  const stats = statsData?.byCountry || {};

  const { data: cacheData = {} } = useQuery({
    queryKey: ["cache-data-by-country"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_directory_counts");
      const result: Record<string, { count: number; verified: boolean }> = {};
      (data || []).forEach((r: any) => {
        result[r.country_code] = { count: Number(r.member_count) || 0, verified: r.is_verified === true };
      });
      return result;
    },
    staleTime: 60_000,
  });

  const selectedCodes = new Set(selected.map(c => c.code));
  const exploredSet = new Set(Object.keys(cacheData));

  const getStatus = (code: string) => {
    const s = stats[code];
    const c = cacheData[code];
    const pCount = s?.total_partners || 0;
    const cCount = c?.count || 0;
    const hasDir = exploredSet.has(code);
    const withProfile = s?.with_profile || 0;
    const noProfile = s?.without_profile || 0;
    const allDownloaded = hasDir && cCount > 0 && pCount >= cCount;
    const allProfiles = pCount > 0 && noProfile === 0;
    const isDone = allDownloaded && allProfiles;
    const isTodo = pCount === 0 || !allDownloaded || !allProfiles;
    return { pCount, cCount, hasDir, withProfile, noProfile, allDownloaded, allProfiles, isDone, isTodo };
  };

  // Counts for filter labels
  let doneCount = 0, todoCount = 0, noProfileCount = 0, missingCount = 0, totalWithData = 0;
  WCA_COUNTRIES.forEach(c => {
    const st = getStatus(c.code);
    if (st.isDone) doneCount++;
    if (st.isTodo && (st.pCount > 0 || exploredSet.has(c.code))) todoCount++;
    if (st.noProfile > 0) noProfileCount++;
    if (!exploredSet.has(c.code) && st.pCount === 0) missingCount++;
    if (st.pCount > 0 || exploredSet.has(c.code)) totalWithData++;
  });

  const filtered = WCA_COUNTRIES.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    const st = getStatus(c.code);
    // Show countries with data or selected, hide empty unless filter=missing
    if (filterMode !== "missing" && !cacheData[c.code] && st.pCount === 0 && !selectedCodes.has(c.code)) return false;
    if (filterMode === "done") return st.isDone;
    if (filterMode === "todo") return st.isTodo && (st.pCount > 0 || exploredSet.has(c.code));
    if (filterMode === "no_profile") return st.noProfile > 0;
    if (filterMode === "missing") return !exploredSet.has(c.code) && st.pCount === 0;
    return true;
  }).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    const sA = stats[a.code], sB = stats[b.code];
    if (sortBy === "partners") return (sB?.total_partners || 0) - (sA?.total_partners || 0);
    if (sortBy === "directory") return (cacheData[b.code]?.count || 0) - (cacheData[a.code]?.count || 0);
    const cA = cacheData[a.code]?.count || 0, cB = cacheData[b.code]?.count || 0;
    const pctA = cA > 0 ? (sA?.total_partners || 0) / cA : -1;
    const pctB = cB > 0 ? (sB?.total_partners || 0) / cB : -1;
    return pctA - pctB;
  });

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selectedCodes.has(c.code));
  const handleSelectAll = () => {
    filtered.forEach(c => {
      if (allFilteredSelected) { if (selectedCodes.has(c.code)) onToggle(c.code, c.name); }
      else { if (!selectedCodes.has(c.code)) onToggle(c.code, c.name); }
    });
  };


  const sortLabel = (key: SortKey) => {
    switch (key) {
      case "name": return "Nome A-Z";
      case "partners": return "N° Partner";
      case "directory": return "Directory";
      case "completion": return "% Complet.";
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 gap-1.5">
      {/* ═══ TOOLBAR: Search + Filter dropdown + Sort dropdown ═══ */}
      <div className="flex-shrink-0 space-y-1.5">
        {/* Row 1: Search */}
        <div className="relative">
          <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${th.dim}`} />
          <Input
            placeholder="Cerca paese..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`pl-8 h-8 rounded-lg text-xs ${th.input}`}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className={`h-7 text-[11px] w-[110px] flex-shrink-0 ${isDark ? "bg-white/[0.04] border-white/[0.1] text-slate-200" : "bg-white/70 border-slate-200 text-slate-700"}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["name", "partners", "directory", "completion"] as SortKey[]).map(k => (
                <SelectItem key={k} value={k} className="text-xs">{sortLabel(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={handleSelectAll}
            className={`flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold border transition-all flex-shrink-0 ${
              allFilteredSelected
                ? isDark ? "bg-sky-500/20 border-sky-500/30 text-sky-300" : "bg-sky-100 border-sky-300 text-sky-700"
                : isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]" : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white"
            }`}
            title="Seleziona tutti i visibili"
          >
            <CheckSquare className="w-3 h-3" />
            <span className="font-mono">{filtered.length}</span>
          </button>
        </div>

        {/* Selected flags */}
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {selected.map(c => (
              <button
                key={c.code}
                onClick={() => onRemove(c.code)}
                className="group relative text-lg leading-none hover:scale-110 transition-transform"
                title={c.name}
              >
                {getCountryFlag(c.code)}
                <span className={`absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${
                  isDark ? "bg-slate-800 border border-slate-600" : "bg-white border border-slate-300 shadow-sm"
                }`}>
                  <X className="w-2 h-2" />
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ═══ COUNTRY LIST ═══ */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-1 pr-2">
          {filtered.map(c => (
            <CountryCard
              key={c.code}
              country={c}
              stats={stats}
              cacheData={cacheData}
              getStatus={getStatus}
              isSelected={selectedCodes.has(c.code)}
              onToggle={onToggle}
              isDark={isDark}
            />
          ))}
          {filtered.length === 0 && (
            <div className={`text-center py-8 text-sm ${th.dim}`}>Nessun paese trovato</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

/* ═══ Coverage color helper ═══ */
function coverageColor(count: number, total: number, isDark: boolean) {
  if (total === 0 || count === 0) return isDark ? "text-rose-400/60" : "text-rose-400";
  const pct = count / total;
  if (pct >= 0.8) return isDark ? "text-emerald-400" : "text-emerald-600";
  if (pct >= 0.5) return isDark ? "text-amber-400" : "text-amber-600";
  return isDark ? "text-rose-400" : "text-rose-500";
}

/* ═══ COUNTRY CARD ═══ */
function CountryCard({ country, stats, cacheData, getStatus, isSelected, onToggle, isDark }: {
  country: { code: string; name: string };
  stats: Record<string, any>;
  cacheData: Record<string, { count: number; verified: boolean }>;
  getStatus: (code: string) => any;
  isSelected: boolean;
  onToggle: (code: string, name: string) => void;
  isDark: boolean;
}) {
  const st = getStatus(country.code);
  const s = stats[country.code];
  const dlPct = st.cCount > 0 ? Math.round((st.pCount / st.cCount) * 100) : 0;
  const missing = st.cCount > 0 ? st.cCount - st.pCount : 0;

  // Unified badge: 🟢 complete | 🟡 downloaded but missing profiles | 🟡 partial | 🔴 0% | ⚪ no data
  let dotColor: string, label: string, tooltip: string;
  if (st.cCount > 0 && dlPct >= 100 && st.noProfile === 0) {
    dotColor = "bg-emerald-500";
    label = "100%";
    tooltip = `Tutti i ${st.cCount} partner scaricati e completi`;
  } else if (st.cCount > 0 && dlPct >= 100 && st.noProfile > 0) {
    dotColor = "bg-amber-500";
    label = "100%↓";
    tooltip = `Tutti scaricati — ${st.noProfile} senza profilo`;
  } else if (st.cCount > 0 && st.pCount > 0) {
    dotColor = "bg-amber-500";
    label = `${dlPct}%`;
    tooltip = `${st.pCount} di ${st.cCount} scaricati — ${missing} mancanti`;
  } else if (st.cCount > 0 && st.pCount === 0) {
    dotColor = "bg-rose-500";
    label = `0/${st.cCount}`;
    tooltip = `${st.cCount} partner in directory, nessuno ancora scaricato`;
  } else {
    dotColor = isDark ? "bg-slate-700" : "bg-slate-300";
    label = "—";
    tooltip = "Nessun dato in directory";
  }

  const cardBorder = isSelected
    ? isDark ? "border-sky-400/40 ring-1 ring-sky-400/20" : "border-sky-400 ring-1 ring-sky-300/50"
    : isDark ? "border-white/[0.06]" : "border-slate-200/80";
  const cardBg = isSelected
    ? isDark ? "bg-sky-950/50" : "bg-sky-50/80"
    : isDark ? "bg-white/[0.02] hover:bg-white/[0.05]" : "bg-white/50 hover:bg-white/70";

  return (
    <button
      onClick={() => onToggle(country.code, country.name)}
      className={`group rounded-lg border text-left transition-all duration-150 ${cardBg} ${cardBorder}`}
      title={tooltip}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="text-lg leading-none flex-shrink-0">{getCountryFlag(country.code)}</span>
        <div className="min-w-0 flex-1">
          <p className={`text-[11px] font-semibold truncate ${isDark ? "text-slate-100" : "text-slate-800"}`}>{country.name}</p>
          {st.pCount > 0 && (
            <p className={`text-[9px] font-mono mt-0.5 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              {st.pCount}{st.cCount > 0 ? `/${st.cCount}` : ""} · ✉{s?.with_email || 0} · ☎{s?.with_phone || 0}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className={`text-[10px] font-bold font-mono ${isDark ? "text-slate-300" : "text-slate-600"}`}>{label}</span>
        </div>
        {isSelected && (
          <CheckCircle className={`w-3.5 h-3.5 flex-shrink-0 ${isDark ? "text-sky-400" : "text-sky-600"}`} />
        )}
      </div>
    </button>
  );
}
