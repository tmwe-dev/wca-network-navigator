/**
 * CRMPage — Contacts with filters, detail drawer, actions, search
 */
import * as React from "react";
import { useState, useCallback, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useContactsV2, type ContactFilters } from "@/v2/hooks/useContactsV2";
import { deleteContact, updateContact } from "@/v2/io/supabase/mutations/contacts";
import { SearchBar } from "../molecules/SearchBar";
import { ContactFiltersPanel, type ContactFilterValues } from "../organisms/ContactFiltersPanel";
import { ContactDetailDrawer } from "../organisms/ContactDetailDrawer";
import { StatusBadge } from "../atoms/StatusBadge";
import { EmptyState } from "../atoms/EmptyState";
import { Button } from "../atoms/Button";
import { contactCompletenessScore } from "@/v2/core/domain/rules/contact-rules";
import type { Contact } from "@/v2/core/domain/entities";
import { Filter, Loader2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

const STATUS_MAP: Record<string, "success" | "warning" | "info" | "neutral"> = {
  converted: "success", contacted: "info", new: "warning",
  in_progress: "info", negotiation: "warning",
};

export function CRMPage(): React.ReactElement {
  const [filterValues, setFilterValues] = useState<ContactFilterValues>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const qc = useQueryClient();

  const queryFilters = useMemo<ContactFilters>(() => ({
    searchQuery: filterValues.searchQuery,
    leadStatus: filterValues.leadStatus,
  }), [filterValues]);

  const { data: contacts = [], isLoading } = useContactsV2(queryFilters);

  const filtered = useMemo(() => {
    let result = [...contacts];
    if (filterValues.hasEmail) result = result.filter((c) => Boolean(c.email));
    if (filterValues.hasPhone) result = result.filter((c) => Boolean(c.phone) || Boolean(c.mobile));
    return result;
  }, [contacts, filterValues.hasEmail, filterValues.hasPhone]);

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteContact(id);
      if (result._tag === "Err") throw new Error(result.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "contacts"] });
      toast.success("Contatto eliminato");
    },
    onError: (e: Error) => toast.error(`Errore: ${e.message}`),
  });

  const updateStatusMut = useMutation({
    mutationFn: async ({ id, lead_status }: { id: string; lead_status: string }) => {
      const result = await updateContact(id, { lead_status });
      if (result._tag === "Err") throw new Error(result.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["v2", "contacts"] });
      toast.success("Stato aggiornato");
    },
  });

  const handleSearch = useCallback((q: string) => {
    setFilterValues((prev) => ({ ...prev, searchQuery: q || undefined }));
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full min-h-0">
      {showFilters && (
        <div className="w-60 flex-shrink-0 border-r overflow-y-auto p-2">
          <ContactFiltersPanel filters={filterValues} onFiltersChange={setFilterValues} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h1 className="text-xl font-bold text-foreground">CRM</h1>
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Caricamento..." : `${filtered.length} contatti`}
            </p>
          </div>
          <div className="flex gap-2">
            {selectedIds.size > 0 && (
              <Button variant="destructive" size="sm" onClick={() => {
                selectedIds.forEach((id) => deleteMut.mutate(id));
                setSelectedIds(new Set());
              }}>
                <Trash2 className="h-4 w-4 mr-1" /> Elimina ({selectedIds.size})
              </Button>
            )}
            <Button variant={showFilters ? "secondary" : "outline"} size="sm" onClick={() => setShowFilters((v) => !v)}>
              <Filter className="h-4 w-4 mr-1" /> Filtri
            </Button>
          </div>
        </div>

        <div className="px-4 pb-2">
          <SearchBar onSearch={handleSearch} placeholder="Cerca contatti..." />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState title="Nessun contatto" description="Importa contatti o modifica i filtri." icon={<UserPlus className="h-8 w-8" />} />
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => (
                <ContactRow
                  key={String(c.id)}
                  contact={c}
                  selected={selectedIds.has(String(c.id))}
                  onToggleSelect={() => toggleSelect(String(c.id))}
                  onClick={() => setSelectedContactId(String(c.id))}
                  onStatusChange={(status) => updateStatusMut.mutate({ id: String(c.id), lead_status: status })}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <ContactDetailDrawer contactId={selectedContactId} onClose={() => setSelectedContactId(null)} />
    </div>
  );
}

function ContactRow({ contact, selected, onToggleSelect, onClick, onStatusChange }: {
  readonly contact: Contact;
  readonly selected: boolean;
  readonly onToggleSelect: () => void;
  readonly onClick: () => void;
  readonly onStatusChange: (status: string) => void;
}): React.ReactElement {
  const score = contactCompletenessScore(contact);

  return (
    <div
      className={`flex items-center gap-3 p-2.5 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors ${selected ? "ring-2 ring-primary" : ""}`}
      onClick={onClick}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
        onClick={(e) => e.stopPropagation()}
        className="rounded flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{contact.name ?? contact.companyName ?? "—"}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {contact.companyName && contact.name && <span className="truncate">{contact.companyName}</span>}
          {contact.position && <><span>·</span><span className="truncate">{contact.position}</span></>}
          {contact.city && <><span>·</span><span>{contact.city}</span></>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {contact.email && <StatusBadge status="info" label="✉" className="text-[10px] px-1.5" />}
        <StatusBadge
          status={STATUS_MAP[contact.leadStatus] ?? "neutral"}
          label={contact.leadStatus}
        />
        <StatusBadge
          status={score >= 70 ? "success" : score >= 40 ? "warning" : "error"}
          label={`${score}%`}
        />
      </div>
    </div>
  );
}
