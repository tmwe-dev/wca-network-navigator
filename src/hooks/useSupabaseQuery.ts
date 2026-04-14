/**
 * useSupabaseQuery — Standardized wrapper for Supabase + React Query pattern.
 * Eliminates the repetitive fetch → map pattern used 20+ times in the codebase.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"];
type RowOf<T extends TableName> = Database["public"]["Tables"][T]["Row"];

/** Apply additional filters to the query builder */
type FilterFn<T extends TableName> = (
  query: ReturnType<typeof supabase.from<T>>
) => ReturnType<typeof supabase.from<T>>;

interface SupabaseQueryOptions<T extends TableName> {
  readonly filters?: FilterFn<T>;
  readonly staleTime?: number;
  readonly enabled?: boolean;
}

export function useSupabaseQuery<T extends TableName, TResult>(
  key: readonly string[],
  table: T,
  select: string,
  mapFn: (row: RowOf<T>) => TResult,
  options?: SupabaseQueryOptions<T>,
) {
  return useQuery<TResult[]>({
    queryKey: key,
    queryFn: async () => {
      const base = supabase.from(table).select(select);
      const query = options?.filters ? options.filters(base as ReturnType<typeof supabase.from<T>>) : base;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase dynamic select returns unknown shape; cast to Row for mapping
      const { data, error } = await (query as unknown as Promise<{ data: RowOf<T>[] | null; error: { message: string } | null }>);
      if (error) throw error;
      return (data ?? []).map(mapFn);
    },
    staleTime: options?.staleTime,
    enabled: options?.enabled,
  });
}
