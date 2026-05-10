import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
    // Holding pattern (circuito) — partner attivamente nel ciclo (post primo touch, pre conversione)
    supabase
      .from("partners")
      .select("id", { count: "planned", head: true })
      .in("lead_status", ["first_touch_sent", "holding", "engaged", "qualified", "negotiation"]),
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
  const queryClient = useQueryClient();

  // Realtime: invalidate counter on inbound INSERT / read_at UPDATE on
  // channel_messages and on activities status changes. Polling stays as a
  // safety net but at a much lower frequency.
  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.unreadCounts });
    };
    const channel = supabase
      .channel("unread-counts-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "channel_messages" }, invalidate)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "channel_messages" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "activities" }, invalidate)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: queryKeys.channelMessages.unreadCounts,
    queryFn: fetchUnreadCounts,
    refetchInterval: 120_000,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
