/**
 * DAL — Funnemail Scout Cache (Sprint 4) per-utente.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";

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

export async function listFunnemailScoutCache(limit = 200): Promise<FunnemailScoutCacheRow[]> {
  const { data, error } = await untypedFrom(TABLE)
    .select("*")
    .order("cached_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as FunnemailScoutCacheRow[];
}

export async function invalidateFunnemailScoutCache(id: string): Promise<void> {
  const { error } = await untypedFrom(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function invalidateScoutCacheByDomain(domain: string): Promise<void> {
  const { error } = await untypedFrom(TABLE).delete().eq("email_domain", domain);
  if (error) throw error;
}
