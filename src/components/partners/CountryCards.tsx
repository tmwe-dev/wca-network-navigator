import { useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { useCountryStats } from "@/hooks/useCountryStats";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import {
  Search,
  ArrowUpDown,
  Users,
  Phone,
  Mail,
  AlertTriangle,
  Download,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CountryCardsProps {
  onSelectCountry: (countryCode: string) => void;
  onDownloadProfiles?: (countryCode: string) => void;
}

type SortBy = "name" | "total" | "profile_pct";

export function CountryCards({ onSelectCountry, onDownloadProfiles }: CountryCardsProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("total");
  const { data: stats, isLoading } = useCountryStats();

  const countries = useMemo(() => {
    if (!stats?.byCountry) return [];

    return Object.values(stats.byCountry)
      .map((s) => {
        const wcaCountry = WCA_COUNTRIES.find((c) => c.code === s.country_code);
        const profilePct = s.total_partners > 0
          ? Math.round((s.with_profile / s.total_partners) * 100)
          : 0;
        return {
          ...s,
          name: wcaCountry?.name || s.country_code,
          flag: getCountryFlag(s.country_code),
          profilePct,
        };
      });
  }, [stats]);

  const filtered = useMemo(() => {
    let list = countries;

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) => c.name.toLowerCase().includes(q) || c.country_code.toLowerCase().includes(q)
      );
    }

    list = [...list].sort((a, b) => {
      if (sortBy === "total") return b.total_partners - a.total_partners;
      if (sortBy === "profile_pct") return b.profilePct - a.profilePct;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [countries, search, sortBy]);

  const totalPartners = stats?.global.total || 0;
  const totalCountries = countries.length;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/50 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Cerca paese..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 rounded-xl"
          />
        </div>
        <div className="flex items-center justify-between">
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="h-7 text-xs w-[140px]">
              <ArrowUpDown className="w-3 h-3 mr-1 shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="total">Totale partner</SelectItem>
              <SelectItem value="profile_pct">% Profili</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{totalCountries} paesi</span>
            <span>{totalPartners} partner</span>
          </div>
        </div>
      </div>

      {/* Country grid */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filtered.map((country) => {
            const hasGaps = country.without_profile > 0;

            return (
              <div
                key={country.country_code}
                onClick={() => onSelectCountry(country.country_code)}
                className={cn(
                  "p-3 rounded-xl border cursor-pointer transition-all",
                  "hover:bg-accent/50 hover:shadow-md hover:scale-[1.01]",
                  "bg-card border-border/50",
                  hasGaps && "border-l-4 border-l-amber-400"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl shrink-0">{country.flag}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm truncate">{country.name}</p>
                      <span className="text-sm font-bold text-foreground shrink-0 ml-2">
                        {country.total_partners}
                      </span>
                    </div>

                    {/* Profile progress bar */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <Progress
                        value={country.profilePct}
                        className={cn(
                          "h-2 flex-1",
                          country.profilePct >= 90 ? "[&>div]:bg-emerald-500" :
                          country.profilePct >= 50 ? "[&>div]:bg-amber-500" :
                          "[&>div]:bg-destructive"
                        )}
                      />
                      <span className="text-[11px] text-muted-foreground w-8 text-right">
                        {country.profilePct}%
                      </span>
                    </div>

                    {/* Stats row */}
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {country.with_phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" />
                        {country.with_email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {country.with_both} entrambi
                      </span>
                    </div>

                    {/* Missing profiles warning */}
                    {hasGaps && (
                      <div className="flex items-center justify-between mt-2">
                        <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          {country.without_profile} senza profilo
                        </span>
                        {onDownloadProfiles && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadProfiles(country.country_code);
                            }}
                            className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                          >
                            <Download className="w-3 h-3" />
                            Scarica profili
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
