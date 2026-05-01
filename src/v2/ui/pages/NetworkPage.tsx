/**
 * NetworkPage V2 — Standard "Card-azienda con contatti dentro".
 *
 * Vista di default: <CompanyCardList source="wca" /> con contatti referenti
 * annidati. La vista classica (CountryGridV2 + PartnerListPanel + drawer) è
 * accessibile via toggle "Vista classica" per non perdere features avanzate
 * (sync WCA, deep search canvas, ecc.) finché non vengono migrate.
 */
import * as React from "react";
import { useState } from "react";
import Operations from "@/components/operations/OperationsView";
import { useTrackPage } from "@/hooks/useTrackPage";
import { useMissionDrawerEvents } from "@/hooks/useMissionDrawerEvents";
import { toast } from "sonner";
import { LayoutGrid, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CompanyCardList } from "@/v2/ui/molecules/CompanyCardList";
import { useWcaPartnersAsCompanies } from "@/v2/hooks/companyList/useWcaPartnersAsCompanies";
import { useWcaActiveFilterChips } from "@/v2/hooks/companyList/useActiveFilterChips";
import { ListToolbar, useListSort, type SortOption } from "@/v2/ui/molecules/ListToolbar";
import { useSortedCompanies, type CompanySortKey } from "@/v2/hooks/companyList/useSortedCompanies";

const WCA_SORT_OPTIONS: ReadonlyArray<SortOption<CompanySortKey>> = [
  { key: "name", label: "Nome" },
  { key: "city", label: "Città" },
  { key: "wcaYears", label: "Anni WCA" },
  { key: "score", label: "Score" },
  { key: "contactsCount", label: "Contatti" },
];

function CardListBody(): React.ReactElement {
  const { companies, isLoading } = useWcaPartnersAsCompanies();
  const chips = useWcaActiveFilterChips();
  const { sortKey, sortDir, cycle } = useListSort<CompanySortKey>("list:wca", "name");
  const [search, setSearch] = useState("");
  const sorted = useSortedCompanies(companies, sortKey, sortDir, search);
  return (
    <div className="flex flex-col h-full min-h-0 pb-3">
      <ListToolbar<CompanySortKey>
        countLabel={`${sorted.length}/${companies.length} aziende`}
        sortKey={sortKey}
        sortDir={sortDir}
        sortOptions={WCA_SORT_OPTIONS}
        onCycleSort={cycle}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cerca partner, città, referente…"
        chips={chips}
      />
      <div className="flex-1 min-h-0 px-3 pt-2 overflow-hidden">
      <CompanyCardList
        companies={sorted}
        isLoading={isLoading}
        emptyMessage="Seleziona un paese dalla sidebar per vedere i partner"
        onOpenCompany={(c) => {
          // Dispatch evento globale: il drawer V2 esistente intercetta partner
          window.dispatchEvent(
            new CustomEvent("v2-open-partner", { detail: { partnerId: c.id } })
          );
        }}
        onOpenContact={(contact) => {
          window.dispatchEvent(
            new CustomEvent("crm-select-contact", {
              detail: { contactId: contact.id },
            })
          );
        }}
      />
      </div>
    </div>
  );
}

export function NetworkPage(): React.ReactElement {
  useTrackPage("network");
  const [view, setView] = useState<"cards" | "classic">("cards");

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

  return (
    <div data-testid="page-network" className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="flex items-center gap-1 px-4 pt-2">
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border/40 bg-muted/30 p-0.5">
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
            title="Vista classica (sync, deep search, mappa)"
          >
            <Settings2 className="w-3 h-3" /> Classica
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === "cards" ? <CardListBody /> : <Operations />}
      </div>
    </div>
  );
}
