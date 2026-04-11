/**
 * Typed escape hatch for Supabase tables not yet in the generated types.
 * Use `untypedFrom(tableName)` instead of `(supabase as any).from(tableName)`.
 */
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = ReturnType<typeof supabase.from<any>>;

/**
 * Access a Supabase table that isn't in the generated types yet.
 * Returns a fully-typed PostgREST query builder (with `any` row type).
 */
export function untypedFrom(table: string): UntypedClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(table);
}
