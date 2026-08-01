import { queryKeys } from "@/lib/queryKeys";
import type { ContactFilters } from "./types";

export const contactKeys = {
  all: ["contacts"] as const,
  filtered: (f: ContactFilters) => ["contacts", f] as const,
  interactions: (id: string) => ["contact-interactions", id] as const,
  filterOptions: ["contacts-filter-options"] as const,
  holdingPattern: queryKeys.contacts.holdingPattern,
  holdingPatternStats: ["holding-pattern-stats"] as const,
};
