import { deriveSenderDisplayName } from "@/lib/senderDisplayName";
import type { AddressRow } from "./SuggestionCard";

export type StatusFilter = "uncategorized" | "categorized" | "all";
export type SortMode = "name-asc" | "name-desc" | "count-desc" | "count-asc";

export interface SuggestedGroupFilter {
  value: string;
  label: string;
  count: number;
  icon: string | null;
}

export function getDomain(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : email;
}

export const rowDisplayName = (r: AddressRow): string =>
  (r.company_name || r.display_name || deriveSenderDisplayName(r.email_address) || r.email_address).toLowerCase();

export function sortRows(rows: AddressRow[], mode: SortMode): AddressRow[] {
  const sorted = [...rows];
  switch (mode) {
    case "name-asc":
      return sorted.sort((a, b) => rowDisplayName(a).localeCompare(rowDisplayName(b), "it", { sensitivity: "base", numeric: true }));
    case "name-desc":
      return sorted.sort((a, b) => rowDisplayName(b).localeCompare(rowDisplayName(a), "it", { sensitivity: "base", numeric: true }));
    case "count-desc":
      return sorted.sort((a, b) => b.email_count - a.email_count);
    case "count-asc":
      return sorted.sort((a, b) => a.email_count - b.email_count);
  }
}

export function groupRowsBySuggestion(rows: AddressRow[]): { key: string; label: string; items: AddressRow[] }[] {
  const buckets = new Map<string, AddressRow[]>();
  rows.forEach((row) => {
    const key = row.ai_suggested_group ?? "__none__";
    const arr = buckets.get(key) ?? [];
    arr.push(row);
    buckets.set(key, arr);
  });
  const entries = Array.from(buckets.entries()).map(([key, items]) => ({
    key,
    label: key === "__none__" ? "Senza suggerimento" : key,
    items,
  }));
  entries.sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    return a.label.localeCompare(b.label, "it", { sensitivity: "base", numeric: true });
  });
  return entries;
}