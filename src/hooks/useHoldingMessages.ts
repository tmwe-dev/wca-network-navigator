/**
 * Hook to fetch channel_messages from contacts currently in the holding pattern.
 * Filters by channel (email/whatsapp/linkedin) and cross-references partner_id
 * with holding pattern items AND imported_contacts.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPartnersByLeadStatus, getPartnersByLeadStatusFromView } from "@/data/partners";
import { getUnifiedInboxStats } from "@/data/channelMessages";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { queryKeys } from "@/lib/queryKeys";

export type HoldingChannel = "email" | "whatsapp" | "linkedin";

const HOLDING_STATUSES = ["first_touch_sent", "holding", "engaged", "qualified", "negotiation"];

export interface HoldingMessageGroup {
  partnerId: string;
  companyName: string;
  email: string | null;
  leadStatus: string;
  messages: ChannelMessage[];
  unreadCount: number;
  latestDate: string;
  /** True when this group is from imported_contacts (not partners) */
  isImportedContact?: boolean;
}

export function useHoldingMessages(channel: HoldingChannel) {
  return useQuery({
    queryKey: queryKeys.contacts.holdingMessages(channel),
    queryFn: async () => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      const userId = user?.id;
      if (!userId) return [] as HoldingMessageGroup[];

      // Step 1: Get partners AND imported_contacts in holding pattern
      // Use v_pipeline_lead view for partner queries (faster, pre-computed)
      const [holdingPartners, holdingContactsRes] = await Promise.all([
        getPartnersByLeadStatusFromView(HOLDING_STATUSES, "partner_id, company_name, email, lead_status"),
        supabase
          .from("imported_contacts")
          .select("id, name, email, lead_status, company_name")
          .eq("user_id", userId)
          .in("lead_status", HOLDING_STATUSES),
      ]);

      const partnerMap = new Map((holdingPartners || []).map((p) => [p.partner_id, p]));
      const partnerIds = (holdingPartners || []).map((p) => p.partner_id);

      const holdingContacts = holdingContactsRes.data || [];
      const contactEmails = holdingContacts
        .map(c => c.email?.toLowerCase())
        .filter(Boolean) as string[];

      // Step 2: Get messages for these partners AND contacts on the specified channel
      const selectCols = "id, user_id, channel, direction, source_type, source_id, partner_id, from_address, to_address, cc_addresses, bcc_addresses, subject, body_text, message_id_external, in_reply_to, read_at, created_at, email_date, raw_storage_path, raw_sha256, raw_size_bytes, imap_uid, uidvalidity, imap_flags, internal_date, parse_status, parse_warnings, thread_id, references_header";

      const [partnerMsgs, contactMsgs] = await Promise.all([
        partnerIds.length > 0
          ? supabase
              .from("channel_messages")
              .select(selectCols)
              .eq("channel", channel)
              .in("partner_id", partnerIds)
              .order("email_date", { ascending: false, nullsFirst: false })
              .order("created_at", { ascending: false })
              .limit(200)
          : Promise.resolve({ data: [] as unknown[], error: null }),

        contactEmails.length > 0
          ? supabase
              .from("channel_messages")
              .select(selectCols)
              .eq("channel", channel)
              .eq("user_id", userId)
              .eq("direction", "inbound")
              .is("partner_id", null)
              .in("from_address", contactEmails)
              .order("created_at", { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [] as unknown[], error: null }),
      ]);

      if (partnerMsgs.error) throw partnerMsgs.error;

      const allMessages = [
        ...(partnerMsgs.data || []),
        ...(contactMsgs.data || []),
      ];

      // Step 3: Deduplicate
      const seen = new Set<string>();
      const deduped: ChannelMessage[] = [];
      for (const msg of allMessages as unknown as ChannelMessage[]) {
        if (msg.message_id_external) {
          if (seen.has(msg.message_id_external)) continue;
          seen.add(msg.message_id_external);
        } else {
          const fallbackKey = `${msg.subject || ""}|${msg.from_address || ""}|${msg.email_date || msg.created_at}`;
          if (seen.has(fallbackKey)) continue;
          seen.add(fallbackKey);
        }
        deduped.push(msg);
      }

      // Step 4: Build contact email→contact map
      const contactEmailMap = new Map<string, (typeof holdingContacts)[number]>();
      for (const c of holdingContacts) {
        if (c.email) contactEmailMap.set(c.email.toLowerCase(), c);
      }

      // Step 5: Group by partner OR by contact email
      const groupMap = new Map<string, HoldingMessageGroup>();

      for (const msg of deduped) {
        const pid = msg.partner_id;

        if (pid && partnerMap.has(pid)) {
          if (!groupMap.has(pid)) {
            const p = partnerMap.get(pid)!;
            groupMap.set(pid, {
              partnerId: pid,
              companyName: p.company_name || "",
              email: p.email ?? null,
              leadStatus: p.lead_status || "",
              messages: [],
              unreadCount: 0,
              latestDate: msg.email_date || msg.created_at,
            });
          }
          const group = groupMap.get(pid)!;
          group.messages.push(msg);
          if (!msg.read_at) group.unreadCount++;
        } else if (!pid && msg.from_address) {
          const addr = msg.from_address.toLowerCase();
          const contact = contactEmailMap.get(addr);
          if (!contact) continue;

          const groupKey = `contact:${contact.id}`;
          if (!groupMap.has(groupKey)) {
            groupMap.set(groupKey, {
              partnerId: contact.id,
              companyName: contact.name || contact.company_name || addr,
              email: contact.email,
              leadStatus: contact.lead_status || "first_touch_sent",
              messages: [],
              unreadCount: 0,
              latestDate: msg.email_date || msg.created_at,
              isImportedContact: true,
            });
          }
          const group = groupMap.get(groupKey)!;
          group.messages.push(msg);
          if (!msg.read_at) group.unreadCount++;
        }
      }

      return Array.from(groupMap.values()).sort(
        (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
      );
    },
    staleTime: 30_000,
  });
}

export function useHoldingUnreadCounts() {
  return useQuery({
    queryKey: queryKeys.contacts.holdingUnreadCounts,
    queryFn: async () => {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      const userId = user?.id;
      if (!userId) return { email: 0, whatsapp: 0, linkedin: 0 };

      // Use v_inbox_unified materialized view for unified unread counts
      // This replaces 3 separate COUNT queries with a single aggregated query
      const counts = { email: 0, whatsapp: 0, linkedin: 0 };

      for (const ch of ["email", "whatsapp", "linkedin"] as const) {
        const stats = await getUnifiedInboxStats(ch);
        counts[ch] = stats.unread;
      }

      return counts;
    },
    staleTime: 60_000,
  });
}
