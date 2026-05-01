/**
 * ContactsPage V2 — Reference implementation of the Golden Layout (UX Redesign Phase 1).
 * List left (40%) + Detail right (60%) with auto breadcrumb and resizable handle.
 */
import { useState, useCallback, useEffect } from "react";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";
import { Users, X } from "lucide-react";
import { getContactById } from "@/data/contacts";
import { useUrlState } from "@/hooks/useUrlState";
import { trackEntityOpen } from "@/lib/telemetry";
import { createLogger } from "@/lib/log";
import { toast } from "sonner";
import type { ContactDetail } from "@/hooks/useContactDetail";
import { useCrmContactsAsCompanies } from "@/v2/hooks/companyList/useCrmContactsAsCompanies";
import { useCrmActiveFilterChips } from "@/v2/hooks/companyList/useActiveFilterChips";
import { type SortOption } from "@/v2/ui/molecules/ListToolbar";
import type { CompanySortKey } from "@/v2/hooks/companyList/useSortedCompanies";
import { EntityListWithDetail } from "@/v2/ui/organisms/EntityListWithDetail";
import type { CompanyEntity } from "@/v2/ui/molecules/CompanyCardList";

const log = createLogger("Contacts");

const CRM_SORT_OPTIONS: ReadonlyArray<SortOption<CompanySortKey>> = [
  { key: "name", label: "Nome" },
  { key: "country", label: "Paese" },
  { key: "city", label: "Città" },
  { key: "score", label: "Score" },
  { key: "lastInteraction", label: "Ultimo contatto" },
  { key: "interactions", label: "# interazioni" },
  { key: "contactsCount", label: "Contatti" },
];

export function ContactsPage() {
  const [selectedContact, setSelectedContact] = useState<ContactDetail | null>(null);
  const [urlContactId, setUrlContactId] = useUrlState<string>("contact", "");
  const { companies, isLoading, hasMore, fetchNextPage } = useCrmContactsAsCompanies();
  const chips = useCrmActiveFilterChips();

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

  const handleOpenContact = useCallback(
    (contact: { id: string; raw?: unknown }) => {
      setUrlContactId(contact.id);
      void loadContactById(contact.id);
    },
    [setUrlContactId, loadContactById]
  );

  const handleBulkAddToCockpit = useCallback((sel: CompanyEntity[]) => {
    window.dispatchEvent(
      new CustomEvent("cockpit-add-bulk-contacts", { detail: { companyIds: sel.map((s) => s.id) } })
    );
    toast.success(`${sel.length} aziende aggiunte al Cockpit`);
  }, []);

  const handleBulkCampaign = useCallback((sel: CompanyEntity[]) => {
    const withEmail = sel.filter((s) => s.channels?.email);
    window.dispatchEvent(
      new CustomEvent("campaign-create-bulk", {
        detail: { companyIds: withEmail.map((s) => s.id), source: "crm" },
      })
    );
    toast.success(`Campagna creata per ${withEmail.length} destinatari`);
  }, []);

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

  return (
    <div data-testid="page-contacts-hub" className="flex flex-col h-full min-h-0 overflow-hidden">
      <EntityListWithDetail
        source="crm"
        companies={companies}
        isLoading={isLoading}
        emptyMessage="Nessun contatto"
        sortStorageKey="list:crm"
        sortOptions={CRM_SORT_OPTIONS}
        globalChips={chips}
        searchPlaceholder="Cerca contatto, azienda, città…"
        onOpenContact={handleOpenContact}
        detailSlot={detail}
        onBulkAddToCockpit={handleBulkAddToCockpit}
        onBulkCreateCampaign={handleBulkCampaign}
        toolbarRightSlot={
          hasMore ? (
            <button
              onClick={() => void fetchNextPage()}
              className="h-7 px-2 rounded-md text-[11px] bg-muted/40 hover:bg-muted/60 text-muted-foreground border border-border/40"
              title="Carica altri contatti"
            >
              Carica altri
            </button>
          ) : null
        }
      />
    </div>
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
