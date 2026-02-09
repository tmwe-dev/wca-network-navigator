import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Search } from "lucide-react";
import { usePartners, PartnerFilters } from "@/hooks/usePartners";
import { getCountryFlag } from "@/lib/countries";
import PartnerFiltersSheet from "@/components/partners/PartnerFiltersSheet";
import PartnerCard from "@/components/partners/PartnerCard";
import { useToggleFavorite } from "@/hooks/usePartners";

export default function Partners() {
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<PartnerFilters>({});

  const { data: allPartners } = usePartners({});
  const { data: partners, isLoading } = usePartners({
    search: search.length >= 2 ? search : undefined,
    ...filters,
  });
  const toggleFavorite = useToggleFavorite();

  const uniqueCountries = useMemo(() => {
    if (!allPartners) return [];
    const map = new Map<string, { code: string; name: string; flag: string; count: number }>();
    for (const p of allPartners) {
      const existing = map.get(p.country_code);
      if (existing) {
        existing.count++;
      } else {
        map.set(p.country_code, {
          code: p.country_code,
          name: p.country_name,
          flag: getCountryFlag(p.country_code),
          count: 1,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPartners]);

  const activeFilterCount =
    (filters.partnerTypes?.length || 0) +
    (filters.services?.length || 0) +
    (filters.countries?.length || 0) +
    (filters.favorites ? 1 : 0);

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Search bar */}
        <div className="flex items-center gap-3">
          <PartnerFiltersSheet
            filters={filters}
            setFilters={setFilters}
            countries={uniqueCountries}
            activeFilterCount={activeFilterCount}
          />
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cerca partner per nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Caricamento..." : `${partners?.length || 0} partner trovati`}
        </p>

        {/* Partner cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="w-11 h-11 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : partners?.map((partner) => (
                <PartnerCard
                  key={partner.id}
                  partner={partner}
                  onToggleFavorite={(id, isFav) =>
                    toggleFavorite.mutate({ id, isFavorite: isFav })
                  }
                />
              ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
