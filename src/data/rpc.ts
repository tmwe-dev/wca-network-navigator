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

interface AuthGateAuthorizedResponse {
  authorized?: boolean;
}

interface AuthGateRolesResponse {
  roles?: unknown[];
}

function isSchemaCacheError(error: { code?: string; message?: string } | null | undefined): boolean {
  return Boolean(error && (error.code === "PGRST002" || /schema cache/i.test(error.message ?? "")));
}

async function invokeAuthGate<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("auth-gate", { body });
  if (error) throw error;
  return (data ?? {}) as T;
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
  let lastError: { code?: string; message?: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await supabase.rpc("is_email_authorized", { p_email: email });
    if (!error) return data === true;
    if (isSchemaCacheError(error)) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      continue;
    }
    throw error;
  }

  const response = await invokeAuthGate<AuthGateAuthorizedResponse>({
    action: "is_email_authorized",
    email,
  });
  if (response.authorized === true) return true;
  if (response.authorized === false) return false;
  throw lastError ?? new Error("Verifica whitelist non disponibile.");
}

export async function rpcRecordUserLogin(email: string): Promise<void> {
  const { error } = await supabase.rpc("record_user_login", { p_email: email });
  if (!error) return;
  if (isSchemaCacheError(error)) {
    await invokeAuthGate<{ success?: boolean }>({ action: "record_user_login", email });
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
    const response = await invokeAuthGate<AuthGateRolesResponse>({
      action: "get_user_roles",
      userId,
    });
    return Array.isArray(response.roles)
      ? response.roles.filter((role): role is string => typeof role === "string")
      : [];
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
