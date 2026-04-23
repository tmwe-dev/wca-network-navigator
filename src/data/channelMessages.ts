/**
 * DAL — channel_messages
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ChannelMessageInsert = Database["public"]["Tables"]["channel_messages"]["Insert"];

export async function insertChannelMessage(msg: ChannelMessageInsert) {
  if (msg.message_id_external) {
    const { data, error } = await supabase
      .from("channel_messages")
      .upsert([msg], { onConflict: "user_id,message_id_external", ignoreDuplicates: true })
      .select();
    if (error) throw error;
    return { inserted: !!data?.length };
  }
  const { error } = await supabase.from("channel_messages").insert(msg);
  if (error) throw error;
  return { inserted: true };
}

export async function countChannelMessages(channel?: string) {
  let q = supabase.from("channel_messages").select("id", { count: "planned", head: true });
  if (channel) q = q.eq("channel", channel);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

/**
 * Unified inbox row from v_inbox_unified materialized view.
 * Denormalizes partner info, email classification, and address rules into message rows.
 * Use this for unified inbox views where you need partner/classification context with message data.
 */
export interface UnifiedInboxRow {
  message_id: string;
  user_id: string;
  direction: string;
  from_address: string | null;
  to_address: string | null;
  subject: string | null;
  body_text: string | null;
  message_date: string;
  channel: string;
  thread_id: string | null;
  sender_category: string | null;
  partner_id: string | null;
  source_type: string | null;
  source_id: string | null;
  is_read: boolean;
  // Denormalized partner data
  partner_name: string | null;
  partner_lead_status: string | null;
  partner_country: string | null;
  // Denormalized classification
  classification_category: string | null;
  classification_confidence: number | null;
  classification_urgency: string | null;
  classification_sentiment: string | null;
  // Email address rule
  rule_auto_action: string | null;
  rule_category: string | null;
}

/**
 * Fetch unified inbox messages with denormalized partner and classification data.
 * This replaces 3+ queries (message list + partner join + classification lookup).
 */
export async function getUnifiedInboxMessages(
  channel?: string,
  direction?: "inbound" | "outbound",
  limit = 100,
  offset = 0
): Promise<UnifiedInboxRow[]> {
  let q = supabase.from("v_inbox_unified").select("*").order("message_date", { ascending: false });

  if (channel) q = q.eq("channel", channel);
  if (direction) q = q.eq("direction", direction);

  const { data, error } = await q.range(offset, offset + limit - 1);
  if (error) throw error;
  return (data ?? []) as unknown as UnifiedInboxRow[];
}

/**
 * Count unread messages from v_inbox_unified view, grouped by channel/sender.
 */
export async function getUnifiedInboxStats(channel?: string): Promise<{ unread: number; total: number }> {
  let q = supabase.from("v_inbox_unified").select("message_id, is_read");

  if (channel) q = q.eq("channel", channel);

  const { data, error } = await q;
  if (error) throw error;

  const messages = (data ?? []) as Array<{ message_id: string; is_read: boolean }>;
  return {
    unread: messages.filter(m => !m.is_read).length,
    total: messages.length,
  };
}
