import { useQuery } from "@tanstack/react-query";
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { RADashboardStats, RAProspect, RAScrapingJob } from "@/types/ra";

const RA_DASHBOARD_KEY = ["ra-dashboard"] as const;

export function useRADashboard() {
  return useQuery({
    queryKey: RA_DASHBOARD_KEY,
    queryFn: async (): Promise<RADashboardStats> => {
      const [
        { count: totalProspects },
        { count: withEmail },
        { count: withPec },
        { count: withPhone },
        { data: recentProspects },
        { data: activeJobs },
        { data: atecoData },
      ] = await Promise.all([
        untypedFrom("ra_prospects").select("*", { count: "exact", head: true }),
        untypedFrom("ra_prospects").select("*", { count: "exact", head: true }).not("email", "is", null),
        untypedFrom("ra_prospects").select("*", { count: "exact", head: true }).not("pec", "is", null),
        untypedFrom("ra_prospects").select("*", { count: "exact", head: true }).not("phone", "is", null),
        untypedFrom("ra_prospects").select("*").order("created_at", { ascending: false }).limit(10),
        untypedFrom("ra_scraping_jobs").select("*").in("status", ["pending", "running"]).order("created_at", { ascending: false }).limit(5),
        untypedFrom("ra_prospects").select("codice_ateco, descrizione_ateco"),
      ]) as any; // eslint-disable-line @typescript-eslint/no-explicit-any -- boundary cast

      const atecoMap = new Map<string, { description: string; count: number }>();
      ((atecoData ?? []) as Record<string, string>[]).forEach((p) => {
        if (!p.codice_ateco) return;
        const existing = atecoMap.get(p.codice_ateco);
        if (existing) {
          existing.count++;
        } else {
          atecoMap.set(p.codice_ateco, {
            description: p.descrizione_ateco ?? p.codice_ateco,
            count: 1,
          });
        }
      });

      const topAteco = Array.from(atecoMap.entries())
        .map(([code, { description, count }]) => ({ code, description, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalProspects: totalProspects ?? 0,
        withEmail: withEmail ?? 0,
        withPec: withPec ?? 0,
        withPhone: withPhone ?? 0,
        topAteco,
        recentProspects: (recentProspects ?? []) as RAProspect[],
        activeJobs: (activeJobs ?? []) as RAScrapingJob[],
      };
    },
    staleTime: 30_000,
  });
}
