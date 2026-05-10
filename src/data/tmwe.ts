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
  partnerLink: (partnerId: string) => ["tmwe", "partnerLink", partnerId] as const,
  matchCandidates: (partnerId: string) => ["tmwe", "match", partnerId] as const,
  snapshot: (clientId: string) => ["tmwe", "snapshot", clientId] as const,
  revenue: (clientId: string) => ["tmwe", "revenue", clientId] as const,
  customersList: (filters?: unknown) => ["tmwe", "customers", filters] as const,
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
    body: { intent: "login", app_origin: window.location.origin },
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

/* ============================================================
 * Partner ⇄ TMWE customer linking (sprint 2026-05-10)
 * ============================================================ */

export interface TmweCandidate {
  tmwe_client_id: string;
  denomination: string | null;
  vat: string | null;
  city: string | null;
  score: number;
  reason: "exact_vat" | "vies" | "name_fuzzy";
}

export interface TmwePartnerLink {
  id: string;
  partner_id: string;
  tmwe_client_id: string;
  tmwe_vat: string | null;
  match_confidence: "exact_vat" | "vies" | "manual" | "name_fuzzy";
  linked_by_user_id: string | null;
  linked_at: string;
}

export interface TmweCustomerSnapshot {
  tmwe_client_id: string;
  denomination: string | null;
  vat: string | null;
  is_active: boolean;
  assigned_price_list_id: string | null;
  assigned_price_list_name: string | null;
  last_synced_at: string;
}

export interface TmweRevenueRow {
  tmwe_client_id: string;
  year: number;
  month: number;
  revenue_amount: number;
  currency: string;
  invoices_count: number;
  services_breakdown: Record<string, number>;
}

export async function findTmweCandidates(partnerId: string): Promise<{
  candidates: TmweCandidate[];
  partner: { vat: string | null; denomination: string; city: string };
}> {
  const { data, error } = await supabase.functions.invoke("tmwe-partner-match", {
    body: { partner_id: partnerId },
  });
  if (error) throw error;
  return data as { candidates: TmweCandidate[]; partner: { vat: string | null; denomination: string; city: string } };
}

export async function linkPartnerToTmwe(input: {
  partner_id: string;
  tmwe_client_id: string;
  tmwe_vat?: string | null;
  match_confidence: TmwePartnerLink["match_confidence"];
}): Promise<TmwePartnerLink> {
  const { data, error } = await supabase.functions.invoke("tmwe-partner-link", { body: input });
  if (error) throw error;
  return (data as { link: TmwePartnerLink }).link;
}

export async function unlinkPartnerFromTmwe(partnerId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("tmwe-partner-link", {
    body: { partner_id: partnerId, tmwe_client_id: "x", match_confidence: "manual", action: "unlink" },
  });
  if (error) throw error;
}

export async function getTmwePartnerLink(partnerId: string): Promise<TmwePartnerLink | null> {
  const { data, error } = await tFrom("tmwe_partner_links")
    .select("id, partner_id, tmwe_client_id, tmwe_vat, match_confidence, linked_by_user_id, linked_at")
    .eq("partner_id", partnerId).maybeSingle();
  if (error) throw error;
  return (data as TmwePartnerLink | null) ?? null;
}

export async function getTmweSnapshot(clientId: string): Promise<TmweCustomerSnapshot | null> {
  const { data, error } = await tFrom("tmwe_customer_snapshot")
    .select("tmwe_client_id, denomination, vat, is_active, assigned_price_list_id, assigned_price_list_name, last_synced_at")
    .eq("tmwe_client_id", clientId).maybeSingle();
  if (error) throw error;
  return (data as TmweCustomerSnapshot | null) ?? null;
}

export async function getRevenueLast12Months(clientId: string): Promise<TmweRevenueRow[]> {
  const { data, error } = await tFrom("tmwe_revenue_monthly")
    .select("tmwe_client_id, year, month, revenue_amount, currency, invoices_count, services_breakdown")
    .eq("tmwe_client_id", clientId)
    .order("year", { ascending: false })
    .order("month", { ascending: false })
    .limit(12);
  if (error) throw error;
  return (data as TmweRevenueRow[] | null) ?? [];
}

export async function listTmweCustomers(): Promise<Array<TmweCustomerSnapshot & { partner_id: string | null }>> {
  const { data, error } = await tFrom("tmwe_customer_snapshot")
    .select("tmwe_client_id, denomination, vat, is_active, assigned_price_list_id, assigned_price_list_name, last_synced_at, tmwe_partner_links(partner_id)")
    .order("last_synced_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data as Array<TmweCustomerSnapshot & { tmwe_partner_links: Array<{ partner_id: string }> }> | null ?? [])
    .map((row) => ({
      ...row,
      partner_id: row.tmwe_partner_links?.[0]?.partner_id ?? null,
    })) as Array<TmweCustomerSnapshot & { partner_id: string | null }>;
}

export async function triggerCustomerResync(tmweClientId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("tmwe-customer-sync", {
    body: { mode: "single", tmwe_client_id: tmweClientId },
  });
  if (error) throw error;
}

export interface TmweQuoteResult {
  ok: boolean;
  price_list_id: string | null;
  quote: unknown;
}

export async function lookupTmweQuote(input: {
  partner_id: string;
  origin: string;
  destination: string;
  weight_kg: number;
  service_type?: string;
}): Promise<TmweQuoteResult> {
  const { data, error } = await supabase.functions.invoke("tmwe-quote-lookup", { body: input });
  if (error) throw error;
  return data as TmweQuoteResult;
}