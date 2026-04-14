/**
 * Typed escape hatch for Supabase tables not yet in the generated types.
 * Use `untypedFrom(tableName)` instead of `supabase.from(tableName)`.
 *
 * This is the SINGLE place where a Supabase `any` cast is allowed.
 * All RA-module consumers use this instead of casting individually.
 */
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Single escape hatch: RA tables (ra_prospects, ra_contacts, ra_interactions, ra_scraping_jobs) are not in generated types
type UntypedQueryBuilder = ReturnType<typeof supabase.from> extends infer R ? R : never;

/**
 * Access a Supabase table that isn't in the generated types yet.
 * Returns a PostgREST query builder with loose typing.
 */
export function untypedFrom(table: string): UntypedQueryBuilder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see module docstring
  return (supabase as any).from(table);
}
