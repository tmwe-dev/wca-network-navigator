import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HoldingSource = "partner" | "prospect" | "contact";

export interface HoldingItem {
  id: string;
  source: HoldingSource;
  name: string;
  country?: string | null;
  countryCode?: string | null;
  city?: string | null;
  email?: string | null;
  leadStatus: string;
  lastInteractionAt: string | null;
  interactionCount: number;
}

export interface TimelineEntry {
  id: string;
  date: string;
  type: "activity" | "interaction" | "email";
  subType: string;
  title: string;
  description: string | null;
  status?: string | null;
  outcome?: string | null;
}

const ACTIVE_STATUSES = ["contacted", "in_progress", "negotiation"];

export function useHoldingPatternList() {
  return useQuery({
    queryKey: ["holding-pattern-list"],
    queryFn: async () => {
      const items: HoldingItem[] = [];

      // Partners
      const { data: partners } = await supabase
        .from("partners")
        .select("id, company_name, country_name, country_code, city, email, lead_status, last_interaction_at, interaction_count")
        .in("lead_status", ACTIVE_STATUSES)
        .order("last_interaction_at", { ascending: false, nullsFirst: false });

      (partners || []).forEach((p) =>
        items.push({
          id: p.id,
          source: "partner",
          name: p.company_name,
          country: p.country_name,
          countryCode: p.country_code,
          city: p.city,
          email: p.email,
          leadStatus: p.lead_status,
          lastInteractionAt: p.last_interaction_at,
          interactionCount: p.interaction_count,
        })
      );

      // Prospects
      const { data: prospects } = await supabase
        .from("prospects" as any)
        .select("id, company_name, city, email, lead_status, last_interaction_at, interaction_count")
        .in("lead_status", ACTIVE_STATUSES)
        .order("last_interaction_at", { ascending: false, nullsFirst: false });

      ((prospects as any[]) || []).forEach((p) =>
        items.push({
          id: p.id,
          source: "prospect",
          name: p.company_name,
          city: p.city,
          email: p.email,
          leadStatus: p.lead_status,
          lastInteractionAt: p.last_interaction_at,
          interactionCount: p.interaction_count,
        })
      );

      // Imported contacts
      const { data: contacts } = await supabase
        .from("imported_contacts")
        .select("id, company_name, name, city, email, lead_status, last_interaction_at, interaction_count, country")
        .in("lead_status", ACTIVE_STATUSES)
        .order("last_interaction_at", { ascending: false, nullsFirst: false });

      (contacts || []).forEach((c) =>
        items.push({
          id: c.id,
          source: "contact",
          name: c.company_name || c.name || "—",
          country: c.country ?? undefined,
          city: c.city ?? undefined,
          email: c.email ?? undefined,
          leadStatus: c.lead_status,
          lastInteractionAt: c.last_interaction_at,
          interactionCount: c.interaction_count,
        })
      );

      return items;
    },
    staleTime: 15_000,
  });
}

export function useHoldingTimeline(item: HoldingItem | null) {
  return useQuery({
    queryKey: ["holding-timeline", item?.id, item?.source],
    queryFn: async (): Promise<TimelineEntry[]> => {
      if (!item) return [];
      const entries: TimelineEntry[] = [];

      if (item.source === "partner") {
        // Activities
        const { data: acts } = await supabase
          .from("activities")
          .select("id, created_at, activity_type, title, description, status")
          .or(`partner_id.eq.${item.id},source_id.eq.${item.id}`)
          .order("created_at", { ascending: false })
          .limit(50);
        (acts || []).forEach((a) =>
          entries.push({
            id: a.id,
            date: a.created_at,
            type: "activity",
            subType: a.activity_type,
            title: a.title,
            description: a.description,
            status: a.status,
          })
        );

        // Interactions
        const { data: ints } = await supabase
          .from("interactions")
          .select("id, created_at, interaction_type, subject, notes")
          .eq("partner_id", item.id)
          .order("created_at", { ascending: false })
          .limit(50);
        (ints || []).forEach((i) =>
          entries.push({
            id: i.id,
            date: i.created_at!,
            type: "interaction",
            subType: i.interaction_type,
            title: i.subject,
            description: i.notes,
          })
        );

        // Sent emails
        const { data: emails } = await supabase
          .from("email_campaign_queue")
          .select("id, sent_at, subject, recipient_email, status")
          .eq("partner_id", item.id)
          .eq("status", "sent")
          .order("sent_at", { ascending: false })
          .limit(50);
        (emails || []).forEach((e) =>
          entries.push({
            id: e.id,
            date: e.sent_at!,
            type: "email",
            subType: "email_sent",
            title: e.subject,
            description: `→ ${e.recipient_email}`,
          })
        );
      } else if (item.source === "prospect") {
        const { data: pInts } = await supabase
          .from("prospect_interactions" as any)
          .select("id, created_at, interaction_type, title, description, outcome")
          .eq("prospect_id", item.id)
          .order("created_at", { ascending: false })
          .limit(50);
        ((pInts as any[]) || []).forEach((i) =>
          entries.push({
            id: i.id,
            date: i.created_at,
            type: "interaction",
            subType: i.interaction_type,
            title: i.title,
            description: i.description,
            outcome: i.outcome,
          })
        );
      } else {
        const { data: cInts } = await supabase
          .from("contact_interactions")
          .select("id, created_at, interaction_type, title, description, outcome")
          .eq("contact_id", item.id)
          .order("created_at", { ascending: false })
          .limit(50);
        (cInts || []).forEach((i) =>
          entries.push({
            id: i.id,
            date: i.created_at,
            type: "interaction",
            subType: i.interaction_type,
            title: i.title,
            description: i.description,
            outcome: i.outcome,
          })
        );
      }

      // Sort by date desc
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return entries;
    },
    enabled: !!item,
  });
}
