/**
 * DAL — linkedin_addresses (Rubrica LinkedIn)
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import { queryKeys } from "@/lib/queryKeys";

export interface LinkedInAddressRow {
  id: string;
  user_id: string;
  operator_id: string | null;
  profile_slug: string;
  profile_url: string | null;
  display_name: string | null;
  headline: string | null;
  first_seen_at: string;
  last_seen_at: string;
  messages_in_count: number;
  messages_out_count: number;
  last_message_at: string | null;
  last_direction: string | null;
  linked_partner_id: string | null;
  linked_partner_contact_id: string | null;
  source: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  linked_partner?: { id: string; name: string | null } | null;
}

export async function listLinkedInAddresses(opts: {
  search?: string;
  limit?: number;
} = {}): Promise<LinkedInAddressRow[]> {
  const limit = opts.limit ?? 500;
  let q = untypedFrom("linkedin_addresses")
    .select("*, linked_partner:partners(id,name)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (opts.search && opts.search.trim().length >= 2) {
    const s = opts.search.trim();
    q = q.or(`display_name.ilike.%${s}%,profile_slug.ilike.%${s}%,headline.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LinkedInAddressRow[];
}

export async function updateLinkedInAddressNotes(id: string, notes: string): Promise<void> {
  const { error } = await untypedFrom("linkedin_addresses").update({ notes }).eq("id", id);
  if (error) throw error;
}

export const linkedinAddressKeys = {
  all: queryKeys.v2.rubrica.linkedin,
  list: (search?: string) => [...queryKeys.v2.rubrica.linkedin, "list", search ?? ""] as const,
};