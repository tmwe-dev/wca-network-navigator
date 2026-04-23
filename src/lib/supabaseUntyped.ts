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
// We deliberately widen the return type to `any` here because PostgREST's
// fluent query builder is highly polymorphic (select / eq / in / order / limit
// / single / maybeSingle / insert / update / delete / upsert ...) and cannot be
// reasonably modelled with a hand-written `Record<string, ...>` type. This is
// the SINGLE sanctioned `any` boundary in the codebase — see the file header.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function untypedFrom(table: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}
