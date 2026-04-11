/**
 * NetworkPage — Partner hub with country grid, BCA view, infinite scroll, export
 */
import * as React from "react";
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { usePartnersInfinite, useToggleFavoriteV2 } from "@/v2/hooks/usePartnersV2";
import { usePartnerFacets } from "@/v2/hooks/usePartnerFacets";
import { useCountryStatsV2 } from "@/v2/hooks/useCountryStatsV2";
import { useExcelExportV2 } from "@/v2/hooks/useExcelExportV2";
import { SearchBar } from "../molecules/SearchBar";
import { PartnerFiltersPanel, type PartnerFilterValues } from "../organisms/PartnerFiltersPanel";
import { PartnerDetailDrawer } from "../organisms/PartnerDetailDrawer";
import { CountryGridV2 } from "../organisms/network/CountryGridV2";
import { BusinessCardsViewV2 } from "../organisms/network/BusinessCardsViewV2";
import { StatusBadge } from "../atoms/StatusBadge";
import { EmptyState } from "../atoms/EmptyState";
import { Button } from "../atoms/Button";
import { partnerCompletenessScore } from "@/v2/core/domain/rules/partner-rules";
import type { PartnerV2 } from "@/v2/core/domain/partner-entity";
import { Filter, Star, Download, Loader2, Grid3X3, List, CreditCard } from "lucide-react";

type ViewMode = "list" | "grid" | "bca";

export function NetworkPage(): React.ReactElement {
  const [filterValues, setFilterValues] = useState<PartnerFilterValues>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: facets } = usePartnerFacets();
  const { data: countryStats } = useCountryStatsV2();
  const toggleFav = useToggleFavoriteV2();
  const { exportToExcel, exporting } = useExcelExportV2();

  const queryFilters = useMemo(() => ({
    searchQuery: filterValues.searchQuery,
    countryCode: filterValues.countryCode,
    city: filterValues.city,
    partnerType: filterValues.partnerType,
    favorites: filterValues.favorites,
    quality: filterValues.quality,
    sort: filterValues.sort,
  }), [filterValues]);

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage } =
    usePartnersInfinite(queryFilters);

  const allPartners = useMemo(() => data?.pages.flatMap((p) => p.partners) ?? [], [data]);
  const totalCount = data?.pages[0]?.total ?? 0;

  // Stats
  const withEmail = useMemo(() => allPartners.filter((p) => p.email).length, [allPartners]);
  const withPhone = useMemo(() => allPartners.filter((p) => p.phone || p.mobile).length, [allPartners]);

  // Infinite scroll
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && hasNextPage && !isFetchingNextPage) fetchNextPage(); },
      { rootMargin: "200px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSearch = useCallback((q: string) => {
    setFilterValues((prev) => ({ ...prev, searchQuery: q || undefined }));
  }, []);

  const handleCountrySelect = useCallback((code: string | undefined) => {
    setFilterValues((prev) => ({ ...prev, countryCode: code }));
  }, []);

  const handleToggleFav = useCallback((partner: PartnerV2) => {
    toggleFav.mutate({ id: String(partner.id), isFavorite: !partner.isFavorite });
  }, [toggleFav]);

  return (
    <div className="flex h-full min-h-0">
      {showFilters && (
        <div className="w-60 flex-shrink-0 border-r overflow-y-auto">
          <PartnerFiltersPanel
            filters={filterValues}
            onFiltersChange={setFilterValues}
            availableCountries={facets?.countries ?? []}
            availableCities={facets?.cities ?? []}
            availableTypes={facets?.partnerTypes ?? []}
          />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">Network</h1>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Caricamento..." : (
                <>
                  {allPartners.length} di {totalCount.toLocaleString("it-IT")} partner
                  <span className="ml-2">· ✉ {withEmail} · 📞 {withPhone}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex gap-1.5">
            <Button variant={viewMode === "list" ? "secondary" : "outline"} size="sm" onClick={() => setViewMode("list")}>
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === "grid" ? "secondary" : "outline"} size="sm" onClick={() => setViewMode("grid")}>
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
            <Button variant={viewMode === "bca" ? "secondary" : "outline"} size="sm" onClick={() => setViewMode("bca")}>
              <CreditCard className="h-3.5 w-3.5" />
            </Button>
            <Button variant={showFilters ? "secondary" : "outline"} size="sm" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToExcel(allPartners)}
              disabled={exporting || allPartners.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              {exporting ? "..." : "Excel"}
            </Button>
          </div>
        </div>

        {viewMode !== "bca" && (
          <div className="px-4 pb-2">
            <SearchBar onSearch={handleSearch} placeholder="Cerca partner..." />
          </div>
        )}

        {/* Country Grid */}
        {viewMode === "grid" && countryStats && (
          <CountryGridV2
            stats={countryStats}
            selectedCountry={filterValues.countryCode}
            onSelectCountry={handleCountrySelect}
          />
        )}

        {/* Main content */}
        <div className="flex-1 overflow-y-auto px-4">
          {viewMode === "bca" ? (
            <BusinessCardsViewV2 />
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : allPartners.length === 0 ? (
            <EmptyState title="Nessun partner trovato" description="Modifica i filtri di ricerca." />
          ) : (
            <div className="space-y-1">
              {allPartners.map((p) => (
                <PartnerRow
                  key={String(p.id)}
                  partner={p}
                  onClick={() => setSelectedPartnerId(String(p.id))}
                  onToggleFav={() => handleToggleFav(p)}
                />
              ))}
              <div ref={sentinelRef} className="h-8 flex items-center justify-center">
                {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </div>
            </div>
          )}
        </div>
      </div>

      <PartnerDetailDrawer
        partnerId={selectedPartnerId}
        onClose={() => setSelectedPartnerId(null)}
        onToggleFavorite={handleToggleFav}
      />
    </div>
  );
}

function PartnerRow({ partner, onClick, onToggleFav }: {
  readonly partner: PartnerV2;
  readonly onClick: () => void;
  readonly onToggleFav: () => void;
}): React.ReactElement {
  const score = partnerCompletenessScore(partner);
  const scoreStatus = score >= 70 ? "success" : score >= 40 ? "warning" : "error";

  return (
    <div onClick={onClick} className="flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors">
      <button onClick={(e) => { e.stopPropagation(); onToggleFav(); }} className="flex-shrink-0">
        <Star className={`h-4 w-4 ${partner.isFavorite ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`} />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{partner.companyName}</span>
          {partner.companyAlias && <span className="text-xs text-muted-foreground truncate">({partner.companyAlias})</span>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{partner.countryCode}</span><span>·</span><span className="truncate">{partner.city}</span>
          {partner.partnerType && <><span>·</span><span>{partner.partnerType}</span></>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {partner.email && <StatusBadge status="info" label="✉" className="text-[10px] px-1.5" />}
        {(partner.phone ?? partner.mobile) && <StatusBadge status="info" label="📞" className="text-[10px] px-1.5" />}
        <StatusBadge status={scoreStatus} label={`${score}%`} />
        {partner.rating != null && partner.rating > 0 && <span className="text-xs text-muted-foreground">{partner.rating}★</span>}
      </div>
    </div>
  );
}
