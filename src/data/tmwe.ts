/**
 * DAL — TMWE (Findair sandbox)
 *
 * Tutte le chiamate operative passano dall'edge function `tmwe-proxy`.
 * I token TMWE non viaggiano mai nel client.
 */
import { supabase } from "@/integrations/supabase/client";
import { tFrom } from "@/lib/typedSupabase";

export const tmweQueryKeys = {
  connection: ["tmwe", "connection"] as const,
  profile: ["tmwe", "profile"] as const,
  shipments: (filters?: unknown) => ["tmwe", "shipments", filters] as const,
  tracking: (awb: string) => ["tmwe", "tracking", awb] as const,
};

export interface TmweConnection {
  user_id: string;
  tmwe_user_id: number;
  tmwe_email: string | null;
  tmwe_company: string | null;
  tmwe_vat_number: string | null;
  scopes: string[];
  connected_at: string;
  last_used_at: string | null;
  expires_at: string;
  token_valid: boolean;
}

export async function getTmweConnection(): Promise<TmweConnection | null> {
  const { data, error } = await tFrom("tmwe_user_connections_v")
    .select(
      "user_id, tmwe_user_id, tmwe_email, tmwe_company, tmwe_vat_number, scopes, connected_at, last_used_at, expires_at, token_valid",
    )
    .maybeSingle();
  if (error) throw error;
  return (data as TmweConnection | null) ?? null;
}

interface ProxyResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
  tmwe_user_id: number | null;
}

async function callProxy<T = unknown>(
  op: string,
  params?: Record<string, unknown>,
): Promise<ProxyResponse<T>> {
  const { data, error } = await supabase.functions.invoke("tmwe-proxy", {
    body: { op, params },
  });
  if (error) throw error;
  return data as ProxyResponse<T>;
}

export async function tmweGetMyProfile() {
  return callProxy("profile.me");
}

export async function tmweTrack(awb: string) {
  return callProxy("tracking.byAwb", { awb });
}

export async function tmweListMyShipments(filters?: Record<string, unknown>) {
  return callProxy("shipment.list", filters);
}

export async function tmweUnifiedShipment(payload: Record<string, unknown>) {
  return callProxy("shipment.unified", payload);
}

export async function tmweRubricaSearch(query: string) {
  return callProxy("rubrica.search", { q: query });
}

/* ---- OAuth lifecycle ---- */

export async function tmweConnectStart(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("tmwe-oauth-start", {
    body: { intent: "connect" },
  });
  if (error) throw error;
  const url = (data as { redirect_url?: string })?.redirect_url;
  if (!url) throw new Error("Missing redirect_url from tmwe-oauth-start");
  return url;
}

/**
 * Avvia il flusso di LOGIN via TMWE (no auth richiesta).
 * L'utente viene rimbalzato sul provider TMWE; al ritorno la callback
 * crea/risolve l'utente Lovable Cloud e apre la sessione via magic link.
 */
export async function tmweLoginStart(): Promise<string> {
  const { data, error } = await supabase.functions.invoke("tmwe-oauth-start", {
    body: { intent: "login" },
  });
  if (error) throw error;
  const url = (data as { redirect_url?: string })?.redirect_url;
  if (!url) throw new Error("Missing redirect_url from tmwe-oauth-start");
  return url;
}

export async function tmweDisconnect(): Promise<void> {
  const { error } = await supabase.functions.invoke("tmwe-disconnect", { body: {} });
  if (error) throw error;
}