/**
 * DAL — RA Dashboard stats (READ-only)
 *
 * Aggregatore per `useRADashboard` (batch D3). Consolida 7 query
 * `untypedFrom(...)` READ-only precedentemente inline in
 * `src/hooks/useRADashboard.ts`. Nessuna scrittura.
 *
 * Semantica errori PRESERVATA identica all'inline originario:
 * l'inline NON leggeva `error` e coalescva `count` con `?? 0` e
 * `data` con `?? []`. Manteniamo lo stesso silenziamento intenzionale
 * per equivalenza osservabile su React Query (nessun `isError`,
 * nessun retry, nessun logging). Non aggiungere try/catch, throw,
 * retry o logging.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import type { RADashboardStats, RAProspect, RAScrapingJob } from "@/types/ra";

export async function fetchRaDashboardStats(): Promise<RADashboardStats> {
  const results = (await Promise.all([
    untypedFrom("ra_prospects").select("*", { count: "exact", head: true }),
    untypedFrom("ra_prospects").select("*", { count: "exact", head: true }).not("email", "is", null),
    untypedFrom("ra_prospects").select("*", { count: "exact", head: true }).not("pec", "is", null),
    untypedFrom("ra_prospects").select("*", { count: "exact", head: true }).not("phone", "is", null),
    untypedFrom("ra_prospects").select("*").order("created_at", { ascending: false }).limit(10),
    untypedFrom("ra_scraping_jobs").select("*").in("status", ["pending", "running"]).order("created_at", { ascending: false }).limit(5),
    untypedFrom("ra_prospects").select("codice_ateco, descrizione_ateco"),
  ])) as unknown as Record<string, unknown>[];

  const totalProspects = (results[0] as Record<string, unknown>).count as number | null;
  const withEmail = (results[1] as Record<string, unknown>).count as number | null;
  const withPec = (results[2] as Record<string, unknown>).count as number | null;
  const withPhone = (results[3] as Record<string, unknown>).count as number | null;
  const recentProspects = (results[4] as Record<string, unknown>).data;
  const activeJobs = (results[5] as Record<string, unknown>).data;
  const atecoData = (results[6] as Record<string, unknown>).data;

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
}