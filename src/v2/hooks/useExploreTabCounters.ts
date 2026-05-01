/**
 * useExploreTabCounters — Count leggeri per ogni tab della sezione Esplora.
 * Mostrati nell'ExploreContextHeader. Usa `head: true, count: 'exact'` per
 * non scaricare righe. staleTime 60s per evitare hammering.
 *
 * Pattern: nessuna logica di rendering qui, solo dati formattati `it-IT`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";
import { useCountryStats } from "@/hooks/useCountryStats";

export interface ExploreTabCounters {
  readonly network: number | null;
  readonly contacts: number | null;
  readonly biglietti: number | null;
  readonly map: number | null;
}

async function fetchCount(table: "imported_contacts" | "business_cards"): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export function useExploreTabCounters(): ExploreTabCounters {
  const country = useCountryStats();

  const contactsQ = useQuery({
    queryKey: [...queryKeys.explore.counters, "contacts"] as const,
    queryFn: () => fetchCount("imported_contacts"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const bigliettiQ = useQuery({
    queryKey: [...queryKeys.explore.counters, "biglietti"] as const,
    queryFn: () => fetchCount("business_cards"),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const networkTotal =
    country.data?.global?.total ??
    (country.data?.global as { total?: number } | undefined)?.total ??
    null;

  const mapActive = country.data
    ? Object.values(country.data.byCountry ?? {}).filter(
        (c) => (c?.total_partners ?? 0) > 0,
      ).length
    : null;

  return {
    network: typeof networkTotal === "number" ? networkTotal : null,
    contacts: contactsQ.data ?? null,
    biglietti: bigliettiQ.data ?? null,
    map: mapActive,
  };
}