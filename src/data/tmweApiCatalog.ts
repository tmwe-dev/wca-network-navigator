/**
 * tmweApiCatalog — DAL per la tabella `tmwe_api_catalog`.
 * Espone elenco endpoint TMWE sincronizzati da /client_api_docs.
 */
import { supabase } from "@/integrations/supabase/client";

export type TmweRiskLevel = "read" | "write" | "destructive" | "admin";

export interface TmweCatalogRow {
  id: string;
  op: string;
  method: string;
  path: string;
  description: string | null;
  scopes: string[];
  api_group: string | null;
  risk_level: TmweRiskLevel;
  identity: string;
  enabled: boolean;
  requires_confirmation: boolean;
  is_alias: boolean;
  alias_of: string | null;
  source: string;
  verified_at: string | null;
  last_called_at: string | null;
  call_count: number;
}

export const tmweCatalogKeys = {
  all: ["tmweCatalog"] as const,
  list: () => ["tmweCatalog", "list"] as const,
  stats: () => ["tmweCatalog", "stats"] as const,
};

export async function listTmweCatalog(): Promise<TmweCatalogRow[]> {
  const { data, error } = await (supabase.from as unknown as (n: string) => {
    select: (s: string) => { order: (c: string, opts: { ascending: boolean }) => { order: (c: string, opts: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: TmweCatalogRow[] | null; error: { message: string } | null }> } } };
  })("tmwe_api_catalog")
    .select("id, op, method, path, description, scopes, api_group, risk_level, identity, enabled, requires_confirmation, is_alias, alias_of, source, verified_at, last_called_at, call_count")
    .order("api_group", { ascending: true })
    .order("op", { ascending: true })
    .limit(2000);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function setTmweCatalogEnabled(op: string, enabled: boolean): Promise<void> {
  const { error } = await (supabase.from as unknown as (n: string) => {
    update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => Promise<{ error: { message: string } | null }> };
  })("tmwe_api_catalog")
    .update({ enabled })
    .eq("op", op);
  if (error) throw new Error(error.message);
}

export async function syncTmweCatalog(): Promise<{ ok: boolean; total_endpoints?: number; upserted?: number; aliases?: number; groups?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("tmwe-catalog-sync", { body: {} });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; total_endpoints?: number; upserted?: number; aliases?: number; groups?: number };
}