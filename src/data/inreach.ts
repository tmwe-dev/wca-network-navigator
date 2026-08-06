/**
 * DAL — Inbound channel messages (Inreach)
 */
import { supabase } from "@/integrations/supabase/client";

export interface InboundMessageRow {
  readonly id: string;
  readonly from_address: string | null;
  readonly subject: string | null;
  readonly body_text: string | null;
  readonly body_html: string | null;
  readonly channel: string;
  readonly direction: string;
  readonly created_at: string;
  readonly read_at: string | null;
  readonly category: string | null;
}

export async function findInboundMessages(
  search: string,
  catFilter: string,
  limit = 100,
): Promise<InboundMessageRow[]> {
  let q = supabase
    .from("channel_messages")
    .select("id, from_address, subject, body_text, body_html, channel, direction, created_at, read_at, category")
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (search) q = q.or(`subject.ilike.%${search}%,from_address.ilike.%${search}%`);
  if (catFilter) q = q.eq("category", catFilter);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as InboundMessageRow[];
}

export async function markChannelMessageRead(id: string): Promise<void> {
  const { error } = await supabase.from("channel_messages").update({ read_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
