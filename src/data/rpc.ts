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
  // Retry up to 3 times to handle transient PGRST002 / 503 errors
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.rpc("is_email_authorized", { p_email: email });
    if (!error) return data === true;
    // PGRST002 = schema cache reloading (503) — retry after short delay
    if (error.code === "PGRST002" || error.message?.includes("schema cache")) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }
    throw error;
  }
  throw lastError;
}

export async function rpcRecordUserLogin(email: string): Promise<void> {
  await supabase.rpc("record_user_login", { p_email: email });
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
