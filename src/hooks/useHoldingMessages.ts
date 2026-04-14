/**
 * Hook to fetch channel_messages from contacts currently in the holding pattern.
 * Filters by channel (email/whatsapp/linkedin) and cross-references partner_id
 * with holding pattern items AND imported_contacts.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPartnersByLeadStatus } from "@/data/partners";
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
  /** True when this group is from imported_contacts (not partners) */
  isImportedContact?: boolean;
}

export function useHoldingMessages(channel: HoldingChannel) {
  return useQuery({
    queryKey: ["holding-messages", channel],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return [] as HoldingMessageGroup[];

      // Step 1: Get partners AND imported_contacts in holding pattern
      const [holdingPartners, holdingContactsRes] = await Promise.all([
        getPartnersByLeadStatus(HOLDING_STATUSES, "id, company_name, email, lead_status"),
        supabase
          .from("imported_contacts")
          .select("id, name, email, lead_status, company_name")
          .eq("user_id", userId)
          .in("lead_status", HOLDING_STATUSES),
      ]);

      const partnerMap = new Map((holdingPartners || []).map((p) => [p.id, p]));
      const partnerIds = (holdingPartners || []).map((p) => p.id);

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
          : Promise.resolve({ data: [] as any[], error: null }), // eslint-disable-line @typescript-eslint/no-explicit-any -- Type not available in generated schema

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
          : Promise.resolve({ data: [] as any[], error: null }), // eslint-disable-line @typescript-eslint/no-explicit-any -- Type not available in generated schema
      ]);

      if (partnerMsgs.error) throw partnerMsgs.error;

      const allMessages = [
        ...(partnerMsgs.data || []),
        ...(contactMsgs.data || []),
      ];

      // Step 3: Deduplicate
      const seen = new Set<string>();
      const deduped: ChannelMessage[] = [];
      for (const msg of allMessages as any as ChannelMessage[]) { // eslint-disable-line @typescript-eslint/no-explicit-any -- Supabase JSON column double-cast required
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
              leadStatus: contact.lead_status || "contacted",
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
    queryKey: ["holding-unread-counts"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return { email: 0, whatsapp: 0, linkedin: 0 };

      const partners = await getPartnersByLeadStatus(HOLDING_STATUSES, "id");
      const partnerIds = (partners || []).map((p) => p.id);

      const { data: holdingContacts } = await supabase
        .from("imported_contacts")
        .select("email")
        .eq("user_id", userId)
        .in("lead_status", HOLDING_STATUSES);

      const contactEmails = (holdingContacts || [])
        .map(c => c.email?.toLowerCase())
        .filter(Boolean) as string[];

      const counts = { email: 0, whatsapp: 0, linkedin: 0 };

      for (const ch of ["email", "whatsapp", "linkedin"] as const) {
        const partnerCount = partnerIds.length > 0
          ? (await supabase
              .from("channel_messages")
              .select("id", { count: "exact", head: true })
              .eq("channel", ch)
              .in("partner_id", partnerIds)
              .is("read_at", null)).count || 0
          : 0;

        const contactCount = contactEmails.length > 0
          ? (await supabase
              .from("channel_messages")
              .select("id", { count: "exact", head: true })
              .eq("channel", ch)
              .eq("user_id", userId)
              .is("partner_id", null)
              .in("from_address", contactEmails)
              .is("read_at", null)).count || 0
          : 0;

        counts[ch] = partnerCount + contactCount;
      }

      return counts;
    },
    staleTime: 60_000,
  });
}
