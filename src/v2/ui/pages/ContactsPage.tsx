/**
 * ContactsPage V2 — Reference implementation of the Golden Layout (UX Redesign Phase 1).
 * List left (40%) + Detail right (60%) with auto breadcrumb and resizable handle.
 */
import { useState, useCallback, useEffect } from "react";
import { ContactListPanel } from "@/components/contacts/ContactListPanel";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";
import { Users, X, LayoutGrid, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContactById } from "@/data/contacts";
import { useUrlState } from "@/hooks/useUrlState";
import { trackEntityOpen } from "@/lib/telemetry";
import { createLogger } from "@/lib/log";
import type { ContactDetail } from "@/hooks/useContactDetail";
import { GoldenLayout } from "@/v2/ui/templates/GoldenLayout";
import { CompanyCardList } from "@/v2/ui/molecules/CompanyCardList";
import { useCrmContactsAsCompanies } from "@/v2/hooks/companyList/useCrmContactsAsCompanies";
import { useCrmActiveFilterChips } from "@/v2/hooks/companyList/useActiveFilterChips";
import { ListToolbar, useListSort, type SortOption } from "@/v2/ui/molecules/ListToolbar";
import { useSortedCompanies, type CompanySortKey } from "@/v2/hooks/companyList/useSortedCompanies";

const log = createLogger("Contacts");

const CRM_SORT_OPTIONS: ReadonlyArray<SortOption<CompanySortKey>> = [
  { key: "name", label: "Nome" },
  { key: "city", label: "Città" },
  { key: "score", label: "Score" },
  { key: "contactsCount", label: "Contatti" },
];

function CrmCardListBody(): React.ReactElement {
  const { companies, isLoading, hasMore, fetchNextPage } = useCrmContactsAsCompanies();
  const chips = useCrmActiveFilterChips();
  const { sortKey, sortDir, cycle } = useListSort<CompanySortKey>("list:crm", "name");
  const [search, setSearch] = useState("");
  const sorted = useSortedCompanies(companies, sortKey, sortDir, search);
  return (
    <div className="flex flex-col h-full min-h-0 pb-3">
      <ListToolbar<CompanySortKey>
        countLabel={`${sorted.length}/${companies.length} aziende`}
        sortKey={sortKey}
        sortDir={sortDir}
        sortOptions={CRM_SORT_OPTIONS}
        onCycleSort={cycle}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cerca contatto, azienda, città…"
        chips={chips}
      />
      <div className="flex-1 min-h-0 px-3 pt-2 overflow-hidden">
      <CompanyCardList
        companies={sorted}
        isLoading={isLoading}
        emptyMessage="Nessun contatto"
        onOpenContact={(contact) => {
          window.dispatchEvent(
            new CustomEvent("crm-select-contact", {
              detail: { contactId: contact.id },
            })
          );
        }}
      />
      </div>
      {hasMore && (
        <div className="pt-2 flex justify-center">
          <button
            onClick={() => void fetchNextPage()}
            className="px-3 py-1.5 rounded-md text-[11px] bg-muted/40 hover:bg-muted/60 text-muted-foreground border border-border/40"
          >
            Carica altri
          </button>
        </div>
      )}
    </div>
  );
}

export function ContactsPage() {
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null);
  const [urlContactId, setUrlContactId] = useUrlState<string>("contact", "");
  const [view, setView] = useState<"cards" | "classic">("cards");

  const loadContactById = useCallback(async (id: string) => {
    try {
      const data = await getContactById(id);
      if (data) {
        setSelectedContact(data as unknown as ContactDetail);
        trackEntityOpen("contact", id);
      }
    } catch (e) { log.debug("best-effort operation failed", { error: e instanceof Error ? e.message : String(e) }); }
  }, []);

  useEffect(() => {
    if (urlContactId && (!selectedContact || selectedContact.id !== urlContactId)) {
      void loadContactById(urlContactId);
    }
    if (!urlContactId && selectedContact) {
      setSelectedContact(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlContactId]);

  const handleSelect = useCallback((contact: Record<string, unknown>) => {
    setSelectedContact(contact as unknown as ContactDetail);
    if (contact?.id) setUrlContactId(String(contact.id));
  }, [setUrlContactId]);

  const handleContactUpdated = useCallback((updated: Record<string, unknown>) => {
    setSelectedContact(updated as unknown as ContactDetail);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedContact(null);
    setUrlContactId("");
  }, [setUrlContactId]);

  useEffect(() => {
    const handler = async (e: Event) => {
      const contactId = (e as CustomEvent).detail?.contactId;
      if (!contactId) return;
      setUrlContactId(contactId);
      await loadContactById(contactId);
    };
    window.addEventListener("crm-select-contact", handler);
    return () => window.removeEventListener("crm-select-contact", handler);
  }, [setUrlContactId, loadContactById]);

  const viewToggle = (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border/40 bg-muted/30 p-0.5 m-2">
      <button
        onClick={() => setView("cards")}
        className={cn(
          "px-2 py-1 rounded text-[11px] flex items-center gap-1 transition-all",
          view === "cards"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
        title="Vista card-azienda"
      >
        <LayoutGrid className="w-3 h-3" /> Card-azienda
      </button>
      <button
        onClick={() => setView("classic")}
        className={cn(
          "px-2 py-1 rounded text-[11px] flex items-center gap-1 transition-all",
          view === "classic"
            ? "bg-primary/15 text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
        title="Vista tabella classica"
      >
        <Settings2 className="w-3 h-3" /> Classica
      </button>
    </div>
  );

  const list = (
    <div className="flex flex-col h-full min-h-0">
      {viewToggle}
      <div className="flex-1 min-h-0">
        {view === "cards" ? (
          <CrmCardListBody />
        ) : (
          <ContactListPanel
            selectedId={selectedContact?.id ?? null}
            onSelect={handleSelect}
          />
        )}
      </div>
    </div>
  );

  const detail = selectedContact ? (
    <div className="h-full bg-card relative">
      <button
        onClick={handleCloseDetail}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-muted/80 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
        title="Chiudi dettaglio"
      >
        <X className="w-4 h-4" />
      </button>
      <ContactDetailPanel
        key={selectedContact.id}
        contact={selectedContact}
        onContactUpdated={handleContactUpdated as never}
      />
    </div>
  ) : null;

  // Trailing breadcrumb shows the selected contact name when present.
  const trailingLabel = selectedContact
    ? (selectedContact as unknown as { name?: string; full_name?: string; email?: string })
        .name ??
      (selectedContact as unknown as { full_name?: string }).full_name ??
      (selectedContact as unknown as { email?: string }).email ??
      null
    : null;

  return (
    <GoldenLayout
      testId="page-contacts-hub"
      list={list}
      detail={detail}
      trailingLabel={trailingLabel}
      hideHeader
    />
  );
}

export default ContactsPage;

// Empty state hint kept here for parity with previous UX (not currently rendered
// — the GoldenLayout collapses the right panel when no detail is selected).
export function _ContactsEmptyHint() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 bg-card/30">
      <Users className="w-10 h-10 mb-3 opacity-30" />
      <p className="text-sm font-medium">Seleziona un contatto</p>
      <p className="text-xs mt-1 opacity-60">Clicca per visualizzare i dettagli</p>
    </div>
  );
}
