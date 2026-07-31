import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { countAllProspects, getAllProspectsForAtecoGroups } from "@/data/prospectStatsQueries";

export interface AtecoGroup {
  codice_ateco: string;
  descrizione_ateco: string;
  count: number;
  with_email: number;
  with_pec: number;
  with_phone: number;
  avg_fatturato: number | null;
}

export interface ProspectGlobalStats {
  total: number;
  withEmail: number;
  withPec: number;
  withPhone: number;
  avgFatturato: number | null;
  atecoSections: number;
  regions: string[];
  provinces: string[];
}

export function useProspectStats() {
  return useQuery({
    queryKey: queryKeys.prospects.globalStats,
    queryFn: async () => {
      // Use count-only query instead of fetching all rows
      const total = await countAllProspects();

      return {
        total,
        withEmail: 0,
        withPec: 0,
        withPhone: 0,
        avgFatturato: null,
        atecoSections: 0,
        regions: [],
        provinces: [],
      } as ProspectGlobalStats;
    },
    staleTime: 5 * 60_000,
  });
}

export function useAtecoGroups() {
  return useQuery({
    queryKey: ["ateco-groups"],
    queryFn: async () => {
      const rows = await getAllProspectsForAtecoGroups();

      const map = new Map<string, AtecoGroup>();
      for (const r of rows) {
        if (!r.codice_ateco) continue;
        const key = r.codice_ateco;
        if (!map.has(key)) {
          map.set(key, {
            codice_ateco: key,
            descrizione_ateco: r.descrizione_ateco || "",
            count: 0,
            with_email: 0,
            with_pec: 0,
            with_phone: 0,
            avg_fatturato: null,
          });
        }
        const g = map.get(key)!;
        g.count++;
        if (r.email) g.with_email++;
        if (r.pec) g.with_pec++;
        if (r.phone) g.with_phone++;
      }

      // Calculate avg fatturato per group
      const fatMap = new Map<string, number[]>();
      for (const r of rows) {
        if (!r.codice_ateco || r.fatturato == null) continue;
        if (!fatMap.has(r.codice_ateco)) fatMap.set(r.codice_ateco, []);
        fatMap.get(r.codice_ateco)!.push(Number(r.fatturato));
      }
      for (const [k, vals] of fatMap) {
        const g = map.get(k);
        if (g) g.avg_fatturato = vals.reduce((a, b) => a + b, 0) / vals.length;
      }

      return [...map.values()].sort((a, b) => a.codice_ateco.localeCompare(b.codice_ateco));
    },
    staleTime: 60_000,
  });
}
