/**
 * liveSchemaClient — versione client-side del live schema loader.
 *
 * Carica colonne + enum reali dal DB via RPC `ai_introspect_schema`,
 * mantiene una cache 5 min in memoria. Usata da `safeQueryExecutor` per
 * validare le colonne in modo sempre allineato al DB (no più array statico
 * disallineato).
 */
import { supabase } from "@/integrations/supabase/client";

export interface LiveColumn {
  name: string;
  type: string;
  nullable: boolean;
  enum_values: string[] | null;
}

export interface LiveTable {
  table: string;
  columns: LiveColumn[];
}

const CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { fetchedAt: number; key: string; data: Map<string, LiveColumn[]> } | null = null;
let inflight: Promise<Map<string, LiveColumn[]>> | null = null;

export async function getLiveColumns(
  tables: readonly string[],
): Promise<Map<string, LiveColumn[]>> {
  const key = [...tables].sort().join(",");
  if (cache && cache.key === key && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.data;
  }
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await (
        supabase.rpc as unknown as (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: LiveTable[] | null; error: unknown }>
      )("ai_introspect_schema", { table_names: tables });

      if (error || !Array.isArray(data)) {
        // fail-open: ritorna mappa vuota, il chiamante può degradare
        return new Map();
      }
      const map = new Map<string, LiveColumn[]>();
      for (const t of data) {
        if (t && t.table && Array.isArray(t.columns)) {
          map.set(t.table, t.columns);
        }
      }
      cache = { fetchedAt: Date.now(), key, data: map };
      return map;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

export function clearLiveSchemaCache(): void {
  cache = null;
}