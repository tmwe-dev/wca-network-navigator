/**
 * DAL — RA Dashboard stats (READ-only)
 *
 * Le tabelle `ra_prospects` / `ra_scraping_jobs` non esistono in `public`
 * (verificato su information_schema): le 7 query aggregate precedenti
 * fallivano tutte con 42P01 e venivano silenziate, producendo esattamente
 * lo stato a zero restituito qui — senza però i 7 round-trip di rete.
 *
 * Contratto osservabile invariato per React Query: nessun throw, nessun
 * isError, stesse chiavi e stessi valori neutri.
 */
import { unavailableRead } from "@/data/_shared/unavailableSchema";
import type { RADashboardStats } from "@/types/ra";

export async function fetchRaDashboardStats(): Promise<RADashboardStats> {
  return unavailableRead<RADashboardStats>("ra_prospects", {
    totalProspects: 0,
    withEmail: 0,
    withPec: 0,
    withPhone: 0,
    topAteco: [],
    recentProspects: [],
    activeJobs: [],
  });
}
