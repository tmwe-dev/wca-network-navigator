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
import { useState, useEffect, useCallback, useMemo } from "react";
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

  // Focus mode: quando una società è selezionata (via deep-link, agenda, AI…)
  // mostriamo SOLO quella nella lista a sinistra per evitare confusione.
  // Si esce chiudendo il dettaglio.
  const focusedCompanies = useMemo(() => {
    if (!selectedPartnerId) return companies;
    const only = companies.filter((c) => c.id === selectedPartnerId);
    // Se non è in lista (es. aperto da agenda con id non presente nei filtri
    // correnti) lasciamo la lista intera: meglio non mostrare vuoto.
    return only.length > 0 ? only : companies;
  }, [companies, selectedPartnerId]);

  const focusedChips = useMemo(() => {
    if (!selectedPartnerId) return chips;
    const focused = companies.find((c) => c.id === selectedPartnerId);
    if (!focused) return chips;
    return [
      ...chips,
      {
        key: `focus:${selectedPartnerId}`,
        label: `Focus: ${focused.name}`,
        tone: "primary" as const,
      },
    ];
  }, [chips, companies, selectedPartnerId]);

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
    return () => window.removeEventListener("v2-open-partner", handler);
  }, []);

  // Quando un menu card chiede una Sherlock launch, apriamo prima il dettaglio
  // così che PartnerDetailInline possa intercettare l'evento.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { partnerId?: string; _replay?: boolean } | undefined;
      if (detail?.partnerId && !detail._replay) {
        setSelectedPartnerId(String(detail.partnerId));
        setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("sherlock-launch", { detail: { ...detail, _replay: true } })
          );
        }, 50);
      }
    };
    window.addEventListener("sherlock-launch", handler, { once: false });
    return () => window.removeEventListener("sherlock-launch", handler);
  }, []);

  const handleOpenCompany = useCallback((c: CompanyEntity) => {
    setSelectedPartnerId(c.id);
  }, []);

  const handleBulkAddToCockpit = useCallback((sel: CompanyEntity[]) => {
    window.dispatchEvent(
      new CustomEvent("cockpit-add-bulk", { detail: { partnerIds: sel.map((s) => s.id) } })
    );
    toast.success(`${sel.length} partner aggiunti al Cockpit`);
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
        onBulkAddToCockpit={handleBulkAddToCockpit}
        onBulkDeepSearch={handleBulkDeepSearch}
        onBulkCreateCampaign={handleBulkCampaign}
      />
    </div>
  );
}
