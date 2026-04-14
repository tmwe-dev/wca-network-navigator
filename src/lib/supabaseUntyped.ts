/**
 * Typed escape hatch for Supabase tables not yet in the generated types.
 * Use `untypedFrom(tableName)` instead of `supabase.from(tableName)`.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Access a Supabase table that isn't in the generated types yet.
 * Returns a PostgREST query builder with loose typing.
 */
 
export function untypedFrom(table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return supabase.from(table);
}
