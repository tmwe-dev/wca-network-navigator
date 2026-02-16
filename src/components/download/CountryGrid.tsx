import { useState } from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search, Users, Mail, Phone, CheckCircle, X, FolderDown, Trophy,
  CheckSquare, ArrowDownAZ, BarChart3, Percent, FileWarning,
  AlertTriangle, Download, Globe, Filter, ArrowUpDown, HelpCircle,
  ArrowDown,
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

type FilterKey = "all" | "todo" | "no_profile" | "done" | "missing";
type SortKey = "name" | "partners" | "directory" | "completion";

export function CountryGrid({ selected, onToggle, onRemove, directoryOnly, onDirectoryOnlyChange }: CountryGridProps) {
  const isDark = useTheme();
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterKey>("all");
  const [sortBy, setSortBy] = useState<SortKey>("name");
  const [showEmpty, setShowEmpty] = useState(false);

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

  // Count per filter
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

  // Filter definitions with semantic colors
  const filterDefs: { key: FilterKey; label: string; count: number; icon: any; color: string; activeBg: string }[] = [
    { key: "all", label: "Tutti", count: filtered.length, icon: Globe, color: isDark ? "text-slate-300" : "text-slate-700", activeBg: isDark ? "bg-slate-600/30 border-slate-500/40" : "bg-slate-200 border-slate-400" },
    { key: "todo", label: "Da fare", count: todoCount, icon: AlertTriangle, color: isDark ? "text-blue-300" : "text-blue-700", activeBg: isDark ? "bg-blue-500/20 border-blue-400/40" : "bg-blue-100 border-blue-400" },
    { key: "no_profile", label: "Senza Profilo", count: noProfileCount, icon: FileWarning, color: isDark ? "text-orange-300" : "text-orange-700", activeBg: isDark ? "bg-orange-500/20 border-orange-400/40" : "bg-orange-100 border-orange-400" },
    { key: "done", label: "Completati", count: doneCount, icon: Trophy, color: isDark ? "text-emerald-300" : "text-emerald-700", activeBg: isDark ? "bg-emerald-500/20 border-emerald-400/40" : "bg-emerald-100 border-emerald-400" },
    { key: "missing", label: "Mai esplorati", count: missingCount, icon: HelpCircle, color: isDark ? "text-slate-400" : "text-slate-500", activeBg: isDark ? "bg-slate-700/40 border-slate-500/40" : "bg-slate-200 border-slate-400" },
  ];

  const sortDefs: { key: SortKey; label: string; icon: any }[] = [
    { key: "name", label: "Nome", icon: ArrowDownAZ },
    { key: "partners", label: "Partner", icon: Users },
    { key: "directory", label: "Directory", icon: FolderDown },
    { key: "completion", label: "Complet.", icon: Percent },
  ];

  const sectionBorder = isDark ? "border-white/[0.08]" : "border-slate-200";
  const sectionBg = isDark ? "bg-white/[0.03]" : "bg-white/50";
  const inactiveChip = isDark
    ? "bg-white/[0.03] border-white/[0.08] text-slate-400 hover:bg-white/[0.06]"
    : "bg-white/60 border-slate-200 text-slate-500 hover:bg-white";

  return (
    <div className="flex flex-col gap-2 h-full min-h-0">
      {/* ═══ SEARCH ═══ */}
      <div className="relative flex-shrink-0">
        <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${th.dim}`} />
        <Input
          placeholder="Cerca paese..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={`pl-10 h-10 rounded-xl text-sm ${th.input}`}
        />
      </div>

      {/* ═══ SEZIONE FILTRI ═══ */}
      <div className={`flex-shrink-0 rounded-xl border p-2.5 ${sectionBg} ${sectionBorder}`}>
        <div className="flex items-center gap-1.5 mb-2">
          <Filter className={`w-3.5 h-3.5 ${isDark ? "text-sky-400" : "text-sky-600"}`} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-sky-400" : "text-sky-600"}`}>
            Filtra per stato
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {filterDefs.map(f => {
            const Icon = f.icon;
            const isActive = filterMode === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilterMode(f.key)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  isActive ? `${f.activeBg} ${f.color}` : inactiveChip
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {f.label}
                <span className="font-mono text-[10px] opacity-60">{f.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ SEZIONE ORDINAMENTO ═══ */}
      <div className={`flex-shrink-0 rounded-xl border p-2.5 ${sectionBg} ${sectionBorder}`}>
        <div className="flex items-center gap-1.5 mb-2">
          <ArrowUpDown className={`w-3.5 h-3.5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
          <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-amber-400" : "text-amber-600"}`}>
            Ordina per
          </span>
        </div>
        <div className="flex gap-1">
          {sortDefs.map(s => {
            const Icon = s.icon;
            const isActive = sortBy === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSortBy(s.key)}
                className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  isActive
                    ? isDark ? "bg-amber-500/20 border-amber-400/40 text-amber-300" : "bg-amber-100 border-amber-400 text-amber-700"
                    : inactiveChip
                }`}
              >
                <Icon className="w-3 h-3" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ SELEZIONE + CONTROLLI ═══ */}
      <div className={`flex-shrink-0 rounded-xl border p-2.5 ${sectionBg} ${sectionBorder}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <button
            onClick={handleSelectAll}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
              allFilteredSelected
                ? isDark ? "bg-sky-500/20 border-sky-500/30 text-sky-300" : "bg-sky-100 border-sky-300 text-sky-700"
                : isDark ? "bg-white/[0.05] border-white/[0.1] text-slate-300 hover:bg-white/[0.1]" : "bg-white/70 border-slate-200 text-slate-600 hover:bg-white"
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {allFilteredSelected ? "Deseleziona" : "Seleziona"} ({filtered.length})
          </button>
          <div className="flex-1" />
          {onDirectoryOnlyChange && (
            <label className={`flex items-center gap-1 text-[10px] cursor-pointer ${isDark ? "text-sky-400" : "text-sky-600"}`}>
              <Switch checked={!!directoryOnly} onCheckedChange={onDirectoryOnlyChange} className="scale-75" />
              <FolderDown className="w-3 h-3" /> Dir
            </label>
          )}
          <label className={`flex items-center gap-1 text-[10px] cursor-pointer ${isDark ? "text-slate-400" : "text-slate-500"}`}>
            <Switch checked={showEmpty} onCheckedChange={setShowEmpty} className="scale-75" />
            <Globe className="w-3 h-3" /> Tutti
          </label>
        </div>
        {/* Selected country flags */}
        {selected.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1.5 pt-1.5 border-t ${isDark ? "border-white/[0.06]" : "border-slate-200/60"}`}>
            {selected.map(c => (
              <button
                key={c.code}
                onClick={() => onRemove(c.code)}
                className="group relative text-xl leading-none hover:scale-110 transition-transform"
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
        <div className="flex flex-col gap-2 pr-2">
          {filtered.map(c => <CountryCard key={c.code} country={c} stats={stats} cacheData={cacheData} getStatus={getStatus} isSelected={selectedCodes.has(c.code)} onToggle={onToggle} isDark={isDark} />)}
          {filtered.length === 0 && (
            <div className={`text-center py-8 text-sm ${th.dim}`}>Nessun paese trovato</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
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
  const emailPct = st.pCount > 0 ? Math.round(((s?.with_email || 0) / st.pCount) * 100) : 0;

  // Status badge config
  let statusIcon: any, statusColor: string, statusBg: string, statusLabel: string;
  if (st.isDone) {
    statusIcon = CheckCircle;
    statusColor = isDark ? "text-emerald-400" : "text-emerald-600";
    statusBg = isDark ? "bg-emerald-500/20 border-emerald-500/30" : "bg-emerald-100 border-emerald-300";
    statusLabel = "Completo";
  } else if (st.allDownloaded && !st.allProfiles) {
    statusIcon = FileWarning;
    statusColor = isDark ? "text-orange-400" : "text-orange-600";
    statusBg = isDark ? "bg-orange-500/20 border-orange-500/30" : "bg-orange-100 border-orange-300";
    statusLabel = `${st.noProfile} no profilo`;
  } else if (st.pCount > 0 && st.hasDir) {
    statusIcon = ArrowDown;
    statusColor = isDark ? "text-blue-400" : "text-blue-600";
    statusBg = isDark ? "bg-blue-500/20 border-blue-500/30" : "bg-blue-100 border-blue-300";
    statusLabel = `${dlPct}%`;
  } else if (st.pCount > 0) {
    statusIcon = Users;
    statusColor = isDark ? "text-slate-300" : "text-slate-600";
    statusBg = isDark ? "bg-slate-700/40 border-slate-600/30" : "bg-slate-100 border-slate-300";
    statusLabel = `${st.pCount}`;
  } else {
    statusIcon = HelpCircle;
    statusColor = isDark ? "text-slate-500" : "text-slate-400";
    statusBg = isDark ? "bg-slate-800/40 border-slate-700/30" : "bg-slate-100 border-slate-200";
    statusLabel = "—";
  }

  const StatusIcon = statusIcon;

  const cardBorder = isSelected
    ? isDark ? "border-sky-400/40 ring-1 ring-sky-400/20" : "border-sky-400 ring-1 ring-sky-300/50"
    : isDark ? "border-white/[0.08]" : "border-slate-200";
  const cardBg = isSelected
    ? isDark ? "bg-sky-950/50" : "bg-sky-50/80"
    : isDark ? "bg-white/[0.03] hover:bg-white/[0.06]" : "bg-white/60 hover:bg-white/80";

  return (
    <button
      onClick={() => onToggle(country.code, country.name)}
      className={`group relative rounded-xl border text-left transition-all duration-200 ${cardBg} ${cardBorder}`}
    >
      <div className="flex items-center gap-3 p-3">
        {/* LEFT: Flag + Name */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <span className="text-2xl leading-none flex-shrink-0">{getCountryFlag(country.code)}</span>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold truncate ${isDark ? "text-slate-100" : "text-slate-800"}`}>{country.name}</p>
            {/* Mini stats row */}
            {st.pCount > 0 && (
              <div className="flex items-center gap-3 mt-0.5">
                <span className={`flex items-center gap-1 text-[11px] font-mono ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                  <Users className="w-3 h-3" />{st.pCount}{st.cCount > 0 && `/${st.cCount}`}
                </span>
                <span className={`flex items-center gap-1 text-[11px] font-mono ${(s?.with_email || 0) > 0 ? (isDark ? "text-sky-400" : "text-sky-600") : (isDark ? "text-rose-400/60" : "text-rose-400")}`}>
                  <Mail className="w-3 h-3" />{s?.with_email || 0}
                </span>
                <span className={`flex items-center gap-1 text-[11px] font-mono ${(s?.with_phone || 0) > 0 ? (isDark ? "text-teal-400" : "text-teal-600") : (isDark ? "text-rose-400/60" : "text-rose-400")}`}>
                  <Phone className="w-3 h-3" />{s?.with_phone || 0}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Status badge */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border flex-shrink-0 ${statusBg}`}>
          <StatusIcon className={`w-4 h-4 ${statusColor}`} />
          <span className={`text-xs font-bold ${statusColor}`}>{statusLabel}</span>
        </div>

        {/* Selection indicator */}
        {isSelected && (
          <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-sky-500/30" : "bg-sky-200"}`}>
            <CheckCircle className={`w-3.5 h-3.5 ${isDark ? "text-sky-400" : "text-sky-600"}`} />
          </div>
        )}
      </div>

      {/* Progress bar */}
      {st.pCount > 0 && (
        <div className={`mx-3 mb-2.5 flex items-center gap-2`}>
          <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-slate-200/60"}`}>
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                emailPct >= 80 ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                  : emailPct >= 40 ? "bg-gradient-to-r from-amber-400 to-orange-500"
                  : "bg-gradient-to-r from-rose-400 to-red-500"
              }`}
              style={{ width: `${emailPct}%` }}
            />
          </div>
          <span className={`text-[10px] font-mono w-8 text-right ${
            emailPct >= 80 ? (isDark ? "text-emerald-400" : "text-emerald-600")
              : emailPct >= 40 ? (isDark ? "text-amber-400" : "text-amber-600")
              : (isDark ? "text-rose-400" : "text-rose-500")
          }`}>
            {emailPct}%
          </span>
        </div>
      )}
    </button>
  );
}
