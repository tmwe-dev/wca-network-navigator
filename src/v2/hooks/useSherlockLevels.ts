/**
 * useSherlockLevels — react-query hook che restituisce il massimo livello
 * Sherlock completato (1=Scout, 2=Detective, 3=Sherlock) per una lista di
 * partner_id o contact_id.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  getMaxLevelByPartner,
  getMaxLevelByContact,
  type SherlockLevelMap,
} from "@/data/sherlockInvestigations";

export function useSherlockLevels(
  scope: "partner" | "contact",
  ids: readonly string[],
): SherlockLevelMap {
  const cleanIds = (ids ?? []).filter(Boolean);
  const query = useQuery({
    queryKey: queryKeys.v2.sherlockLevels(scope, cleanIds),
    queryFn: () =>
      scope === "partner"
        ? getMaxLevelByPartner(cleanIds)
        : getMaxLevelByContact(cleanIds),
    enabled: cleanIds.length > 0,
    staleTime: 30_000,
  });
  return query.data ?? {};
}

export function useSherlockLevel(
  scope: "partner" | "contact",
  id: string | null | undefined,
) {
  const map = useSherlockLevels(scope, id ? [id] : []);
  return id ? map[id] ?? null : null;
}
