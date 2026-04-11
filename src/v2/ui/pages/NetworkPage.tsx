/**
 * NetworkPage — Partner list with filters, detail drawer, pagination
 */
import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { usePartnersV2, type PartnerFilters } from "@/v2/hooks/usePartnersV2";
import { usePartnerFacets } from "@/v2/hooks/usePartnerFacets";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { SearchBar } from "../molecules/SearchBar";
import { PartnerFiltersPanel, type PartnerFilterValues } from "../organisms/PartnerFiltersPanel";
import { PartnerDetailDrawer } from "../organisms/PartnerDetailDrawer";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { partnerCompletenessScore } from "@/v2/core/domain/rules/partner-rules";
import type { PartnerV2 } from "@/v2/core/domain/partner-entity";
import { Filter } from "lucide-react";

const partnerColumns: readonly ColumnDef<PartnerV2>[] = [
  {
    id: "companyName",
    header: "Azienda",
    accessorFn: (row) => row.companyName,
  },
  {
    id: "countryCode",
    header: "Paese",
    accessorFn: (row) => row.countryCode,
    className: "w-[80px]",
  },
  {
    id: "city",
    header: "Città",
    accessorFn: (row) => row.city,
  },
  {
    id: "email",
    header: "Email",
    accessorFn: (row) => row.email,
  },
  {
    id: "leadStatus",
    header: "Stato",
    accessorFn: (row) => row.leadStatus,
  },
  {
    id: "score",
    header: "Score",
    accessorFn: (row) => partnerCompletenessScore(row),
    cell: (row) => {
      const score = partnerCompletenessScore(row);
      const status = score >= 70 ? "success" : score >= 40 ? "warning" : "error";
      return <StatusBadge status={status} label={`${score}%`} />;
    },
    className: "w-[80px]",
  },
];

export function NetworkPage(): React.ReactElement {
  const [filterValues, setFilterValues] = useState<PartnerFilterValues>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  const { data: facets } = usePartnerFacets();

  const queryFilters = useMemo<PartnerFilters>(() => ({
    countryCode: filterValues.countryCode,
    searchQuery: filterValues.searchQuery,
  }), [filterValues]);

  const { data: partners = [], isLoading } = usePartnersV2(queryFilters);

  const filteredPartners = useMemo(() => {
    let result = [...partners];
    if (filterValues.hasEmail) {
      result = result.filter((p) => Boolean(p.email));
    }
    if (filterValues.hasPhone) {
      result = result.filter((p) => Boolean(p.phone));
    }
    return result;
  }, [partners, filterValues.hasEmail, filterValues.hasPhone]);

  const handleSearch = useCallback((searchQuery: string) => {
    setFilterValues((prev) => ({ ...prev, searchQuery: searchQuery || undefined }));
  }, []);

  const handleRowClick = useCallback((partner: PartnerV2) => {
    setSelectedPartnerId(String(partner.id));
  }, []);

  return (
    <div className="flex h-full">
      {showFilters ? (
        <div className="w-64 flex-shrink-0 border-r overflow-y-auto p-2">
          <PartnerFiltersPanel
            filters={filterValues}
            onFiltersChange={setFilterValues}
            availableCountries={facets?.countries ?? []}
          />
        </div>
      ) : null}

      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Network</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Caricamento..." : `${filteredPartners.length} partner`}
              {facets?.totalCount ? ` su ${facets.totalCount.toLocaleString("it-IT")} totali` : ""}
            </p>
          </div>
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters((v) => !v)}
          >
            <Filter className="h-4 w-4 mr-1" />
            Filtri
          </Button>
        </div>

        <SearchBar onSearch={handleSearch} placeholder="Cerca partner..." />

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <DataTable
            columns={partnerColumns}
            rows={filteredPartners}
            getRowId={(row) => String(row.id)}
            emptyTitle="Nessun partner trovato"
            emptyDescription="Prova a modificare i filtri di ricerca."
            onRowClick={handleRowClick}
          />
        )}
      </div>

      <PartnerDetailDrawer
        partnerId={selectedPartnerId}
        onClose={() => setSelectedPartnerId(null)}
      />
    </div>
  );
}
