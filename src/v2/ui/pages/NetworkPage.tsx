/**
 * NetworkPage V2 — Standard "Card-azienda con contatti dentro".
 *
 * Vista di default: <CompanyCardList source="wca" /> con contatti referenti
 * annidati. La vista classica (CountryGridV2 + PartnerListPanel + drawer) è
 * accessibile via toggle "Vista classica" per non perdere features avanzate
 * (sync WCA, deep search canvas, ecc.) finché non vengono migrate.
 */
/**
 * NetworkPage V2 — Vista unica WCA Partner (no più toggle "Classica").
 * Lista a sinistra (CompanyCardList ricca + checkbox + filtri/sort) +
 * dettaglio inline a destra. Selezione 2+ → BulkActionsPanel.
 */
import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useTrackPage } from "@/hooks/useTrackPage";
import { useMissionDrawerEvents } from "@/hooks/useMissionDrawerEvents";
import { useWcaPartnersAsCompanies } from "@/v2/hooks/companyList/useWcaPartnersAsCompanies";
import { useWcaActiveFilterChips } from "@/v2/hooks/companyList/useActiveFilterChips";
import { type SortOption } from "@/v2/ui/molecules/ListToolbar";
import type { CompanySortKey } from "@/v2/hooks/companyList/useSortedCompanies";
import { EntityListWithDetail } from "@/v2/ui/organisms/EntityListWithDetail";
import { PartnerDetailInline } from "@/v2/ui/organisms/PartnerDetailInline";
import type { CompanyEntity } from "@/v2/ui/molecules/CompanyCardList";
import { supabase } from "@/integrations/supabase/client";
import { insertCockpitQueueItems } from "@/data/cockpitQueue";
import { addCockpitPreselection } from "@/lib/cockpitPreselection";
// Niente PageTitleHeader: il contesto "Esplora · WCA Partner" è già mostrato
// da `ExploreContextHeader` nella top-bar globale (no doppione).

const WCA_SORT_OPTIONS: ReadonlyArray<SortOption<CompanySortKey>> = [
  { key: "name", label: "Nome" },
  { key: "country", label: "Paese" },
  { key: "city", label: "Città" },
  { key: "wcaYears", label: "Anni WCA" },
  { key: "score", label: "Score" },
  { key: "lastInteraction", label: "Ultimo contatto" },
  { key: "interactions", label: "# interazioni" },
  { key: "contactsCount", label: "Contatti" },
];

export function NetworkPage(): React.ReactElement {
  useTrackPage("network");
  const { companies, isLoading } = useWcaPartnersAsCompanies();
  const chips = useWcaActiveFilterChips();
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  // Lista sempre completa: la selezione apre il dettaglio a destra ma NON
  // filtra la lista a sinistra (la navigazione tra partner deve restare
  // libera). Il default "primo record selezionato" è gestito altrove.
  const focusedCompanies = companies;
  const focusedChips = chips;

  // Apertura via deep-link: /v2/network?partnerId=<id>
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const id = searchParams.get("partnerId");
    if (id) {
      setSelectedPartnerId(id);
      // pulisce il param per non riselezionare al refresh
      const next = new URLSearchParams(searchParams);
      next.delete("partnerId");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useMissionDrawerEvents({
    "deep-search-country": () => {
      window.dispatchEvent(new CustomEvent("network-open-deep-search"));
      toast.info("Deep Search aperto", { description: "Seleziona il paese nella griglia." });
    },
    "generate-aliases": () => {
      window.dispatchEvent(new CustomEvent("network-trigger-alias-batch"));
      toast.success("Batch alias avviato sui partner visibili");
    },
    "export-partners": () => {
      window.dispatchEvent(new CustomEvent("network-trigger-export"));
    },
  });

  // Listener globale per aperture esterne (drawer AI / cockpit).
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent).detail?.partnerId;
      if (id) setSelectedPartnerId(String(id));
    };
    window.addEventListener("v2-open-partner", handler);
    // La sidebar filtri WCA (`NetworkFiltersSection`) emette
    // `network-select-partner` quando si clicca un risultato del search.
    // Lo trattiamo come alias di `v2-open-partner` per aprire il dettaglio.
    window.addEventListener("network-select-partner", handler);
    return () => {
      window.removeEventListener("v2-open-partner", handler);
      window.removeEventListener("network-select-partner", handler);
    };
  }, []);

  // Sherlock launch è gestito dal singleton globale GlobalSherlockLauncher (App.tsx).

  const handleOpenCompany = useCallback((c: CompanyEntity) => {
    setSelectedPartnerId(c.id);
  }, []);

  const handleBulkAddToCockpit = useCallback(async (sel: CompanyEntity[]) => {
    if (!sel.length) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        toast.error("Utente non autenticato");
        return;
      }
      const items: Array<{ source_type: string; source_id: string; partner_id: string; user_id: string }> = [];
      for (const c of sel) {
        const contacts = c.contacts ?? [];
        if (contacts.length > 0) {
          for (const ct of contacts) {
            items.push({ source_type: "partner_contact", source_id: ct.id, partner_id: c.id, user_id: userId });
          }
        } else {
          // Fallback: invia il partner stesso (sarà mostrato come contatto generico)
          items.push({ source_type: "partner_contact", source_id: c.id, partner_id: c.id, user_id: userId });
        }
      }
      if (items.length === 0) {
        toast.info("Nessun contatto da inviare");
        return;
      }
      await insertCockpitQueueItems(items);
      addCockpitPreselection(items.map((i) => i.source_id));
      toast.success(`${sel.length} partner inviati al Cockpit (${items.length} contatti)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("Errore invio al Cockpit", { description: msg });
    }
  }, []);

  const handleBulkDeepSearch = useCallback((sel: CompanyEntity[]) => {
    window.dispatchEvent(
      new CustomEvent("network-trigger-deep-search-batch", { detail: { partnerIds: sel.map((s) => s.id) } })
    );
    toast.info(`Deep Search avviato su ${sel.length} partner`);
  }, []);

  const handleBulkCampaign = useCallback((sel: CompanyEntity[]) => {
    const withEmail = sel.filter((s) => s.channels?.email);
    window.dispatchEvent(
      new CustomEvent("campaign-create-bulk", {
        detail: { partnerIds: withEmail.map((s) => s.id), source: "wca" },
      })
    );
    toast.success(`Campagna creata per ${withEmail.length} destinatari`);
  }, []);

  return (
    <div data-testid="page-network" className="flex flex-col h-full min-h-0 overflow-hidden">
      <EntityListWithDetail
        source="wca"
        companies={focusedCompanies}
        isLoading={isLoading}
        emptyMessage="Seleziona un paese dalla sidebar per vedere i partner"
        sortStorageKey="list:wca"
        sortOptions={WCA_SORT_OPTIONS}
        globalChips={focusedChips}
        searchPlaceholder="Cerca partner, città, referente…"
        onOpenCompany={handleOpenCompany}
        detailSlot={
          selectedPartnerId ? (
            <PartnerDetailInline
              partnerId={selectedPartnerId}
              onClose={() => setSelectedPartnerId(null)}
            />
          ) : null
        }
        openedId={selectedPartnerId}
        onBulkAddToCockpit={handleBulkAddToCockpit}
        onBulkDeepSearch={handleBulkDeepSearch}
        onBulkCreateCampaign={handleBulkCampaign}
      />
    </div>
  );
}
