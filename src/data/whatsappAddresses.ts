/**
 * DAL — whatsapp_addresses (Rubrica WhatsApp)
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import { queryKeys } from "@/lib/queryKeys";

export interface WhatsAppAddressRow {
  id: string;
  user_id: string;
  operator_id: string | null;
  handle: string;
  phone_e164: string | null;
  display_name: string | null;
  chat_thread_id: string | null;
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

export async function listWhatsAppAddresses(opts: {
  search?: string;
  limit?: number;
} = {}): Promise<WhatsAppAddressRow[]> {
  const limit = opts.limit ?? 500;
  let q = untypedFrom("whatsapp_addresses")
    .select("*, linked_partner:partners(id,name)")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (opts.search && opts.search.trim().length >= 2) {
    const s = opts.search.trim();
    q = q.or(`display_name.ilike.%${s}%,handle.ilike.%${s}%,phone_e164.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as WhatsAppAddressRow[];
}

export async function updateWhatsAppAddressNotes(id: string, notes: string): Promise<void> {
  const { error } = await untypedFrom("whatsapp_addresses").update({ notes }).eq("id", id);
  if (error) throw error;
}

export const whatsappAddressKeys = {
  all: queryKeys.v2.rubrica.whatsapp,
  list: (search?: string) => [...queryKeys.v2.rubrica.whatsapp, "list", search ?? ""] as const,
};