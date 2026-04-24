/**
 * P3.5 — Typed Supabase query helpers
 *
 * Centralizza tutti i cast `(supabase as any).from(table)` per le
 * tabelle non presenti nei tipi generati o con schema mismatch noto.
 *
 * Pattern d'uso:
 *   import { tFrom } from "@/lib/typedSupabase";
 *   const { data } = await tFrom("ra_prospects").select("*");
 *
 * Per nuove tabelle, aggiungere il nome qui in `KNOWN_UNTYPED_TABLES`
 * così che siano documentate e ricercabili. Una volta che la tabella
 * entra nei tipi generati, rimuovere l'entry e migrare i call site
 * a `supabase.from(...)` standard.
 *
 * Vedi anche: `src/lib/supabaseUntyped.ts` (versione legacy della
 * stessa idea — qui forniamo l'API canonica).
 */
import { untypedFrom } from "@/lib/supabaseUntyped";

/**
 * Lista esplicita delle tabelle che richiedono accesso untyped.
 * Documentazione, non vincolo runtime — `tFrom` accetta string.
 */
export const KNOWN_UNTYPED_TABLES = [
  // RA module (research/acquisition)
  "ra_prospects",
  "ra_contacts",
  "ra_interactions",
  "ra_scraping_jobs",
  // Deal pipeline (schema mismatch)
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
] as const;

export type KnownUntypedTable = (typeof KNOWN_UNTYPED_TABLES)[number];

/**
 * Unica funzione di accesso untyped raccomandata.
 * Alias breve di `untypedFrom` per ridurre verbosity nei call site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function tFrom(table: KnownUntypedTable | string): any {
  return untypedFrom(table);
}