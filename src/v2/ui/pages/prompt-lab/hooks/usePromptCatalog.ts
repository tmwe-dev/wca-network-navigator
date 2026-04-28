/**
 * usePromptCatalog — react-query hook per il Prompt Catalog.
 *
 * UI logic-less: si limita a leggere il DAL e a esporre filtri derivati.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPromptCatalog, type PromptCatalogItem } from "@/data/promptCatalog";
import { queryKeys } from "@/lib/queryKeys";

export interface PromptCatalogFilters {
  search: string;
  context: string | "all";
  orchestrator: string | "all";
  onlyActive: boolean;
}

export const DEFAULT_CATALOG_FILTERS: PromptCatalogFilters = {
  search: "",
  context: "all",
  orchestrator: "all",
  onlyActive: true,
};

export function usePromptCatalog(userId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.promptCatalog.all(userId ?? "anon"),
    queryFn: () => listPromptCatalog(userId as string),
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function applyCatalogFilters(
  items: PromptCatalogItem[] | undefined,
  filters: PromptCatalogFilters,
): PromptCatalogItem[] {
  if (!items) return [];
  const q = filters.search.trim().toLowerCase();
  return items.filter((it) => {
    if (filters.onlyActive && !it.is_active) return false;
    if (filters.context !== "all" && (it.context ?? "") !== filters.context) return false;
    if (filters.orchestrator !== "all" && !it.orchestrators.includes(filters.orchestrator)) return false;
    if (!q) return true;
    if (it.name.toLowerCase().includes(q)) return true;
    if ((it.context ?? "").toLowerCase().includes(q)) return true;
    if (it.tags.some((t) => t.toLowerCase().includes(q))) return true;
    return false;
  });
}

/** Estrae l'elenco unico di context e orchestratori presenti nel catalogo. */
export function useCatalogFacets(items: PromptCatalogItem[] | undefined) {
  return useMemo(() => {
    const contexts = new Set<string>();
    const orchestrators = new Set<string>();
    for (const it of items ?? []) {
      if (it.context) contexts.add(it.context);
      for (const o of it.orchestrators) orchestrators.add(o);
    }
    return {
      contexts: Array.from(contexts).sort(),
      orchestrators: Array.from(orchestrators).sort(),
    };
  }, [items]);
}