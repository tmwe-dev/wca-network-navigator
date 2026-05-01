/**
 * BCAFiltersRailContent — contenuto della linguetta globale per la maschera
 * Biglietti (CRM › Biglietti e Network › BCA). Riusa `BcaCountrySidebar`
 * collegandolo allo stato condiviso del `BcaFiltersProvider`.
 */
import { BcaCountrySidebar } from "@/components/operations/bca/BcaCountrySidebar";
import { useBcaFilters } from "./BcaFiltersContext";

export function BCAFiltersRailContent() {
  const g = useBcaFilters();
  if (!g) {
    return (
      <p className="text-[11px] text-muted-foreground">
        I filtri si attivano dentro la sezione Biglietti.
      </p>
    );
  }
  return (
    <BcaCountrySidebar
      countries={g.countries}
      totalCompanies={g.totalCompanies}
      totalContacts={g.totalContacts}
      selectedCountry={g.selectedCountry}
      onSelectCountry={g.setSelectedCountry}
      onlyMatched={g.onlyMatched}
      onSetOnlyMatched={g.setOnlyMatched}
      onlyWithEmail={g.onlyWithEmail}
      onSetOnlyWithEmail={g.setOnlyWithEmail}
      hideHolding={g.hideHolding}
      holdingCount={g.holdingCount}
      onSetHideHolding={g.setHideHolding}
      sortMode={g.sortMode}
      onSetSortMode={g.setSortMode}
      viewMode={g.viewMode}
      onSetViewMode={g.setViewMode}
    />
  );
}