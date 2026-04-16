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
