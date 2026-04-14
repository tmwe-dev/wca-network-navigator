import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPartnersByLeadStatus } from "@/data/partners";

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
  /** Tutor (operator) display name */
  tutorName?: string | null;
  /** Agent AI emoji */
  agentEmoji?: string | null;
  /** Agent AI name */
  agentName?: string | null;
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
      const partners = await getPartnersByLeadStatus(ACTIVE_STATUSES, "id, company_name, country_name, country_code, city, email, lead_status, last_interaction_at, interaction_count") as any[];

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
        .from("prospects")
        .select("id, company_name, city, email, lead_status, last_interaction_at, interaction_count")
        .in("lead_status", ACTIVE_STATUSES)
        .order("last_interaction_at", { ascending: false, nullsFirst: false });

      (prospects || []).forEach((p) =>
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

      // ── Enrich with tutor + agent info from activities ──
      if (items.length > 0) {
        const allIds = items.map((i) => i.id);
        // Fetch most recent activity per source_id with user and agent info
        const { data: activities } = await supabase
          .from("activities")
          .select("source_id, user_id, executed_by_agent_id")
          .in("source_id", allIds)
          .order("created_at", { ascending: false });

        if (activities && activities.length > 0) {
          // Build map: source_id → first (most recent) activity
          const actMap = new Map<string, { userId: string | null; agentId: string | null }>();
          for (const a of activities) {
            if (!actMap.has(a.source_id)) {
              actMap.set(a.source_id, { userId: a.user_id, agentId: a.executed_by_agent_id });
            }
          }

          // Fetch unique user profiles
          const userIds = [...new Set([...actMap.values()].map((v) => v.userId).filter(Boolean))] as string[];
          const profileMap = new Map<string, string>();
          if (userIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("user_id, display_name")
              .in("user_id", userIds);
            (profiles || []).forEach((p) => profileMap.set(p.user_id, p.display_name || "Operatore"));
          }

          // Fetch unique agents
          const agentIds = [...new Set([...actMap.values()].map((v) => v.agentId).filter(Boolean))] as string[];
          const agentMap = new Map<string, { emoji: string; name: string }>();
          if (agentIds.length > 0) {
            const { data: agents } = await supabase
              .from("agents")
              .select("id, avatar_emoji, name")
              .in("id", agentIds);
            (agents || []).forEach((a) => agentMap.set(a.id, { emoji: a.avatar_emoji, name: a.name }));
          }

          // Assign to items
          for (const item of items) {
            const act = actMap.get(item.id);
            if (act) {
              if (act.userId) item.tutorName = profileMap.get(act.userId) || null;
              if (act.agentId) {
                const ag = agentMap.get(act.agentId);
                if (ag) {
                  item.agentEmoji = ag.emoji;
                  item.agentName = ag.name;
                }
              }
            }
          }
        }
      }

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
          .from("prospect_interactions")
          .select("id, created_at, interaction_type, title, description, outcome")
          .eq("prospect_id", item.id)
          .order("created_at", { ascending: false })
          .limit(50);
        (pInts || []).forEach((i) =>
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
