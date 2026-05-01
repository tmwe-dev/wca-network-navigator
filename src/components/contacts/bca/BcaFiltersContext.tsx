/**
 * BcaFiltersContext — Provider che monta `useBcaGrouping` su un set di cards
 * condiviso (cache di `useBusinessCards`) e lo espone sia alla pagina dei
 * Biglietti (BCAUnifiedHub / BusinessCardsView) sia alla linguetta globale
 * `ContextFiltersRail`. In questo modo i filtri/paesi vivono nella sidebar
 * a scomparsa standard, esattamente come per WCA Partner.
 */
import * as React from "react";
import { createContext, useContext } from "react";
import { useBusinessCards } from "@/hooks/useBusinessCards";
import { useBcaGrouping } from "@/components/operations/bca/useBcaGrouping";

type BcaFiltersValue = ReturnType<typeof useBcaGrouping> & {
  totalContacts: number;
};

const BcaFiltersContext = createContext<BcaFiltersValue | null>(null);

export function BcaFiltersProvider({ children }: { children: React.ReactNode }) {
  const { data: cards = [] } = useBusinessCards();
  const g = useBcaGrouping(cards);
  const value: BcaFiltersValue = { ...g, totalContacts: cards.length };
  return <BcaFiltersContext.Provider value={value}>{children}</BcaFiltersContext.Provider>;
}

export function useBcaFilters(): BcaFiltersValue | null {
  return useContext(BcaFiltersContext);
}

export function useBcaFiltersStrict(): BcaFiltersValue {
  const ctx = useContext(BcaFiltersContext);
  if (!ctx) throw new Error("useBcaFiltersStrict must be used inside <BcaFiltersProvider>");
  return ctx;
}