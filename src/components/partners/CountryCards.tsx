import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { useCountryStats } from "@/hooks/useCountryStats";
import { WCA_COUNTRIES } from "@/data/wcaCountries";

export type CountrySortBy = "name" | "total";

interface CountryCardsProps {
  onSelectCountry: (countryCode: string) => void;
  search: string;
  sortBy: CountrySortBy;
}

export function CountryCards({ onSelectCountry, search, sortBy }: CountryCardsProps) {
  const { data: stats, isLoading } = useCountryStats();

  const countries = useMemo(() => {
    if (!stats?.byCountry) return [];
    return Object.values(stats.byCountry).map((s) => {
      const wcaCountry = WCA_COUNTRIES.find((c) => c.code === s.country_code);
      return {
        ...s,
        name: wcaCountry?.name || s.country_code,
        flag: getCountryFlag(s.country_code),
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
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [countries, search, sortBy]);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
        <div className="p-3 space-y-1.5">
          {filtered.map((country) => (
            <div
              key={country.country_code}
              onClick={() => onSelectCountry(country.country_code)}
              className={cn(
                "px-3 py-2.5 rounded-xl border cursor-pointer transition-all",
                "hover:bg-accent/50 hover:shadow-md hover:scale-[1.01]",
                "bg-card border-border/50",
              )}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl shrink-0">{country.flag}</span>
                <p className="font-semibold text-sm truncate flex-1 min-w-0">{country.name}</p>
                <span className="text-base font-bold text-foreground shrink-0 tabular-nums bg-muted/60 px-2.5 py-0.5 rounded-lg">
                  {country.total_partners.toLocaleString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
  );
}
