import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Search, CheckCircle, X, CheckSquare, Mail, Phone, RefreshCw, Loader2,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCountryStats } from "@/hooks/useCountryStats";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import { getCountryFlag } from "@/lib/countries";
import { useTheme, t } from "./theme";
import { toast } from "sonner";

export type FilterKey = "all" | "no_profile" | "no_email" | "no_phone" | "no_deep";

interface CountryGridProps {
  selected: { code: string; name: string }[];
  onToggle: (code: string, name: string) => void;
  onRemove: (code: string) => void;
  filterMode: FilterKey;
  directoryStats?: Record<string, { count: number; verified: boolean }>;
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
  compact?: boolean;
}

type SortKey = "name" | "partners";

export function CountryGrid({ selected, onToggle, onRemove, filterMode, directoryStats, compact = false }: CountryGridProps) {
  const isDark = useTheme();
  const th = t(isDark);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("partners");
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = useCallback(() => {
    window.dispatchEvent(new CustomEvent("sync-wca-trigger"));
  }, []);

  const { data: statsData, isLoading: statsLoading, isError: statsError } = useCountryStats();
  const stats = statsData?.byCountry || {};
  const hasPartnerStats = Object.keys(stats).length > 0;
  const hasDirectoryStats = !!directoryStats && Object.keys(directoryStats).length > 0;
  const selectedCodes = new Set(selected.map(c => c.code));

  const countriesWithPartners = (hasPartnerStats
    ? WCA_COUNTRIES.filter(c => (stats[c.code]?.total_partners || 0) > 0 || selectedCodes.has(c.code))
    : hasDirectoryStats
      ? WCA_COUNTRIES.filter(c => (directoryStats?.[c.code]?.count || 0) > 0 || selectedCodes.has(c.code))
      : WCA_COUNTRIES
  );

  const filtered = countriesWithPartners.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (!hasPartnerStats) return true;
    const s = stats[c.code];
    if (!s || s.total_partners === 0) return selectedCodes.has(c.code);
    if (filterMode === "no_profile") return s.without_profile > 0;
    if (filterMode === "no_email") return (s.total_partners - s.with_email) > 0;
    if (filterMode === "no_phone") return (s.total_partners - s.with_phone) > 0;
    if (filterMode === "no_deep") return (s.total_partners - s.with_deep_search) > 0;
    return true;
  }).sort((a, b) => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (hasPartnerStats) return (stats[b.code]?.total_partners || 0) - (stats[a.code]?.total_partners || 0);
    if (hasDirectoryStats) return (directoryStats?.[b.code]?.count || 0) - (directoryStats?.[a.code]?.count || 0);
    return a.name.localeCompare(b.name);
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
      case "partners": return hasPartnerStats ? "N° Partner" : hasDirectoryStats ? "N° Directory" : "Nome A-Z";
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden gap-1.5">
      <div className="flex-shrink-0 space-y-1.5">
        {/* Compact search inline */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cerca paese..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-8 text-xs pl-8 pr-7"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Select value={sortBy} onValueChange={v => setSortBy(v as SortKey)}>
            <SelectTrigger className="h-7 text-[11px] w-[110px] flex-shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["name", "partners"] as SortKey[]).map(k => (
                <SelectItem key={k} value={k} className="text-xs">{sortLabel(k)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={handleSelectAll}
            className={cn(
              "flex items-center gap-0.5 px-2 py-1 rounded-md text-[10px] font-semibold border transition-all flex-shrink-0",
              allFilteredSelected
                ? "bg-primary/20 border-primary/30 text-primary"
                : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
            )}
            title="Seleziona tutti i visibili"
          >
            <CheckSquare className="w-3 h-3" />
            <span className="font-mono">{filtered.length}</span>
          </button>
        </div>

        {selected.length > 0 && (
          <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
            {selected.map(c => (
              <button
                key={c.code}
                onClick={() => onRemove(c.code)}
                className="group relative text-lg leading-none hover:scale-110 transition-transform"
                title={c.name}
              >
                {getCountryFlag(c.code)}
                <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-card border border-border shadow-sm">
                  <X className="w-2 h-2" />
                </span>
              </button>
            ))}
          </div>
        )}

        {!hasPartnerStats && (
          <div className="px-1 text-[10px] text-muted-foreground">
            {statsLoading
              ? "Carico statistiche partner… puoi già selezionare un paese."
              : statsError
                ? "Statistiche partner non disponibili: uso la lista paesi di fallback."
                : "Statistiche partner non ancora disponibili: puoi comunque selezionare un paese."}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col gap-1 pr-1">
          {filtered.map(c => (
            <CountryCard
              key={c.code}
              country={c}
              stats={stats}
              fallbackCount={directoryStats?.[c.code]?.count || 0}
              hasPartnerStats={hasPartnerStats}
              isSelected={selectedCodes.has(c.code)}
              onToggle={onToggle}
              isDark={isDark}
            />
          ))}
          {filtered.length === 0 && (
            <div className={`text-center py-8 text-sm ${th.dim}`}>
              {search ? "Nessun paese corrisponde alla ricerca" : "Nessun paese disponibile"}
            </div>
          )}
        </div>
      </div>

      <div className="flex-shrink-0 pt-1.5">
        <Button
          size="sm"
          variant="outline"
          onClick={handleSync}
          disabled={syncing}
          className="w-full h-8 text-[11px] gap-1.5 font-semibold"
        >
          {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {syncing ? "Sincronizzazione..." : "Sincronizza WCA"}
        </Button>
      </div>
    </div>
  );
}

function CountryCard({ country, stats, fallbackCount, hasPartnerStats, isSelected, onToggle, isDark }: {
  country: { code: string; name: string };
  stats: Record<string, any>;
  fallbackCount: number;
  hasPartnerStats: boolean;
  isSelected: boolean;
  onToggle: (code: string, name: string) => void;
  isDark: boolean;
}) {
  const s = stats[country.code];
  const pCount = hasPartnerStats ? (s?.total_partners || 0) : fallbackCount;
  const withEmail = s?.with_email || 0;
  const withPhone = s?.with_phone || 0;
  const withProfile = s?.with_profile || 0;
  const noProfile = s?.without_profile || 0;

  let dotColor: string;
  if (pCount === 0) {
    dotColor = "bg-muted-foreground/30";
  } else if (!hasPartnerStats) {
    dotColor = "bg-primary";
  } else if (noProfile === 0 && withEmail === pCount) {
    dotColor = "bg-emerald-500";
  } else {
    const completeness = (withProfile + withEmail) / (pCount * 2);
    dotColor = completeness >= 0.5 ? "bg-primary" : "bg-destructive";
  }

  return (
    <button
      onClick={() => onToggle(country.code, country.name)}
      className={cn(
        "group rounded-lg border text-left transition-all duration-150",
        isSelected
          ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20"
          : "bg-card border-border hover:bg-muted/50"
      )}
    >
      <div className="flex items-center gap-2 px-2 py-1.5">
        <span className="text-lg leading-none flex-shrink-0">{getCountryFlag(country.code)}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold truncate text-foreground">{country.name}</p>
          {pCount > 0 && (
            <p className="text-[9px] font-mono mt-0.5 text-muted-foreground">
              {hasPartnerStats
                ? <>{pCount} <Mail className="inline w-2.5 h-2.5 -mt-px" />{withEmail} <Phone className="inline w-2.5 h-2.5 -mt-px" />{withPhone}</>
                : <>{pCount} disponibili</>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          <span className="text-[10px] font-bold font-mono text-foreground">{pCount}</span>
        </div>
        {isSelected && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0 text-primary" />}
      </div>
    </button>
  );
}
