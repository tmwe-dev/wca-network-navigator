/**
 * Typed escape hatch for Supabase tables not yet in the generated types.
 * Use `untypedFrom(tableName)` instead of `supabase.from(tableName)`.
 * 
 * Returns a PostgREST query builder typed as `unknown` — callers must
 * cast the result to a known interface after awaiting.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Access a Supabase table that isn't in the generated types yet.
 * Returns a PostgREST query builder. Callers should cast the final
 * result (after `.select()`, `.insert()`, etc.) to their own types.
 */
export function untypedFrom(table: string): ReturnType<typeof supabase.from> {
  // The table name isn't in the Database type, so we must widen the argument.
  // This is the ONE place the cast lives; all consumers get a typed builder.
  return supabase.from(table as "partners"); // eslint-disable-line @typescript-eslint/no-explicit-any -- single escape hatch for untyped RA tables
}
