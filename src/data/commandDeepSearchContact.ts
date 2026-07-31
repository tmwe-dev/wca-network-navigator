/**
 * DAL — deep-search-contact tool (read-only) della Command page.
 */
import { supabase } from "@/integrations/supabase/client";

export interface DeepSearchContactRow {
  id: string;
  name: string | null;
  email: string | null;
  company_name: string | null;
  deep_search_at: string | null;
  wca_partner_id: string | null;
}

export async function findDeepSearchContacts(term: string | undefined): Promise<DeepSearchContactRow[]> {
  let query = supabase
    .from("imported_contacts")
    .select("id, name, email, company_name, deep_search_at, wca_partner_id")
    .order("deep_search_at", { ascending: false, nullsFirst: false })
    .limit(20);
  if (term) query = query.ilike("name", `%${term}%`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}
