/**
 * DAL — contatori non letti per canale + circuito/todo.
 */
import { supabase } from "@/integrations/supabase/client";

export interface UnreadCountsResult {
  email: number;
  whatsapp: number;
  linkedin: number;
  circuito: number;
  todo: number;
}

function unreadByChannel(channel: string) {
  return supabase
    .from("channel_messages")
    .select("id", { count: "planned", head: true })
    .eq("channel", channel)
    .eq("direction", "inbound")
    .is("read_at", null)
    .not("hidden_by_rule", "is", true);
}

export async function fetchUnreadCounts(): Promise<UnreadCountsResult> {
  const [emailRes, waRes, liRes, circuitoRes, todoRes] = await Promise.all([
    unreadByChannel("email"),
    unreadByChannel("whatsapp"),
    unreadByChannel("linkedin"),
    supabase
      .from("partners")
      .select("id", { count: "planned", head: true })
      .in("lead_status", ["first_touch_sent", "holding", "engaged", "qualified", "negotiation"]),
    supabase
      .from("activities")
      .select("id", { count: "planned", head: true })
      .is("deleted_at", null)
      .in("status", ["pending", "in_progress"]),
  ]);

  return {
    email: emailRes.count ?? 0,
    whatsapp: waRes.count ?? 0,
    linkedin: liRes.count ?? 0,
    circuito: circuitoRes.count ?? 0,
    todo: todoRes.count ?? 0,
  };
}
