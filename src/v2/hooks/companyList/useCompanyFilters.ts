/**
 * useCompanyFilters — predicati pure-function applicati lato client a una
 * lista CompanyEntity. Tutti i filtri sono opzionali: quando vuoti/false
 * non filtrano.
 *
 * Coerente con il design "filtri = predicati", riusabile su WCA / CRM / BCA.
 */
import { useMemo } from "react";
import type { CompanyEntity } from "@/v2/ui/molecules/CompanyCardList";

export type RecencyBucket = "any" | "never" | "lt7" | "lt30" | "gt90";
export type TriBool = "any" | "yes" | "no";

export interface CompanyFiltersState {
  hasEmail?: boolean;
  hasPhone?: boolean;
  hasWebsite?: boolean;
  hasLinkedin?: boolean;
  hasLogo?: boolean;
  hasBca?: boolean;
  favoritesOnly?: boolean;
  /** "any" / "in" / "out" rispetto al circuito di attesa. */
  holding?: "any" | "in" | "out";
  /** Tipo ufficio (HQ / Branch). */
  officeType?: string | null;
  /** Filtro paese (ISO code uppercase) applicato dal click bandiera nelle card. */
  country?: string | null;
  /** Filtro città (case-insensitive) applicato dal click città nelle card. */
  city?: string | null;
  /** Filtra per uno o più lead_status. */
  leadStatus?: string[];
  /** Filtra per uno o più network di affiliazione. */
  networks?: string[];
  /** Filtra per uno o più servizi. */
  services?: string[];
  /** Filtra per una o più certificazioni. */
  certifications?: string[];
  /** Range anni in WCA. */
  wcaYearsMin?: number | null;
  wcaYearsMax?: number | null;
  /** Range score 0-100. */
  scoreMin?: number | null;
  scoreMax?: number | null;
  /** Recency ultimo contatto. */
  recency?: RecencyBucket;
  /** Deep search fatto. */
  deepSearch?: TriBool;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function recencyBucket(iso: string | null | undefined): RecencyBucket {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "never";
  const days = (Date.now() - t) / DAY_MS;
  if (days < 7) return "lt7";
  if (days < 30) return "lt30";
  if (days > 90) return "gt90";
  return "any";
}

function inRange(value: number | null | undefined, min?: number | null, max?: number | null): boolean {
  if (value == null) return min == null && max == null;
  if (min != null && value < min) return false;
  if (max != null && value > max) return false;
  return true;
}

export function applyCompanyFilters(companies: CompanyEntity[], f: CompanyFiltersState): CompanyEntity[] {
  if (!f) return companies;
  const wantedCountry = f.country ? f.country.toUpperCase() : null;
  const wantedCity = f.city ? f.city.trim().toLowerCase() : null;
  return companies.filter((c) => {
    if (f.hasEmail && !c.channels?.email) return false;
    if (f.hasPhone && !c.channels?.phone) return false;
    if (f.hasWebsite && !c.hasWebsite) return false;
    if (f.hasLinkedin && !c.hasLinkedin) return false;
    if (f.hasLogo && !c.hasLogo) return false;
    if (f.hasBca && !c.hasBca) return false;
    if (f.favoritesOnly && !c.isFavorite) return false;

    if (f.holding === "in" && !c.meta?.holding) return false;
    if (f.holding === "out" && c.meta?.holding) return false;

    if (f.officeType && (c.officeType ?? "") !== f.officeType) return false;

    if (wantedCountry) {
      const cc = (c.countryCode ?? "").toUpperCase();
      if (cc !== wantedCountry) return false;
    }
    if (wantedCity) {
      const cc = (c.city ?? "").trim().toLowerCase();
      if (cc !== wantedCity) return false;
    }

    if (f.leadStatus && f.leadStatus.length > 0) {
      if (!c.leadStatus || !f.leadStatus.includes(c.leadStatus)) return false;
    }

    if (f.networks && f.networks.length > 0) {
      const set = new Set(c.networks ?? []);
      if (!f.networks.some((n) => set.has(n))) return false;
    }
    if (f.services && f.services.length > 0) {
      const set = new Set(c.services ?? []);
      if (!f.services.some((n) => set.has(n))) return false;
    }
    if (f.certifications && f.certifications.length > 0) {
      const set = new Set(c.certifications ?? []);
      if (!f.certifications.some((n) => set.has(n))) return false;
    }

    if (!inRange(c.meta?.wcaYears ?? null, f.wcaYearsMin, f.wcaYearsMax)) return false;
    if (!inRange(c.score ?? null, f.scoreMin, f.scoreMax)) return false;

    if (f.recency && f.recency !== "any") {
      const b = recencyBucket(c.lastInteractionAt);
      if (b !== f.recency) return false;
    }

    if (f.deepSearch === "yes" && !c.enrichedAt) return false;
    if (f.deepSearch === "no" && c.enrichedAt) return false;

    return true;
  });
}

/** Conta i filtri attivi (per badge UI). */
export function countActiveFilters(f: CompanyFiltersState): number {
  let n = 0;
  if (f.hasEmail) n++;
  if (f.hasPhone) n++;
  if (f.hasWebsite) n++;
  if (f.hasLinkedin) n++;
  if (f.hasLogo) n++;
  if (f.hasBca) n++;
  if (f.favoritesOnly) n++;
  if (f.holding && f.holding !== "any") n++;
  if (f.officeType) n++;
  if (f.country) n++;
  if (f.city) n++;
  if (f.leadStatus && f.leadStatus.length > 0) n++;
  if (f.networks && f.networks.length > 0) n++;
  if (f.services && f.services.length > 0) n++;
  if (f.certifications && f.certifications.length > 0) n++;
  if (f.wcaYearsMin != null || f.wcaYearsMax != null) n++;
  if (f.scoreMin != null || f.scoreMax != null) n++;
  if (f.recency && f.recency !== "any") n++;
  if (f.deepSearch && f.deepSearch !== "any") n++;
  return n;
}

export function useFilteredCompanies(
  companies: CompanyEntity[],
  filters: CompanyFiltersState
): CompanyEntity[] {
  return useMemo(() => applyCompanyFilters(companies, filters), [companies, filters]);
}