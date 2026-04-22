/**
 * searchHandler.ts - Directory and deep search tool handlers
 * Handles: directory status, deep search partner/contact
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

interface DirectoryCountRow {
  country_code: string;
  member_count: number;
}

interface CountryStatRow {
  country_code: string;
  total_partners: number;
}

async function resolvePartnerId(
  args: Record<string, unknown>
): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .eq("id", args.partner_id as string)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("id, company_name")
      .ilike("company_name", `%${escapeLike(String(args.company_name))}%`)
      .limit(1)
      .single();
    if (data) return { id: data.id, name: data.company_name };
  }
  return null;
}

export async function handleGetDirectoryStatus(
  args: Record<string, unknown>
): Promise<unknown> {
  const { data: dirData } = await supabase.rpc("get_directory_counts");
  const { data: statsData } = await supabase.rpc("get_country_stats");
  const dirMap: Record<string, number> = {};
  for (const r of (dirData || []) as DirectoryCountRow[]) dirMap[r.country_code] = Number(r.member_count);
  const statsMap: Record<string, CountryStatRow> = {};
  for (const r of (statsData || []) as CountryStatRow[]) statsMap[r.country_code] = r;
  if (args.country_code) {
    const code = String(args.country_code).toUpperCase();
    return {
      country_code: code,
      directory_members: dirMap[code] || 0,
      db_partners: statsMap[code]?.total_partners || 0,
      gap: (dirMap[code] || 0) - (statsMap[code]?.total_partners || 0),
    };
  }
  const allCodes = [...new Set([...Object.keys(dirMap), ...Object.keys(statsMap)])];
  const gaps = allCodes
    .map((c) => ({
      country_code: c,
      dir: dirMap[c] || 0,
      db: statsMap[c]?.total_partners || 0,
      gap: (dirMap[c] || 0) - (statsMap[c]?.total_partners || 0),
    }))
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap);
  return { countries_with_gaps: gaps.length, gaps: gaps.slice(0, 30) };
}

export async function handleDeepSearchPartner(
  args: Record<string, unknown>,
  authHeader: string
): Promise<unknown> {
  let pid = args.partner_id as string;
  if (!pid && args.company_name) {
    const r = await resolvePartnerId(args);
    if (r) pid = r.id;
  }
  if (!pid) return { error: "Partner non trovato" };
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-partner`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ partner_id: pid, force: !!args.force }),
    }
  );
  const data = await response.json();
  return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
}

export async function handleDeepSearchContact(
  args: Record<string, unknown>,
  authHeader: string
): Promise<unknown> {
  let cid = args.contact_id as string;
  if (!cid && args.contact_name) {
    const { data } = await supabase
      .from("imported_contacts")
      .select("id")
      .ilike("name", `%${escapeLike(String(args.contact_name))}%`)
      .limit(1)
      .single();
    if (data) cid = data.id;
  }
  if (!cid) return { error: "Contatto non trovato" };
  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-contact`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: authHeader },
      body: JSON.stringify({ contact_id: cid }),
    }
  );
  const data = await response.json();
  return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
}
