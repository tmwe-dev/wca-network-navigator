/**
 * CRMPage — Contacts with filters, detail drawer, search
 */
import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { useContactsV2, type ContactFilters } from "@/v2/hooks/useContactsV2";
import { DataTable, type ColumnDef } from "../organisms/DataTable";
import { SearchBar } from "../molecules/SearchBar";
import { ContactFiltersPanel, type ContactFilterValues } from "../organisms/ContactFiltersPanel";
import { ContactDetailDrawer } from "../organisms/ContactDetailDrawer";
import { StatusBadge } from "../atoms/StatusBadge";
import { Button } from "../atoms/Button";
import { contactCompletenessScore } from "@/v2/core/domain/rules/contact-rules";
import type { Contact } from "@/v2/core/domain/entities";
import { Filter } from "lucide-react";

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
      const map: Record<string, "success" | "warning" | "info" | "neutral"> = {
        converted: "success", contacted: "info", new: "warning", in_progress: "info", negotiation: "warning",
      };
      return <StatusBadge status={map[row.leadStatus] ?? "neutral"} label={row.leadStatus} />;
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
  const [filterValues, setFilterValues] = useState<ContactFilterValues>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const queryFilters = useMemo<ContactFilters>(() => ({
    searchQuery: filterValues.searchQuery,
    leadStatus: filterValues.leadStatus,
  }), [filterValues]);

  const { data: contacts = [], isLoading } = useContactsV2(queryFilters);

  const filteredContacts = useMemo(() => {
    let result = [...contacts];
    if (filterValues.hasEmail) {
      result = result.filter((c) => Boolean(c.email));
    }
    if (filterValues.hasPhone) {
      result = result.filter((c) => Boolean(c.phone) || Boolean(c.mobile));
    }
    return result;
  }, [contacts, filterValues.hasEmail, filterValues.hasPhone]);

  const handleSearch = useCallback((searchQuery: string) => {
    setFilterValues((prev) => ({ ...prev, searchQuery: searchQuery || undefined }));
  }, []);

  const handleRowClick = useCallback((contact: Contact) => {
    setSelectedContactId(String(contact.id));
  }, []);

  return (
    <div className="flex h-full">
      {showFilters ? (
        <div className="w-64 flex-shrink-0 border-r overflow-y-auto p-2">
          <ContactFiltersPanel
            filters={filterValues}
            onFiltersChange={setFilterValues}
          />
        </div>
      ) : null}

      <div className="flex-1 p-6 space-y-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CRM</h1>
            <p className="text-sm text-muted-foreground">
              {isLoading ? "Caricamento..." : `${filteredContacts.length} contatti`}
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

        <SearchBar onSearch={handleSearch} placeholder="Cerca contatti..." />

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <DataTable
            columns={contactColumns}
            rows={filteredContacts}
            getRowId={(row) => String(row.id)}
            emptyTitle="Nessun contatto trovato"
            emptyDescription="Importa contatti o modifica i filtri."
            onRowClick={handleRowClick}
          />
        )}
      </div>

      <ContactDetailDrawer
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
      />
    </div>
  );
}
