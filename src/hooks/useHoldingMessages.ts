/**
 * Hook to fetch channel_messages from contacts currently in the holding pattern.
 * Filters by channel (email/whatsapp/linkedin) and cross-references partner_id
 * with holding pattern items.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { findPartners } from "@/data/partners";
import type { ChannelMessage } from "@/hooks/useChannelMessages";

export type HoldingChannel = "email" | "whatsapp" | "linkedin";

const HOLDING_STATUSES = ["contacted", "in_progress", "negotiation"];

export interface HoldingMessageGroup {
  partnerId: string;
  companyName: string;
  email: string | null;
  leadStatus: string;
  messages: ChannelMessage[];
  unreadCount: number;
  latestDate: string;
}

export function useHoldingMessages(channel: HoldingChannel) {
  return useQuery({
    queryKey: ["holding-messages", channel],
    queryFn: async () => {
      // Step 1: Get partner IDs in holding pattern
      const { data: partners } = await supabase
        .from("partners")
        .select("id, company_name, email, lead_status")
        .in("lead_status", HOLDING_STATUSES);

      if (!partners?.length) return [] as HoldingMessageGroup[];

      const partnerMap = new Map(partners.map(p => [p.id, p]));
      const partnerIds = partners.map(p => p.id);

      // Step 2: Get messages for these partners on the specified channel
      const { data: messages, error } = await supabase
        .from("channel_messages")
        .select("id, user_id, channel, direction, source_type, source_id, partner_id, from_address, to_address, cc_addresses, bcc_addresses, subject, body_text, message_id_external, in_reply_to, read_at, created_at, email_date, raw_storage_path, raw_sha256, raw_size_bytes, imap_uid, uidvalidity, imap_flags, internal_date, parse_status, parse_warnings, thread_id, references_header")
        .eq("channel", channel)
        .in("partner_id", partnerIds)
        .order("email_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Step 3: Deduplicate by message_id_external or subject+from+date
      const seen = new Set<string>();
      const deduped: ChannelMessage[] = [];
      for (const msg of (messages || []) as unknown as ChannelMessage[]) {
        // Primary dedup key: message_id_external
        if (msg.message_id_external) {
          if (seen.has(msg.message_id_external)) continue;
          seen.add(msg.message_id_external);
        } else {
          // Fallback dedup key: subject + from + date
          const fallbackKey = `${msg.subject || ""}|${msg.from_address || ""}|${msg.email_date || msg.created_at}`;
          if (seen.has(fallbackKey)) continue;
          seen.add(fallbackKey);
        }
        deduped.push(msg);
      }

      // Step 4: Group by partner
      const groupMap = new Map<string, HoldingMessageGroup>();

      for (const msg of deduped) {
        const pid = msg.partner_id;
        if (!pid || !partnerMap.has(pid)) continue;

        if (!groupMap.has(pid)) {
          const p = partnerMap.get(pid)!;
          groupMap.set(pid, {
            partnerId: pid,
            companyName: p.company_name,
            email: p.email,
            leadStatus: p.lead_status,
            messages: [],
            unreadCount: 0,
            latestDate: msg.email_date || msg.created_at,
          });
        }

        const group = groupMap.get(pid)!;
        group.messages.push(msg);
        if (!msg.read_at) group.unreadCount++;
      }

      // Sort groups by latest message date
      return Array.from(groupMap.values()).sort(
        (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
      );
    },
    staleTime: 30_000,
  });
}

export function useHoldingUnreadCounts() {
  return useQuery({
    queryKey: ["holding-unread-counts"],
    queryFn: async () => {
      const { data: partners } = await supabase
        .from("partners")
        .select("id")
        .in("lead_status", HOLDING_STATUSES);

      if (!partners?.length) return { email: 0, whatsapp: 0, linkedin: 0 };

      const partnerIds = partners.map(p => p.id);
      const counts = { email: 0, whatsapp: 0, linkedin: 0 };

      for (const ch of ["email", "whatsapp", "linkedin"] as const) {
        const { count } = await supabase
          .from("channel_messages")
          .select("id", { count: "exact", head: true })
          .eq("channel", ch)
          .in("partner_id", partnerIds)
          .is("read_at", null);
        counts[ch] = count || 0;
      }

      return counts;
    },
    staleTime: 60_000,
  });
}
