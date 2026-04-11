/**
 * useInreachV2 — Inbound messages query + mark read
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface InboundMessage {
  readonly id: string;
  readonly fromAddress: string | null;
  readonly subject: string | null;
  readonly bodyText: string | null;
  readonly bodyHtml: string | null;
  readonly channel: string;
  readonly direction: string;
  readonly createdAt: string;
  readonly readAt: string | null;
  readonly category: string | null;
}

export function useInreachV2(search: string, catFilter: string) {
  return useQuery({
    queryKey: ["v2", "inreach", search, catFilter],
    queryFn: async (): Promise<readonly InboundMessage[]> => {
      let q = supabase
        .from("channel_messages")
        .select("id, from_address, subject, body_text, body_html, channel, direction, created_at, read_at, category")
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(100);
      if (search) q = q.or(`subject.ilike.%${search}%,from_address.ilike.%${search}%`);
      if (catFilter) q = q.eq("category", catFilter);
      const { data, error } = await q;
      if (error) return [];
      return (data ?? []).map((m) => ({
        id: m.id,
        fromAddress: m.from_address,
        subject: m.subject,
        bodyText: m.body_text,
        bodyHtml: m.body_html,
        channel: m.channel,
        direction: m.direction,
        createdAt: m.created_at,
        readAt: m.read_at,
        category: m.category,
      }));
    },
  });
}

export function useMarkReadV2() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("channel_messages")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["v2", "inreach"] }),
  });
}

export type { InboundMessage };
