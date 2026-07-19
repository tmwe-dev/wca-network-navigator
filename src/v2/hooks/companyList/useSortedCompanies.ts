/**
 * useSortedCompanies — ordina + filtra in-memory una lista CompanyEntity.
 * Usato dalla ListToolbar (chiavi sort dichiarate dal consumer).
 */
import { useMemo } from "react";
import type { CompanyEntity } from "@/v2/ui/molecules/CompanyCardList";

export type CompanySortKey =
  | "name"
  | "city"
  | "country"
  | "wcaYears"
  | "score"
  | "contactsCount"
  | "lastInteraction"
  | "interactions";

function cmp<T>(a: T, b: T): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { sensitivity: "base" });
}

export function useSortedCompanies(
  companies: CompanyEntity[],
  sortKey: CompanySortKey,
  sortDir: "asc" | "desc",
  search: string
): CompanyEntity[] {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? companies.filter((c) => {
          if (c.name.toLowerCase().includes(q)) return true;
          if (c.city?.toLowerCase().includes(q)) return true;
          if (c.primaryContact?.name?.toLowerCase().includes(q)) return true;
          return false;
        })
      : companies;
    const sorted = [...filtered].sort((a, b) => {
      let r = 0;
      switch (sortKey) {
        case "name":
          r = cmp(a.name, b.name);
          break;
        case "city":
          r = cmp(a.city ?? "", b.city ?? "");
          break;
        case "country":
          r = cmp(a.countryCode ?? "", b.countryCode ?? "");
          break;
        case "wcaYears":
          r = cmp(a.meta?.wcaYears ?? null, b.meta?.wcaYears ?? null);
          break;
        case "score":
          r = cmp(a.score ?? null, b.score ?? null);
          break;
        case "contactsCount":
          r = cmp(a.contactsCount, b.contactsCount);
          break;
        case "lastInteraction":
          r = cmp(
            a.lastInteractionAt ? new Date(a.lastInteractionAt).getTime() : null,
            b.lastInteractionAt ? new Date(b.lastInteractionAt).getTime() : null
          );
          break;
        case "interactions":
          r = cmp(a.interactionCount ?? 0, b.interactionCount ?? 0);
          break;
      }
      return sortDir === "asc" ? r : -r;
    });
    return sorted;
  }, [companies, sortKey, sortDir, search]);
}