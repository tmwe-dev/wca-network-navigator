/**
 * useInreachV2 — Inbound messages query + mark read
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import { findInboundMessages, markChannelMessageRead } from "@/data/inreach";

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
    queryKey: queryKeys.v2.inreach(search, catFilter),
    queryFn: async (): Promise<readonly InboundMessage[]> => {
      let data;
      try {
        data = await findInboundMessages(search, catFilter, 100);
      } catch {
        return [];
      }
      return data.map((m) => ({
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
      await markChannelMessageRead(id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.v2.inreach() }),
  });
}

export type { InboundMessage };
