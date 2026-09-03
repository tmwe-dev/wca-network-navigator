/**
 * DAL: RPC `ai_field_values` — introspezione dei valori reali di un campo.
 * Serve a distinguere "non c'è nulla" da "filtro sbagliato". Sola lettura.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FieldValueRow {
  readonly value: string | null;
  readonly count: number;
}

export interface FieldValuesPayload {
  readonly table?: string;
  readonly column?: string;
  readonly total_rows?: number;
  readonly non_null?: number;
  readonly null_count?: number;
  readonly distinct_values?: number;
  readonly top_values?: readonly FieldValueRow[];
  readonly diagnosis?: string;
  readonly error?: string;
}

export async function rpcFieldValues(
  table: string,
  column: string,
  limit = 20,
  filter: string | null = null,
): Promise<FieldValuesPayload | null> {
  const { data, error } = await supabase.rpc("ai_field_values", {
    p_table: table,
    p_column: column,
    p_limit: limit,
    ...(filter ? { p_filter: filter } : {}),
  });
  if (error || !data) return null;
  return data as unknown as FieldValuesPayload;
}
