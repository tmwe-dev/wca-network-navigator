/**
 * enrichmentCacheInvalidation — LOVABLE-77B
 *
 * Helper centralizzato per invalidare TUTTE le query React-Query che dipendono
 * dallo stato di arricchimento di un partner. Da chiamare al termine di:
 *   • Deep Search (per-partner E a fine batch)
 *   • Sherlock Investigation (success / aborted / failed)
 *   • Base Enrichment (enrich-partner-website)
 *
 * Mantenere UNA sola fonte di verità garantisce che Settings → Arricchimento
 * e l'OraclePanel di Email Forge si aggiornino in tempo reale, senza F5.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";

export function invalidateEnrichmentCaches(
  qc: QueryClient,
  partnerId?: string | null,
): void {
  // Settings → Arricchimento (lista partner + lista contatti + BCA)
  qc.invalidateQueries({ queryKey: queryKeys.partners.enrichment() });
  qc.invalidateQueries({ queryKey: queryKeys.enrichment.contacts() });
  qc.invalidateQueries({ queryKey: queryKeys.enrichment.bca() });

  // OraclePanel di Email Forge (snapshot real-time)
  if (partnerId) {
    qc.invalidateQueries({ queryKey: ["enrichment-snapshot", partnerId] });
  } else {
    // Refresh tutti gli snapshot (usato a fine batch)
    qc.invalidateQueries({ queryKey: ["enrichment-snapshot"] });
  }

  // Lista partner generica (badge "Deep" su PartnerCard ecc.)
  qc.invalidateQueries({ queryKey: queryKeys.partners.all });
}