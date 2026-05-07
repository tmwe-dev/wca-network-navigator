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
import { ListToolbar, useListSort, type SortOption, type HoldingFilterMode } from "@/v2/ui/molecules/ListToolbar";
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
import { useBusyPartners } from "@/v2/hooks/useBusyPartners";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

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
  onBulkChangeOrigin?: (selected: CompanyEntity[]) => void;
  /** Slot azioni a destra in toolbar (es. "Sincronizza"). */
  toolbarRightSlot?: React.ReactNode;
  /** Trailing label per il breadcrumb del GoldenLayout. */
  trailingLabel?: string | null;
  testId?: string;
  /** Override esterno del sort (es. dalla sidebar globale). Se presente, ignora useListSort. */
  sortOverride?: {
    sortKey: CompanySortKey;
    sortDir: "asc" | "desc";
    onChange: (key: CompanySortKey, dir: "asc" | "desc") => void;
  };
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
  onBulkChangeOrigin,
  toolbarRightSlot,
  trailingLabel,
  testId,
  sortOverride,
}: EntityListWithDetailProps): React.ReactElement {
  const { filters: globalFilters, batchUpdate } = useGlobalFilters();
  const internal = useListSort<CompanySortKey>(sortStorageKey, "name");
  const sortKey = sortOverride?.sortKey ?? internal.sortKey;
  const sortDir = sortOverride?.sortDir ?? internal.sortDir;
  const cycle = (key: CompanySortKey) => {
    if (sortOverride) {
      const nextDir: "asc" | "desc" =
        sortOverride.sortKey === key
          ? sortOverride.sortDir === "asc"
            ? "desc"
            : "asc"
          : "asc";
      sortOverride.onChange(key, nextDir);
    } else {
      internal.cycle(key);
    }
  };
  const handleSelectSortKey = (key: CompanySortKey) => {
    if (sortOverride) {
      sortOverride.onChange(key, "asc");
    } else {
      internal.setSortKey(key);
    }
  };
  const handleToggleSortDir = () => {
    if (sortOverride) {
      sortOverride.onChange(sortOverride.sortKey, sortOverride.sortDir === "asc" ? "desc" : "asc");
    } else {
      internal.toggleDir();
    }
  };
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<CompanyFiltersState>({});
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Click bandiera → toggle paese (sync con global filters per WCA/CRM così
  // si allinea a CountryGridV2). Per BCA usiamo solo lo stato locale.
  const handleCountryClick = React.useCallback((code: string) => {
    const upper = (code || "").toUpperCase();
    if (!upper) return;
    if (source === "wca") {
      const current = new Set(globalFilters.networkSelectedCountries ?? new Set<string>());
      if (current.has(upper)) current.delete(upper);
      else { current.clear(); current.add(upper); }
      batchUpdate({ networkSelectedCountries: current });
      return;
    }
    if (source === "crm") {
      const current = new Set(globalFilters.crmSelectedCountries ?? new Set<string>());
      if (current.has(upper)) current.delete(upper);
      else { current.clear(); current.add(upper); }
      batchUpdate({ crmSelectedCountries: current });
      return;
    }
    setFilters((f) => ({ ...f, country: f.country === upper ? null : upper }));
  }, [source, globalFilters, batchUpdate]);

  const handleCityClick = React.useCallback((city: string) => {
    const v = (city || "").trim();
    if (!v) return;
    setFilters((f) => ({
      ...f,
      city: (f.city ?? "").toLowerCase() === v.toLowerCase() ? null : v,
    }));
  }, []);

  // Default: escludi holding pattern. Persistito per source.
  const holdingStorageKey = `list:${source}:holding`;
  const [holdingFilter, setHoldingFilter] = useState<HoldingFilterMode>(() => {
    if (typeof window === "undefined") return "exclude";
    try {
      const v = window.localStorage.getItem(holdingStorageKey);
      return v === "include" || v === "only" ? v : "exclude";
    } catch {
      return "exclude";
    }
  });
  const updateHoldingFilter = (m: HoldingFilterMode) => {
    setHoldingFilter(m);
    try { window.localStorage.setItem(holdingStorageKey, m); } catch { /* swallow */ }
  };

  // Step 0a: arricchisci con "occupazione" derivata da code/cockpit/draft.
  const { busy } = useBusyPartners();
  const enrichedCompanies = useMemo(() => {
    if (busy.size === 0) return companies;
    return companies.map((c) => {
      if (c.meta?.holding === true) return c;
      if (!busy.has(c.id)) return c;
      return { ...c, meta: { ...(c.meta ?? {}), holding: true } };
    });
  }, [companies, busy]);

  // Step 0b: filtro holding (sempre visibile/applicato).
  const holdingFiltered = useMemo(() => {
    if (holdingFilter === "include") return enrichedCompanies;
    const isHolding = (c: CompanyEntity) =>
      c.meta?.holding === true || c.leadStatus === "holding";
    if (holdingFilter === "only") return enrichedCompanies.filter(isHolding);
    return enrichedCompanies.filter((c) => !isHolding(c)); // exclude
  }, [enrichedCompanies, holdingFilter]);
  const filtered = useFilteredCompanies(holdingFiltered, filters);
  const sorted = useSortedCompanies(filtered, sortKey, sortDir, search);

  const selection = useCompanySelection();
  const visibleIds = useMemo(() => sorted.map((c) => c.id), [sorted]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selection.isSelected(id));

  const selectedCompanies = useMemo(
    () => companies.filter((c) => selection.isSelected(c.id)),
    [companies, selection]
  );

  const activeFiltersCount = countActiveFilters(filters);

  // Estendi i chip globali con i filtri locali country/city (display-only:
  // l'utente li toglie ri-cliccando bandiera/città oppure dal drawer filtri).
  const mergedChips = useMemo<ActiveFilterChip[]>(() => {
    const out: ActiveFilterChip[] = [...(globalChips ?? [])];
    if (filters.country) {
      out.push({ key: `local-country:${filters.country}`, label: `Paese: ${filters.country}`, tone: "primary" });
    }
    if (filters.city) {
      out.push({ key: `local-city:${filters.city}`, label: `Città: ${filters.city}`, tone: "primary" });
    }
    return out;
  }, [globalChips, filters.country, filters.city]);

  // Auto-focus prima entità se non c'è dettaglio aperto e nessuna selezione attiva.
  // Dispatcha l'handler appropriato (contatto o azienda) e il dettaglio si apre da solo.
  const autoFocusedRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (isLoading) return;
    if (detailSlot) { autoFocusedRef.current = null; return; }
    if (selection.count > 0) return;
    if (sorted.length === 0) return;
    const first = sorted[0];
    if (autoFocusedRef.current === first.id) return;
    autoFocusedRef.current = first.id;
    if (onOpenContact) onOpenContact({ id: first.id, raw: first }, first);
    else if (onOpenCompany) onOpenCompany(first);
  }, [isLoading, detailSlot, selection.count, sorted, onOpenContact, onOpenCompany]);

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
        onSelectSortKey={handleSelectSortKey}
        onToggleSortDir={handleToggleSortDir}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={searchPlaceholder ?? "Cerca…"}
        chips={mergedChips}
        holdingFilter={holdingFilter}
        onHoldingFilterChange={updateHoldingFilter}
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
          onCountryClick={handleCountryClick}
          onCityClick={handleCityClick}
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

  // Quando 1+ selezionati (checkbox) → bulk panel; altrimenti dettaglio singolo
  // (apertura via click sulla card, indipendente dalla selezione checkbox).
  const right = (() => {
    if (selection.count >= 1) {
      return (
        <BulkActionsPanel
          selected={selectedCompanies}
          onClear={selection.clear}
          onAddToCockpit={onBulkAddToCockpit}
          onDeepSearch={onBulkDeepSearch}
          onCreateCampaign={onBulkCreateCampaign}
          onSoftDelete={onBulkSoftDelete}
          onChangeOrigin={onBulkChangeOrigin}
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
      trailingLabel={selection.count >= 1 ? `${selection.count} selezionati` : trailingLabel ?? null}
      hideHeader
    />
  );
}

export default EntityListWithDetail;