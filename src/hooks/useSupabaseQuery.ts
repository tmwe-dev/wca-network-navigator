/**
 * useSupabaseQuery — Standardized wrapper for Supabase + React Query pattern.
 * Eliminates the repetitive fetch → map pattern used 20+ times in the codebase.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"];
type RowOf<T extends TableName> = Database["public"]["Tables"][T]["Row"];

/** Apply additional filters to the query builder (eq, in, order, limit, etc.) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FilterFn = (query: unknown) => any;

interface SupabaseQueryOptions {
  readonly filters?: FilterFn;
  readonly staleTime?: number;
  readonly enabled?: boolean;
}

export function useSupabaseQuery<T extends TableName, TResult>(
  key: readonly string[],
  table: T,
  select: string,
  mapFn: (row: RowOf<T>) => TResult,
  options?: SupabaseQueryOptions,
) {
  return useQuery<TResult[]>({
    queryKey: key,
    queryFn: async () => {
      const base = supabase.from(table).select(select);
      const query = options?.filters ? options.filters(base) : base;
      const { data, error } = await query;
      if (error) throw error;
      return ((data ?? []) as unknown as RowOf<T>[]).map(mapFn);
    },
    staleTime: options?.staleTime,
    enabled: options?.enabled,
  });
}
