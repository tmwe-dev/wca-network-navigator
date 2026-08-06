/**
 * DAL — Funnemail Scout Cache (Sprint 4) per-utente.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FunnemailScoutCacheRow {
  id: string;
  user_id: string;
  email_domain: string;
  email_address: string | null;
  is_known_partner: boolean;
  partner_id: string | null;
  company_type: string | null;
  country: string | null;
  website: string | null;
  role_guess: string | null;
  evidence: Record<string, unknown>;
  scout_source: string | null;
  cached_at: string;
  expires_at: string;
}

const TABLE = "funnemail_scout_cache" as const;

/** Narrowing runtime esplicito: converte il Json della colonna `evidence`. */
function toRecord(json: unknown): Record<string, unknown> {
  return typeof json === "object" && json !== null && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
}

export async function listFunnemailScoutCache(limit = 200): Promise<FunnemailScoutCacheRow[]> {
  const { data, error } = await supabase.from(TABLE).select("*").order("cached_at", { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...row, evidence: toRecord(row.evidence) }));
}

export async function invalidateFunnemailScoutCache(id: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function invalidateScoutCacheByDomain(domain: string): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("email_domain", domain);
  if (error) throw error;
}
