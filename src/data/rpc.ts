/**
 * DAL — RPC function wrappers
 * Centralizes all supabase.rpc() calls.
 */
import { supabase } from "@/integrations/supabase/client";

export async function rpcGetCountryStats() {
  const { data, error } = await supabase.rpc("get_country_stats");
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function rpcGetContactGroupCounts() {
  const { data, error } = await supabase.rpc("get_contact_group_counts");
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function rpcGetContactFilterOptions() {
  const { data, error } = await supabase.rpc("get_contact_filter_options");
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function rpcGetDirectoryCounts() {
  const { data, error } = await supabase.rpc("get_directory_counts");
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function rpcMatchContactsToWca() {
  const { data, error } = await supabase.rpc("match_contacts_to_wca");
  if (error) throw error;
  return data;
}

export async function rpcIsEmailAuthorized(email: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_email_authorized" as any, { p_email: email });
  if (error) throw error;
  return data === true;
}

export async function rpcRecordUserLogin(email: string): Promise<void> {
  await supabase.rpc("record_user_login" as any, { p_email: email });
}

/**
 * Generic RPC call for diagnostics — intentionally dynamic.
 */
export async function rpcCall(fn: string, params?: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(fn as any, params as any);
  if (error) throw error;
  return data;
}

/**
 * Generic table count for diagnostics — intentionally dynamic.
 */
export async function countTableRows(table: string) {
  const { count, error } = await (supabase as any).from(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * Generic view count with filter for diagnostics.
 */
export async function countViewRows(view: string, filter?: { column: string; value: unknown }) {
  let q = (supabase as any).from(view).select("*", { count: "exact", head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
