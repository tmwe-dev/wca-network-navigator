/**
 * DAL — channel_messages
 */
import { supabase } from "@/integrations/supabase/client";

export async function insertChannelMessage(msg: Record<string, unknown>) {
  const { error } = await supabase.from("channel_messages").insert(msg as any);
  if (error) throw error;
}

export async function countChannelMessages(channel?: string) {
  let q = supabase.from("channel_messages").select("id", { count: "planned", head: true });
  if (channel) q = q.eq("channel", channel);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}
