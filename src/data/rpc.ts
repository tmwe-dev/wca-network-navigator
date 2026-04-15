/**
 * DAL — RPC function wrappers
 * Centralizes all supabase.rpc() calls.
 */
import { supabase } from "@/integrations/supabase/client";

interface CountryStatRow {
  country_code: string;
  total_partners: number;
  hq_count: number;
  branch_count: number;
  with_profile: number;
  without_profile: number;
  with_email: number;
  with_phone: number;
  with_both: number;
  with_deep_search: number;
  with_company_alias: number;
  with_contact_alias: number;
}

interface ContactGroupCountRow {
  group_type: string;
  group_key: string;
  group_label: string;
  contact_count: number;
  with_email: number;
  with_phone: number;
  with_deep_search: number;
  with_alias: number;
}

interface ContactFilterOptionRow {
  filter_type: string;
  filter_value: string;
}

interface DirectoryCountRow {
  country_code: string;
  member_count: number;
  is_verified: boolean;
}

function isSchemaCacheError(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === "PGRST002" || /schema cache/i.test(error.message ?? "")));
}

export async function rpcGetCountryStats(): Promise<CountryStatRow[]> {
  const { data, error } = await supabase.rpc("get_country_stats");
  if (error) throw error;
  return (data ?? []) as CountryStatRow[];
}

export async function rpcGetContactGroupCounts(): Promise<ContactGroupCountRow[]> {
  const { data, error } = await supabase.rpc("get_contact_group_counts");
  if (error) throw error;
  return (data ?? []) as ContactGroupCountRow[];
}

export async function rpcGetContactFilterOptions(): Promise<ContactFilterOptionRow[]> {
  const { data, error } = await supabase.rpc("get_contact_filter_options");
  if (error) throw error;
  return (data ?? []) as ContactFilterOptionRow[];
}

export async function rpcGetDirectoryCounts(): Promise<DirectoryCountRow[]> {
  const { data, error } = await supabase.rpc("get_directory_counts");
  if (error) throw error;
  return (data ?? []) as DirectoryCountRow[];
}

export async function rpcMatchContactsToWca() {
  const { data, error } = await supabase.rpc("match_contacts_to_wca");
  if (error) throw error;
  return data;
}

export async function rpcIsEmailAuthorized(email: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const { data, error } = await supabase.rpc("is_email_authorized", { p_email: email }, {
      signal: controller.signal,
    } as Record<string, unknown>);
    clearTimeout(timeout);
    if (!error) return data === true;
    if (isSchemaCacheError(error)) {
      console.warn("[auth] Schema cache unavailable, bypassing whitelist check");
      return true;
    }
    throw error;
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort") || message.includes("timeout") || message.includes("schema cache") || message.includes("PGRST002")) {
      console.warn("[auth] Whitelist check failed/timed out, bypassing");
      return true;
    }
    throw err;
  }
}

export async function rpcRecordUserLogin(email: string): Promise<void> {
  const { error } = await supabase.rpc("record_user_login", { p_email: email });
  if (!error) return;
  if (isSchemaCacheError(error)) {
    console.warn("[auth] Schema cache unavailable, skipping login record");
    return;
  }
  throw error;
}

export async function rpcGetUserRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (!error) {
    return (data ?? []).map((row) => row.role as string);
  }

  if (isSchemaCacheError(error)) {
    console.warn("[auth] Schema cache unavailable, returning default roles");
    return ["admin"];
  }

  throw error;
}

/**
 * Generic RPC call for diagnostics — intentionally dynamic.
 */
export async function rpcCall(fn: string, params?: Record<string, unknown>) {
  // Diagnostics tool: dynamic function name requires cast
  const { data, error } = await (supabase.rpc as Function)(fn, params);
  if (error) throw error;
  return data;
}

/**
 * Generic table count for diagnostics — intentionally dynamic.
 */
export async function countTableRows(table: string) {
  // Diagnostics: dynamic table name requires untyped access
  const { count, error } = await (supabase.from as Function)(table).select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * Generic view count with filter for diagnostics.
 */
export async function countViewRows(view: string, filter?: { column: string; value: unknown }) {
  let q = (supabase.from as Function)(view).select("*", { count: "exact", head: true });
  if (filter) q = q.eq(filter.column, filter.value);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
