/** DAL — Queries for useInboundNotifications. */
import { supabase } from "@/integrations/supabase/client";

export async function countUnreadInboundEmails(): Promise<{ count: number; error: { message: string } | null }> {
  const { count, error } = await supabase
    .from("channel_messages")
    .select("id", { count: "planned", head: true })
    .eq("direction", "inbound")
    .eq("channel", "email")
    .is("read_at", null);
  return { count: count || 0, error };
}

export async function markChannelMessageAsRead(messageId: string): Promise<void> {
  const { error } = await supabase.from("channel_messages").update({ read_at: new Date().toISOString() }).eq("id", messageId);
  if (error) throw error;
}
