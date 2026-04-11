/**
 * NetworkPage — STEP 6
 * Lista partner con filtri, ricerca, paginazione.
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { usePartnersV2, type PartnerFilters } from "@/v2/hooks/usePartnersV2";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { SearchBar } from "../molecules/SearchBar";
import { StatusBadge } from "../atoms/StatusBadge";
import { partnerCompletenessScore } from "@/v2/core/domain/rules/partner-rules";
import type { Partner } from "@/v2/core/domain/entities";

// ── Column definitions ───────────────────────────────────────────────

const partnerColumns: readonly ColumnDef<Partner>[] = [
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
    id: "network",
    header: "Network",
    accessorFn: (row) => row.networkName,
  },
  {
    id: "email",
    header: "Email",
    accessorFn: (row) => row.email,
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

// ── Component ────────────────────────────────────────────────────────

export function NetworkPage(): React.ReactElement {
  const [filters, setFilters] = useState<PartnerFilters>({});
  const { data: partners = [], isLoading } = usePartnersV2(filters);

  const handleSearch = useCallback((searchQuery: string) => {
    setFilters((prev) => ({ ...prev, searchQuery: searchQuery || undefined }));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Network</h1>
          <p className="text-sm text-muted-foreground">{partners.length} partner</p>
        </div>
      </div>

      <SearchBar onSearch={handleSearch} placeholder="Cerca partner..." />

      <DataTable
        columns={partnerColumns}
        rows={partners}
        getRowId={(row) => String(row.id)}
        emptyTitle="Nessun partner trovato"
        emptyDescription="Prova a modificare i filtri di ricerca."
      />
    </div>
  );
}
