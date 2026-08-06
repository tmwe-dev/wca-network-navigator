import { useQuery } from "@tanstack/react-query";
import { HOLDING_STATUSES } from "@/constants/holdingPattern";
import { getPartnersByLeadStatus } from "@/data/partners";
import {
  findHoldingProspects,
  findHoldingImportedContacts,
  findRecentActivityRefs,
  findProfileNames,
  findAgentBadges,
  findPartnerTimeline,
  findProspectInteractionsTimeline,
  findContactInteractionsTimeline,
} from "@/data/holdingPattern";
import { queryKeys } from "@/lib/queryKeys";

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

const ACTIVE_STATUSES = [...HOLDING_STATUSES];

export function useHoldingPatternList() {
  return useQuery({
    queryKey: queryKeys.contacts.holdingPatternList(),
    queryFn: async () => {
      const items: HoldingItem[] = [];

      // Partners
      const partners = (await getPartnersByLeadStatus(
        ACTIVE_STATUSES,
        "id, company_name, country_name, country_code, city, email, lead_status, last_interaction_at, interaction_count",
      )) as unknown[];

      ((partners || []) as Record<string, unknown>[]).forEach((p) =>
        items.push({
          id: String(p.id),
          source: "partner",
          name: String(p.company_name || ""),
          country: String(p.country_name || ""),
          countryCode: String(p.country_code || ""),
          city: (p.city as string) || null,
          email: (p.email as string) || null,
          leadStatus: String(p.lead_status || ""),
          lastInteractionAt: (p.last_interaction_at as string) || null,
          interactionCount: Number(p.interaction_count || 0),
        }),
      );

      // Prospects
      const prospects = await findHoldingProspects(ACTIVE_STATUSES);

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
        }),
      );

      // Imported contacts
      const contacts = await findHoldingImportedContacts(ACTIVE_STATUSES);

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
        }),
      );

      // ── Enrich with tutor + agent info from activities ──
      if (items.length > 0) {
        const allIds = items.map((i) => i.id);
        // Fetch most recent activity per source_id with user and agent info
        const activities = await findRecentActivityRefs(allIds);

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
          const profileMap = await findProfileNames(userIds);

          // Fetch unique agents
          const agentIds = [...new Set([...actMap.values()].map((v) => v.agentId).filter(Boolean))] as string[];
          const agentMap = await findAgentBadges(agentIds);

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
    queryKey: queryKeys.contacts.holdingTimeline(item?.id, item?.source),
    queryFn: async (): Promise<TimelineEntry[]> => {
      if (!item) return [];
      const entries: TimelineEntry[] = [];

      if (item.source === "partner") {
        const { activities: acts, interactions: ints, emails } = await findPartnerTimeline(item.id);
        acts.forEach((a) =>
          entries.push({
            id: a.id,
            date: a.created_at,
            type: "activity",
            subType: a.activity_type,
            title: a.title,
            description: a.description,
            status: a.status,
          }),
        );
        ints.forEach((i) =>
          entries.push({
            id: i.id,
            date: i.created_at!,
            type: "interaction",
            subType: i.interaction_type,
            title: i.subject,
            description: i.notes,
          }),
        );
        emails.forEach((e) =>
          entries.push({
            id: e.id,
            date: e.sent_at!,
            type: "email",
            subType: "email_sent",
            title: e.subject,
            description: `→ ${e.recipient_email}`,
          }),
        );
      } else {
        const rows =
          item.source === "prospect"
            ? await findProspectInteractionsTimeline(item.id)
            : await findContactInteractionsTimeline(item.id);
        rows.forEach((i) =>
          entries.push({
            id: i.id,
            date: i.created_at,
            type: "interaction",
            subType: i.interaction_type,
            title: i.title,
            description: i.description,
            outcome: i.outcome,
          }),
        );
      }

      // Sort by date desc
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return entries;
    },
    enabled: !!item,
  });
}
