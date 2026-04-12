/**
 * useSupabaseQuery — Standardized wrapper for Supabase + React Query pattern.
 * Eliminates the repetitive fetch → map pattern used 20+ times in the codebase.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SupabaseQueryOptions {
  filters?: (query: ReturnType<ReturnType<typeof supabase.from>["select"]>) => ReturnType<ReturnType<typeof supabase.from>["select"]>;
  staleTime?: number;
  enabled?: boolean;
}

export function useSupabaseQuery<TRow extends Record<string, unknown>, TResult>(
  key: readonly string[],
  table: string,
  select: string,
  mapFn: (row: TRow) => TResult,
  options?: SupabaseQueryOptions,
) {
  return useQuery<TResult[]>({
    queryKey: key,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const base = (supabase.from as (t: string) => ReturnType<typeof supabase.from>)(table).select(select);
      const query = options?.filters ? options.filters(base) : base;
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as unknown as TRow[]).map(mapFn);
    },
    staleTime: options?.staleTime,
    enabled: options?.enabled,
  });
}
