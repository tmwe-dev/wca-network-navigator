/**
 * CRMPage — STEP 7
 */

import * as React from "react";
import { useState, useCallback } from "react";
import { useContactsV2, type ContactFilters } from "@/v2/hooks/useContactsV2";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { SearchBar } from "../molecules/SearchBar";
import { StatusBadge } from "../atoms/StatusBadge";
import { contactCompletenessScore } from "@/v2/core/domain/rules/contact-rules";
import type { Contact } from "@/v2/core/domain/entities";

const contactColumns: readonly ColumnDef<Contact>[] = [
  { id: "name", header: "Nome", accessorFn: (row) => row.name },
  { id: "companyName", header: "Azienda", accessorFn: (row) => row.companyName },
  { id: "email", header: "Email", accessorFn: (row) => row.email },
  { id: "phone", header: "Telefono", accessorFn: (row) => row.phone ?? row.mobile },
  { id: "position", header: "Ruolo", accessorFn: (row) => row.position },
  {
    id: "leadStatus",
    header: "Stato",
    accessorFn: (row) => row.leadStatus,
    cell: (row) => {
      const statusMap: Record<string, "success" | "warning" | "info" | "neutral"> = {
        qualified: "success", contacted: "info", new: "warning",
      };
      return <StatusBadge status={statusMap[row.leadStatus] ?? "neutral"} label={row.leadStatus} />;
    },
    className: "w-[100px]",
  },
  {
    id: "score",
    header: "Score",
    accessorFn: (row) => contactCompletenessScore(row),
    cell: (row) => {
      const score = contactCompletenessScore(row);
      const status = score >= 70 ? "success" : score >= 40 ? "warning" : "error";
      return <StatusBadge status={status} label={`${score}%`} />;
    },
    className: "w-[80px]",
  },
];

export function CRMPage(): React.ReactElement {
  const [filters, setFilters] = useState<ContactFilters>({});
  const { data: contacts = [], isLoading } = useContactsV2(filters);

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
      <div>
        <h1 className="text-2xl font-bold text-foreground">CRM</h1>
        <p className="text-sm text-muted-foreground">{contacts.length} contatti</p>
      </div>

      <SearchBar onSearch={handleSearch} placeholder="Cerca contatti..." />

      <DataTable
        columns={contactColumns}
        rows={contacts}
        getRowId={(row) => String(row.id)}
        emptyTitle="Nessun contatto trovato"
        emptyDescription="Importa contatti o modifica i filtri."
      />
    </div>
  );
}
