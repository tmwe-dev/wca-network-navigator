import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/queryKeys";

export interface UnreadCounts {
  email: number;
  whatsapp: number;
  linkedin: number;
  circuito: number;
  todo: number;
}

async function fetchUnreadCounts(): Promise<UnreadCounts> {
  const [emailRes, waRes, liRes, circuitoRes, todoRes] = await Promise.all([
    // Unread emails
    supabase
      .from("channel_messages")
      .select("id", { count: "planned", head: true })
      .eq("channel", "email")
      .eq("direction", "inbound")
      .is("read_at", null),
    // Unread WhatsApp
    supabase
      .from("channel_messages")
      .select("id", { count: "planned", head: true })
      .eq("channel", "whatsapp")
      .eq("direction", "inbound")
      .is("read_at", null),
    // Unread LinkedIn
    supabase
      .from("channel_messages")
      .select("id", { count: "planned", head: true })
      .eq("channel", "linkedin")
      .eq("direction", "inbound")
      .is("read_at", null),
    // Holding pattern (circuito) — partners with contacted/in_progress status
    supabase
      .from("partners")
      .select("id", { count: "planned", head: true })
      .in("lead_status", ["contacted", "in_progress", "negotiation"]),
    // Pending activities
    supabase
      .from("activities")
      .select("id", { count: "planned", head: true })
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

export function useUnreadCounts() {
  return useQuery({
    queryKey: queryKeys.channelMessages.unreadCounts,
    queryFn: fetchUnreadCounts,
    refetchInterval: 60_000,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}
