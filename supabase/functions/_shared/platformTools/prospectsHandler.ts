/**
 * prospectsHandler.ts - Prospect-related tool handlers
 * Handles: Italian prospect searches + detail.
 *
 * REWRITE 2026-04-29: aggiunto handleGetProspectDetail con prospect_contacts
 * e activities collegate.
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

export async function handleSearchProspects(
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("prospects")
    .select("id, company_name, city, province, codice_ateco, fatturato, email, lead_status");
  if (args.company_name)
    query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
  if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
  if (args.province) query = query.ilike("province", `%${escapeLike(String(args.province))}%`);
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  if (args.min_fatturato) query = query.gte("fatturato", Number(args.min_fatturato));
  query = query.limit(Math.min(Number(args.limit) || 20, 50));
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, prospects: data || [] };
}

export async function handleGetProspectDetail(
  args: Record<string, unknown>
): Promise<unknown> {
  let prospect: Record<string, unknown> | null = null;
  if (args.prospect_id) {
    const { data } = await supabase
      .from("prospects")
      .select("*")
      .eq("id", args.prospect_id as string)
      .maybeSingle();
    prospect = data as Record<string, unknown> | null;
  } else if (args.company_name) {
    const { data } = await supabase
      .from("prospects")
      .select("*")
      .ilike("company_name", `%${escapeLike(String(args.company_name))}%`)
      .limit(1)
      .maybeSingle();
    prospect = data as Record<string, unknown> | null;
  }
  if (!prospect) return { error: "Prospect non trovato" };

  const prospectId = String(prospect.id);
  const [contactsRes, dealsRes] = await Promise.all([
    supabase
      .from("prospect_contacts")
      .select("id, name, role, email, phone, linkedin_url")
      .eq("prospect_id", prospectId),
    supabase
      .from("deals")
      .select("id, title, stage, amount, currency, expected_close_date, created_at")
      .eq("contact_id", prospectId)
      .order("updated_at", { ascending: false })
      .limit(10),
  ]);

  return {
    ...prospect,
    prospect_contacts: contactsRes.data || [],
    deals: dealsRes.data || [],
    deals_count: (dealsRes.data || []).length,
  };
}
