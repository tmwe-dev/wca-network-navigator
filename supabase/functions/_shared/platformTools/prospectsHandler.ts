/**
 * prospectsHandler.ts - Prospect-related tool handlers
 * Handles: Italian prospect searches
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
