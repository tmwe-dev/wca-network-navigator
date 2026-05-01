/**
 * useActiveFilterChips — Deriva i chip "filtri attivi" dai global filters
 * per WCA e CRM. Display-only.
 *
 * Mantiene la logica di mapping in un hook unico così le pagine restano
 * logic-less.
 */
import { useMemo } from "react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { countryCodeToFlag } from "@/components/operations/bca/bcaUtils";
import type { ActiveFilterChip } from "@/v2/ui/molecules/ActiveFiltersBar";

function countryLabel(code: string): string {
  // Mostra bandiera + codice ISO (es. "🇨🇳 CN").
  // Il nome esteso non è disponibile come mappa centralizzata: il codice ISO
  // è universale e immediatamente riconoscibile.
  const flag = countryCodeToFlag(code);
  return flag ? `${flag} ${code.toUpperCase()}` : code.toUpperCase();
}

function holdingChip(value: string | undefined): ActiveFilterChip | null {
  if (value === "in") {
    return {
      key: "holding:in",
      label: "Solo in circuito di attesa",
      tone: "primary",
      icon: "holding",
    };
  }
  if (value === "all") {
    return {
      key: "holding:all",
      label: "Mostra anche in attesa",
      tone: "default",
      icon: "holding",
    };
  }
  // "out" è il default → nessun chip
  return null;
}

/** Chip per la pagina WCA Network (CompanyCardList sorgente "wca"). */
export function useWcaActiveFilterChips(): ActiveFilterChip[] {
  const { filters } = useGlobalFilters();
  return useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    const countries = Array.from(
      filters.networkSelectedCountries ?? new Set<string>()
    ) as string[];
    for (const c of countries) {
      chips.push({ key: `country:${c}`, label: countryLabel(c) });
    }
    if (filters.networkSearch) {
      chips.push({
        key: `search:${filters.networkSearch}`,
        label: `Ricerca: "${filters.networkSearch}"`,
        tone: "default",
      });
    }
    const h = holdingChip(filters.holdingPattern);
    if (h) chips.push(h);
    return chips;
  }, [filters]);
}

/** Chip per la pagina CRM Contacts (CompanyCardList sorgente "crm"). */
export function useCrmActiveFilterChips(): ActiveFilterChip[] {
  const { filters } = useGlobalFilters();
  return useMemo(() => {
    const chips: ActiveFilterChip[] = [];
    const countries = Array.from(
      filters.crmSelectedCountries ?? new Set<string>()
    ) as string[];
    for (const c of countries) {
      chips.push({ key: `country:${c}`, label: countryLabel(c) });
    }
    const origins = Array.from(
      filters.crmOrigin ?? new Set<string>()
    ) as string[];
    for (const o of origins) {
      chips.push({ key: `origin:${o}`, label: `Origine: ${o}` });
    }
    if (filters.crmQuality && filters.crmQuality !== "all") {
      chips.push({
        key: `quality:${filters.crmQuality}`,
        label: `Qualità: ${filters.crmQuality}`,
      });
    }
    if (filters.crmChannel && filters.crmChannel !== "all") {
      chips.push({
        key: `channel:${filters.crmChannel}`,
        label: `Canale: ${filters.crmChannel}`,
      });
    }
    if (filters.crmWcaMatch && filters.crmWcaMatch !== "all") {
      chips.push({
        key: `wca:${filters.crmWcaMatch}`,
        label:
          filters.crmWcaMatch === "matched"
            ? "Solo WCA matched"
            : "Solo non-WCA",
        tone: "primary",
      });
    }
    if (filters.search) {
      chips.push({
        key: `search:${filters.search}`,
        label: `Ricerca: "${filters.search}"`,
      });
    }
    const h = holdingChip(filters.holdingPattern);
    if (h) chips.push(h);
    return chips;
  }, [filters]);
}