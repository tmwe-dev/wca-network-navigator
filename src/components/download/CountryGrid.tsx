import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Download, Globe, Search, Users, Mail, Phone, CheckCircle, Activity,
  X, FolderDown, Trophy, CheckSquare, ArrowDownAZ, BarChart3, Percent,
  FileWarning, AlertTriangle,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountryStats } from "@/hooks/useCountryStats";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { getCountryFlag } from "@/lib/countries";
import { useTheme, t } from "./theme";

interface CountryGridProps {
  selected: { code: string; name: string }[];
  onToggle: (code: string, name: string) => void;
  onRemove: (code: string) => void;
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
}

export function CountryGrid({ selected, onToggle, onRemove, directoryOnly, onDirectoryOnlyChange }: CountryGridProps) {
  const isDark = useTheme();
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "todo" | "done" | "no_profile" | "missing">("all");
  const [sortBy, setSortBy] = useState<"name" | "partners" | "directory" | "completion">("name");
  const [showEmpty, setShowEmpty] = useState(false);

  // Single server-side aggregation — accurate counts, no 1000-row limit
  const { data: statsData } = useCountryStats();
  const stats = statsData?.byCountry || {};

  // Directory cache counts
  const { data: cacheData = {} } = useQuery({
    queryKey: ["cache-data-by-country"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_directory_counts");
      const result: Record<string, { count: number; verified: boolean }> = {};
      (data || []).forEach((r: any) => {
        result[r.country_code] = {
          count: Number(r.member_count) || 0,
          verified: r.is_verified === true,
        };
      });
      return result;
    },
    staleTime: 60_000,
  });

  const selectedCodes = new Set(selected.map(c => c.code));
  const exploredSet = new Set(Object.keys(cacheData));

  // Derive status per country
  const getStatus = (code: string) => {
    const s = stats[code];
    const c = cacheData[code];
    const pCount = s?.total_partners || 0;
    const cCount = c?.count || 0;
    const hasDir = exploredSet.has(code);
    const hasProfile = s?.with_profile || 0;
    const noProfile = s?.without_profile || 0;

    // "done" = downloaded all from directory AND all have profiles
    const allDownloaded = hasDir && cCount > 0 && pCount >= cCount;
    const allProfiles = pCount > 0 && noProfile === 0;
    const isDone = allDownloaded && allProfiles;

    // "todo" = anything that still needs work (missing downloads OR missing profiles)
    const isTodo = pCount === 0 || !allDownloaded || !allProfiles;

    return { pCount, cCount, hasDir, hasProfile, noProfile, allDownloaded, allProfiles, isDone, isTodo };
  };

  // Count filters
  let doneCount = 0, todoCount = 0, noProfileCount = 0, missingCount = 0;
  WCA_COUNTRIES.forEach(c => {
    const st = getStatus(c.code);
    if (st.isDone) doneCount++;
    if (st.isTodo && (st.pCount > 0 || exploredSet.has(c.code))) todoCount++;
    if (st.noProfile > 0) noProfileCount++;
    if (!exploredSet.has(c.code) && st.pCount === 0) missingCount++;
  });

  const filtered = WCA_COUNTRIES.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;

    const st = getStatus(c.code);
    if (!showEmpty && !cacheData[c.code] && st.pCount === 0 && !selectedCodes.has(c.code)) return false;

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
    // completion: sort by % downloaded ascending (show least complete first)
    const cA = cacheData[a.code]?.count || 0, cB = cacheData[b.code]?.count || 0;
    const pctA = cA > 0 ? (sA?.total_partners || 0) / cA : -1;
    const pctB = cB > 0 ? (sB?.total_partners || 0) / cB : -1;
    return pctA - pctB;
  });

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
    { key: "all" as const, label: "Tutti", count: filtered.length, icon: Globe },
    { key: "todo" as const, label: "Da fare", count: todoCount, icon: AlertTriangle },
    { key: "no_profile" as const, label: "Senza Profilo", count: noProfileCount, icon: FileWarning },
    { key: "done" as const, label: "Completati", count: doneCount, icon: Trophy },
    { key: "missing" as const, label: "Mai esplorati", count: missingCount, icon: Download },
  ];

  const sorts = [
    { key: "name" as const, label: "Nome", icon: ArrowDownAZ },
    { key: "partners" as const, label: "Partner", icon: Users },
    { key: "directory" as const, label: "Directory", icon: FolderDown },
    { key: "completion" as const, label: "Completamento", icon: Percent },
  ];

  const chipBase = `px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border`;
  const chipActive = isDark
    ? "bg-sky-500/20 border-sky-500/30 text-sky-300 shadow-sm shadow-sky-500/10"
    : "bg-sky-100 border-sky-300 text-sky-700 shadow-sm";
  const chipInactive = isDark
    ? "bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06] hover:text-slate-300"
    : "bg-white/50 border-slate-200 text-slate-500 hover:bg-white hover:text-slate-700";

  return (
    <div className="flex flex-col gap-3 h-full min-h-0">
      {/* === SEARCH === */}
      <div className="relative">
        <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${th.dim}`} />
        <Input
          placeholder="Cerca paese..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`pl-12 h-11 rounded-2xl text-base ${th.input}`}
        />
      </div>

      {/* === FILTER CHIPS === */}
      <div className="flex flex-wrap gap-1.5">
        {filters.map(f => {
          const Icon = f.icon;
          return (
            <button
              key={f.key}
              onClick={() => setFilterMode(f.key)}
              className={`${chipBase} ${filterMode === f.key ? chipActive : chipInactive} flex items-center gap-1.5`}
            >
              <Icon className="w-3.5 h-3.5" />
              {f.label}
              <span className="font-mono text-[10px] opacity-70">{f.count}</span>
            </button>
          );
        })}
      </div>

      {/* === SORT BUTTONS === */}
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] uppercase tracking-wider font-semibold mr-1 ${th.dim}`}>Ordina:</span>
        {sorts.map(s => {
          const Icon = s.icon;
          return (
            <button
              key={s.key}
              onClick={() => setSortBy(s.key)}
              className={`${chipBase} ${sortBy === s.key ? chipActive : chipInactive} flex items-center gap-1 py-1`}
            >
              <Icon className="w-3 h-3" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* === CONTROLS: Select All + Flags === */}
      <div className="flex items-center gap-2">
        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 items-center flex-1 min-w-0">
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
        {selected.length === 0 && <div className="flex-1" />}

        <button
          onClick={handleSelectAll}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold transition-all border whitespace-nowrap ${
            allFilteredSelected
              ? isDark ? "bg-sky-500/20 border-sky-500/30 text-sky-300" : "bg-sky-100 border-sky-300 text-sky-700"
              : isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]" : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white shadow-sm"
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          {allFilteredSelected ? "Deseleziona" : "Seleziona"} ({filtered.length})
        </button>

        {onDirectoryOnlyChange && (
          <label className={`flex items-center gap-1.5 text-[10px] cursor-pointer whitespace-nowrap ${isDark ? "text-sky-400" : "text-sky-600"}`}>
            <Switch checked={!!directoryOnly} onCheckedChange={onDirectoryOnlyChange} className="scale-75" />
            <FolderDown className="w-3 h-3" />
            Solo Dir
          </label>
        )}
        <label className={`flex items-center gap-1.5 text-[10px] cursor-pointer whitespace-nowrap ${isDark ? "text-slate-400" : "text-slate-500"}`}>
          <Switch checked={showEmpty} onCheckedChange={setShowEmpty} className="scale-75" />
          <Globe className="w-3 h-3" />
          Tutti
        </label>
      </div>

      {/* === COUNTRY LIST === */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="flex flex-col gap-2.5 pr-2">
          {filtered.map(c => {
            const st = getStatus(c.code);
            const isSelected = selectedCodes.has(c.code);
            const s = stats[c.code];
            const dlPct = st.cCount > 0 ? Math.round((st.pCount / st.cCount) * 100) : 0;
            const emailPct = st.pCount > 0 ? Math.round(((s?.with_email || 0) / st.pCount) * 100) : 0;

            // Card color based on status
            const cardTint = isSelected
              ? isDark
                ? "bg-sky-950/60 border-sky-400/30 ring-1 ring-sky-400/20 shadow-lg shadow-sky-500/10"
                : "bg-sky-50 border-sky-300 ring-1 ring-sky-300/50 shadow-lg shadow-sky-200/40"
              : st.isDone
                ? isDark
                  ? "bg-emerald-950/40 border-emerald-500/20 hover:bg-emerald-950/60"
                  : "bg-emerald-50/60 border-emerald-200 hover:bg-emerald-50"
                : st.allDownloaded && !st.allProfiles
                  ? isDark
                    ? "bg-amber-950/30 border-amber-500/20 hover:bg-amber-950/50"
                    : "bg-amber-50/50 border-amber-200 hover:bg-amber-50"
                  : st.pCount > 0
                    ? isDark
                      ? "bg-slate-800/50 border-slate-600/30 hover:bg-slate-800/70"
                      : "bg-white/70 border-slate-200 hover:bg-white"
                    : isDark
                      ? "bg-slate-900/40 border-slate-700/20 hover:bg-slate-800/40"
                      : "bg-slate-50/50 border-slate-200/60 hover:bg-slate-50";

            const stripeColor = st.isDone
              ? "from-emerald-400 to-teal-500"
              : st.allDownloaded
                ? "from-amber-400 to-orange-500"
                : st.pCount > 0
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

                <div className="relative p-4 pl-6">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-3xl leading-none flex-shrink-0">{getCountryFlag(c.code)}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-base font-bold truncate ${th.h2}`}>{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {/* Status badge */}
                          {st.isDone && (
                            <span className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>
                              <Trophy className={`w-4 h-4 ${isDark ? "text-amber-400" : "text-amber-500"}`} />
                              Completo
                            </span>
                          )}
                          {st.allDownloaded && !st.allProfiles && (
                            <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold ${
                              isDark ? "bg-orange-500/20 border border-orange-400/40 text-orange-300" : "bg-orange-100 border border-orange-300 text-orange-700"
                            }`}>
                              <FileWarning className="w-3.5 h-3.5" />
                              {st.noProfile} senza profilo
                            </span>
                          )}
                          {!st.allDownloaded && st.hasDir && (
                            <span className={`text-xs font-mono ${th.dim}`}>
                              {st.pCount}/{st.cCount} scaricati · {dlPct}%
                            </span>
                          )}
                          {!st.hasDir && st.pCount > 0 && (
                            <span className={`text-xs font-mono ${isDark ? "text-amber-400/70" : "text-amber-600/70"}`}>
                              {st.pCount} partner (no directory)
                            </span>
                          )}
                          {!st.hasDir && st.pCount === 0 && (
                            <span className={`text-xs ${th.dim}`}>Non esplorato</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right side stats */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {st.hasDir && st.cCount > 0 && (
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${
                          isDark ? "bg-sky-500/15 border border-sky-500/25" : "bg-sky-50 border border-sky-200"
                        }`}>
                          <FolderDown className={`w-5 h-5 ${isDark ? "text-sky-400" : "text-sky-500"}`} />
                          <span className={`text-lg font-mono font-extrabold ${isDark ? "text-sky-300" : "text-sky-700"}`}>{st.cCount}</span>
                        </div>
                      )}
                      {st.pCount > 0 && (
                        <div className="flex items-center gap-3">
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isDark ? "bg-white/[0.04]" : "bg-slate-50"}`}>
                            <Mail className={`w-4 h-4 ${(s?.with_email || 0) > 0 ? (isDark ? "text-sky-400" : "text-sky-500") : th.dim}`} />
                            <span className={`text-sm font-mono font-bold ${(s?.with_email || 0) > 0 ? (isDark ? "text-sky-400" : "text-sky-600") : (isDark ? "text-rose-400" : "text-rose-500")}`}>{s?.with_email || 0}</span>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isDark ? "bg-white/[0.04]" : "bg-slate-50"}`}>
                            <Phone className={`w-4 h-4 ${(s?.with_phone || 0) > 0 ? (isDark ? "text-teal-400" : "text-teal-500") : th.dim}`} />
                            <span className={`text-sm font-mono font-bold ${(s?.with_phone || 0) > 0 ? (isDark ? "text-teal-400" : "text-teal-600") : (isDark ? "text-rose-400" : "text-rose-500")}`}>{s?.with_phone || 0}</span>
                          </div>
                          <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${isDark ? "bg-white/[0.04]" : "bg-slate-50"}`}>
                            <Users className={`w-4 h-4 ${th.dim}`} />
                            <span className={`text-sm font-mono font-bold ${th.mono}`}>{st.pCount}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {isSelected && (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-sky-500/20" : "bg-sky-100"}`}>
                        <CheckCircle className={`w-4 h-4 ${isDark ? "text-sky-400" : "text-sky-500"}`} />
                      </div>
                    )}
                  </div>

                  {/* Progress bar — email coverage */}
                  {st.pCount > 0 && (
                    <div className="flex items-center gap-2 mt-2.5">
                      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            emailPct >= 60
                              ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                              : emailPct >= 30
                                ? "bg-gradient-to-r from-amber-400 to-orange-500"
                                : "bg-gradient-to-r from-rose-400 to-red-500"
                          }`}
                          style={{ width: `${emailPct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono tabular-nums w-10 text-right ${
                        emailPct >= 60 ? (isDark ? "text-emerald-400" : "text-emerald-600") : emailPct >= 30 ? (isDark ? "text-amber-400" : "text-amber-600") : (isDark ? "text-rose-400" : "text-rose-500")
                      }`}>
                        {emailPct}%
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
