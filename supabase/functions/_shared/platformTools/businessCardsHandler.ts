/**
 * businessCardsHandler.ts - Business card-related tool handlers
 * Handles: search
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

export async function handleSearchBusinessCards(
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("business_cards")
    .select("id, company_name, contact_name, email, event_name, match_status, created_at")
    .order("created_at", { ascending: false })
    .limit(Number(args.limit) || 20);
  if (args.company_name)
    query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
  if (args.event_name)
    query = query.ilike("event_name", `%${escapeLike(String(args.event_name))}%`);
  const { data, error } = await query;
  return error ? { error: error.message } : { count: data?.length || 0, cards: data || [] };
}
