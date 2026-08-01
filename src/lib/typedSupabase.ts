/**
 * Confine UNICO di accesso a tabelle il cui nome non è noto ai tipi generati.
 *
 * Questo file è l'unico punto sanzionato del repository in cui il query
 * builder PostgREST viene usato senza tipizzazione generata. Il builder è
 * fortemente polimorfico (select/eq/in/order/insert/update/delete/upsert…) e
 * non è modellabile a mano; l'unsafe cast è quindi confinato qui.
 *
 * Regole:
 * - nessun altro modulo può replicare il cast;
 * - i chiamanti devono validare tabella/colonne contro una whitelist quando il
 *   nome arriva a runtime (vedi `src/data/validatedQuery.ts`);
 * - una tabella che entra nei tipi generati va rimossa da
 *   `KNOWN_UNTYPED_TABLES` e migrata a `supabase.from(...)`.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Lista esplicita delle tabelle che richiedono accesso non tipizzato.
 * Documentazione, non vincolo runtime — `tFrom` accetta string.
 */
export const KNOWN_UNTYPED_TABLES = [
  // Deal pipeline (schema mismatch con i tipi generati)
  "deals",
  "deal_activities",
  // Audit / supervisor
  "supervisor_audit_log",
  // Email intel
  "email_prompts",
  "operative_prompts",
  "commercial_playbooks",
  // Misc settings
  "app_settings",
  // TMWE integration
  "tmwe_user_connections_v",
  "tmwe_partner_links",
  "tmwe_customer_snapshot",
  "tmwe_revenue_monthly",
] as const;

export type KnownUntypedTable = (typeof KNOWN_UNTYPED_TABLES)[number];

/** Unica funzione di accesso non tipizzato del repository. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tFrom(table: KnownUntypedTable | string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}
