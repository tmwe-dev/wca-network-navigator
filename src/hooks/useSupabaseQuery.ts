/**
 * useSupabaseQuery — Standardized wrapper for Supabase + React Query pattern.
 * Eliminates the repetitive fetch → map pattern used 20+ times in the codebase.
 */
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

interface SupabaseQueryOptions<TRow> {
  filters?: (query: PostgrestFilterBuilder<Record<string, unknown>, TRow, TRow[]>) => PostgrestFilterBuilder<Record<string, unknown>, TRow, TRow[]>;
  staleTime?: number;
  enabled?: boolean;
}

export function useSupabaseQuery<TRow extends Record<string, unknown>, TResult>(
  key: readonly string[],
  table: string,
  select: string,
  mapFn: (row: TRow) => TResult,
  options?: SupabaseQueryOptions<TRow>,
) {
  return useQuery<TResult[]>({
    queryKey: key,
    queryFn: async () => {
      let query = supabase.from(table).select(select) as unknown as PostgrestFilterBuilder<Record<string, unknown>, TRow, TRow[]>;
      if (options?.filters) {
        query = options.filters(query);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data as TRow[]).map(mapFn);
    },
    staleTime: options?.staleTime,
    enabled: options?.enabled,
  } satisfies UseQueryOptions<TResult[]>);
}
