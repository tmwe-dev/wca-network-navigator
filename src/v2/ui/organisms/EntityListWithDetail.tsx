/**
 * EntityListWithDetail — Wrapper standard per le pagine WCA / CRM.
 *
 * Layout: GoldenLayout (40/60) con
 *   - sinistra: ListToolbar + CompanyCardList (con checkbox)
 *   - destra: dettaglio singolo (slot) OPPURE BulkActionsPanel se 2+ selezionati
 *
 * Logic-less: tutto il dato/azioni passano via props. Stato locale:
 * selezione, sort, search, filtri.
 */
import * as React from "react";
import { useMemo, useState } from "react";
import { Filter as FilterIcon, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoldenLayout } from "@/v2/ui/templates/GoldenLayout";
import { CompanyCardList } from "@/v2/ui/molecules/CompanyCardList";
import type { CompanyEntity } from "@/v2/ui/molecules/CompanyCardList";
import { ListToolbar, useListSort, type SortOption } from "@/v2/ui/molecules/ListToolbar";
import { useSortedCompanies, type CompanySortKey } from "@/v2/hooks/companyList/useSortedCompanies";
import { useCompanySelection } from "@/v2/hooks/companyList/useCompanySelection";
import {
  useFilteredCompanies,
  countActiveFilters,
  type CompanyFiltersState,
} from "@/v2/hooks/companyList/useCompanyFilters";
import { EntityFiltersDrawer } from "./EntityFiltersDrawer";
import { BulkActionsPanel } from "./BulkActionsPanel";
import type { ActiveFilterChip } from "@/v2/ui/molecules/ActiveFiltersBar";

export interface EntityListWithDetailProps {
  source: "wca" | "crm" | "bca";
  companies: CompanyEntity[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Storage key per il sort persistente. */
  sortStorageKey: string;
  sortOptions: ReadonlyArray<SortOption<CompanySortKey>>;
  /** Chip filtri globali (paese, ricerca globale…). Solo display. */
  globalChips?: ActiveFilterChip[];
  searchPlaceholder?: string;
  /** Slot dettaglio singolo. null/undefined = nessuna selezione. */
  detailSlot?: React.ReactNode | null;
  /** Callback apertura azienda (click sul body). */
  onOpenCompany?: (c: CompanyEntity) => void;
  /** Callback apertura contatto (click su sub-card). */
  onOpenContact?: (contact: { id: string; raw?: unknown }, company: CompanyEntity) => void;
  /** Bulk: aggiungi al cockpit. */
  onBulkAddToCockpit?: (selected: CompanyEntity[]) => void;
  onBulkDeepSearch?: (selected: CompanyEntity[]) => void;
  onBulkCreateCampaign?: (selected: CompanyEntity[]) => void;
  onBulkSoftDelete?: (selected: CompanyEntity[]) => void;
  /** Slot azioni a destra in toolbar (es. "Sincronizza"). */
  toolbarRightSlot?: React.ReactNode;
  /** Trailing label per il breadcrumb del GoldenLayout. */
  trailingLabel?: string | null;
  testId?: string;
}

export function EntityListWithDetail({
  source,
  companies,
  isLoading,
  emptyMessage,
  sortStorageKey,
  sortOptions,
  globalChips,
  searchPlaceholder,
  detailSlot,
  onOpenCompany,
  onOpenContact,
  onBulkAddToCockpit,
  onBulkDeepSearch,
  onBulkCreateCampaign,
  onBulkSoftDelete,
  toolbarRightSlot,
  trailingLabel,
  testId,
}: EntityListWithDetailProps): React.ReactElement {
  const { sortKey, sortDir, cycle } = useListSort<CompanySortKey>(sortStorageKey, "name");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CompanyFiltersState>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useFilteredCompanies(companies, filters);
  const sorted = useSortedCompanies(filtered, sortKey, sortDir, search);

  const selection = useCompanySelection();
  const visibleIds = useMemo(() => sorted.map((c) => c.id), [sorted]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id));

  const selectedCompanies = useMemo(
    () => companies.filter((c) => selection.isSelected(c.id)),
    [companies, selection]
  );

  const activeFiltersCount = countActiveFilters(filters);

  const filterButton = (
    <button
      type="button"
      onClick={() => setFiltersOpen(true)}
      className={cn(
        "h-7 px-2 rounded-md text-[11px] font-medium border inline-flex items-center gap-1 transition-all",
        activeFiltersCount > 0
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-card/40 text-muted-foreground border-border/40 hover:text-foreground"
      )}
      title="Apri filtri avanzati"
    >
      <FilterIcon className="w-3 h-3" /> Filtri
      {activeFiltersCount > 0 && (
        <span className="ml-1 px-1 rounded bg-primary text-primary-foreground text-[9px] font-bold">
          {activeFiltersCount}
        </span>
      )}
    </button>
  );

  const selectAllButton = (
    <button
      type="button"
      onClick={() => selection.selectAll(visibleIds)}
      className={cn(
        "h-7 px-2 rounded-md text-[11px] font-medium border inline-flex items-center gap-1 transition-all",
        allSelected
          ? "bg-primary/15 text-primary border-primary/40"
          : "bg-card/40 text-muted-foreground border-border/40 hover:text-foreground"
      )}
      title={allSelected ? "Deseleziona tutto" : "Seleziona tutti i visibili"}
    >
      <ChevronUp className={cn("w-3 h-3 transition-transform", allSelected && "rotate-180")} />
      {allSelected ? "Deseleziona" : "Seleziona tutto"}
    </button>
  );

  const list = (
    <div className="flex flex-col h-full min-h-0 pb-2">
      <ListToolbar<CompanySortKey>
        countLabel={
          <span>
            {sorted.length}/{companies.length} aziende
            {selection.count > 0 && (
              <span className="ml-2 text-primary font-semibold">· {selection.count} sel.</span>
            )}
          </span>
        }
        sortKey={sortKey}
        sortDir={sortDir}
        sortOptions={sortOptions}
        onCycleSort={cycle}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder ?? "Cerca…"}
        chips={globalChips}
        rightSlot={
          <>
            {selectAllButton}
            {filterButton}
            {toolbarRightSlot}
          </>
        }
      />
      <div className="flex-1 min-h-0 px-3 pt-2 overflow-hidden">
        <CompanyCardList
          companies={sorted}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          selectedIds={selection.selectedIds}
          onToggleSelect={selection.toggle}
          onOpenCompany={onOpenCompany}
        />
      </div>

      <EntityFiltersDrawer
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        filters={filters}
        onChange={setFilters}
        companies={companies}
        source={source}
      />
    </div>
  );

  // Quando 2+ selezionati → bulk panel; quando 1 → detail singolo del consumer;
  // quando 0 → detail singolo del consumer (può essere null = no panel).
  const right = (() => {
    if (selection.count >= 2) {
      return (
        <BulkActionsPanel
          selected={selectedCompanies}
          onClear={selection.clear}
          onAddToCockpit={onBulkAddToCockpit}
          onDeepSearch={onBulkDeepSearch}
          onCreateCampaign={onBulkCreateCampaign}
          onSoftDelete={onBulkSoftDelete}
        />
      );
    }
    return detailSlot ?? null;
  })();

  return (
    <GoldenLayout
      testId={testId ?? "entity-list-with-detail"}
      list={list}
      detail={right}
      trailingLabel={selection.count >= 2 ? `${selection.count} selezionati` : trailingLabel ?? null}
      hideHeader
    />
  );
}

export default EntityListWithDetail;