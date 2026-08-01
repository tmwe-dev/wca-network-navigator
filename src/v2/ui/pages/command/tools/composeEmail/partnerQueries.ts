/**
 * Thin re-export shim — la logica di accesso dati è stata spostata nel DAL
 * `src/data/commandPartnerLookup.ts` (stessi filtri, order, limit, select).
 */
import type { ContactRow, PartnerRow } from "./types";
import {
  searchPartnersByCountry as _searchPartnersByCountry,
  fetchPartnersByIds as _fetchPartnersByIds,
  searchPartner as _searchPartner,
  findPartnerContact,
  fetchPrimaryContact,
  fetchPartnersByFilters as _fetchPartnersByFilters,
} from "@/application/data/commandPartnerLookup";

export async function searchPartnersByCountry(countryCode: string): Promise<PartnerRow[]> {
  return (await _searchPartnersByCountry(countryCode)) as PartnerRow[];
}

export async function fetchPartnersByIds(ids: ReadonlyArray<string>): Promise<PartnerRow[]> {
  return (await _fetchPartnersByIds(ids)) as PartnerRow[];
}

export async function searchPartner(company: string | null, email: string | null): Promise<PartnerRow[]> {
  return (await _searchPartner(company, email)) as PartnerRow[];
}

export async function findContact(partnerId: string, person: string | null, email: string | null): Promise<ContactRow | null> {
  return (await findPartnerContact(partnerId, person, email)) as ContactRow | null;
}

export { fetchPrimaryContact };

export async function fetchPartnersByFilters(
  filters: ReadonlyArray<{ column: string; op: string; value: unknown }>,
): Promise<PartnerRow[]> {
  return (await _fetchPartnersByFilters(filters)) as PartnerRow[];
}
