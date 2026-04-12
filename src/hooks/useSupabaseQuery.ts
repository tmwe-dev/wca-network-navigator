/**
 * useSupabaseQuery — Standardized wrapper for Supabase + React Query pattern.
 * Eliminates the repetitive fetch → map pattern used 20+ times in the codebase.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"];

interface SupabaseQueryOptions<T extends TableName> {
  filters?: (query: ReturnType<ReturnType<typeof supabase.from<T>>["select"]>) => ReturnType<ReturnType<typeof supabase.from<T>>["select"]>;
  staleTime?: number;
  enabled?: boolean;
}

export function useSupabaseQuery<T extends TableName, TResult>(
  key: readonly string[],
  table: T,
  select: string,
  mapFn: (row: Database["public"]["Tables"][T]["Row"]) => TResult,
  options?: SupabaseQueryOptions<T>,
) {
  return useQuery<TResult[]>({
    queryKey: key,
    queryFn: async () => {
      const base = supabase.from(table).select(select);
      const query = options?.filters ? options.filters(base) : base;
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapFn);
    },
    staleTime: options?.staleTime,
    enabled: options?.enabled,
  });
}
