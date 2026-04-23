/**
 * Typed escape hatch for Supabase tables not yet in the generated types.
 * Use `untypedFrom(tableName)` instead of `supabase.from(tableName)`.
 *
 * This is the SINGLE place in the codebase where a Supabase `any` cast
 * is permitted. All RA-module consumers (ra_prospects, ra_contacts,
 * ra_interactions, ra_scraping_jobs) use this helper instead of casting
 * individually. Once these tables are added to the generated schema,
 * this file should be deleted.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Access a Supabase table that isn't in the generated types yet.
 * Returns a PostgREST query builder with loose typing.
 *
 * This is the single boundary cast in the codebase where we use an untyped
 * query builder. The RA module tables (ra_prospects, ra_contacts, etc.) use
 * this helper until they're added to the generated schema.
 */
export function untypedFrom(table: string): Record<string, (...args: unknown[]) => unknown> {
  return ((supabase as unknown) as Record<string, (...args: unknown[]) => unknown>).from(table);
}
