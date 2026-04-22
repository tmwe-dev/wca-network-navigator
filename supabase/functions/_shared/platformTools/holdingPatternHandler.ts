/**
 * holdingPatternHandler.ts - Holding pattern query handler
 * Handles: get holding pattern
 */

import { supabase } from "./supabaseClient.ts";

interface HoldingItem {
  id: string;
  source: string;
  name: string;
  country: string;
  city?: string;
  email: string | null;
  status: string;
  days_waiting: number;
  interactions?: number;
}

export async function handleGetHoldingPattern(
  args: Record<string, unknown>
): Promise<unknown> {
  const items: HoldingItem[] = [];
  const activeStatuses = ["first_touch_sent", "holding", "engaged", "qualified", "negotiation"];
  const now = new Date();
  if (!args.source_type || args.source_type === "wca" || args.source_type === "all") {
    let pq = supabase
      .from("partners")
      .select(
        "id, company_name, country_code, city, email, lead_status, last_interaction_at, interaction_count"
      )
      .in("lead_status", activeStatuses)
      .order("last_interaction_at", { ascending: true, nullsFirst: true });
    if (args.country_code)
      pq = pq.eq("country_code", String(args.country_code).toUpperCase());
    const { data: partners } = await pq.limit(Number(args.limit) || 50);
    (partners || []).forEach(
      (p: {
        id: string;
        company_name: string;
        country_code: string;
        city: string;
        email: string | null;
        lead_status: string;
        last_interaction_at: string | null;
        interaction_count: number;
      }) => {
        const days = p.last_interaction_at
          ? Math.floor((now.getTime() - new Date(p.last_interaction_at).getTime()) / 86400000)
          : 999;
        if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
        if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
        items.push({
          id: p.id,
          source: "wca",
          name: p.company_name,
          country: p.country_code,
          city: p.city,
          email: p.email,
          status: p.lead_status,
          days_waiting: days,
          interactions: p.interaction_count,
        });
      }
    );
  }
  if (!args.source_type || args.source_type === "crm" || args.source_type === "all") {
    const cq = supabase
      .from("imported_contacts")
      .select(
        "id, name, company_name, country, city, email, lead_status, last_interaction_at, interaction_count"
      )
      .in("lead_status", activeStatuses)
      .order("last_interaction_at", { ascending: true, nullsFirst: true });
    const { data: contacts } = await cq.limit(Number(args.limit) || 50);
    (contacts || []).forEach(
      (c: {
        id: string;
        name: string;
        company_name: string;
        country: string;
        city: string;
        email: string | null;
        lead_status: string;
        last_interaction_at: string | null;
        interaction_count: number;
      }) => {
        const days = c.last_interaction_at
          ? Math.floor((now.getTime() - new Date(c.last_interaction_at).getTime()) / 86400000)
          : 999;
        if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
        if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
        items.push({
          id: c.id,
          source: "crm",
          name: c.company_name || c.name || "—",
          country: c.country,
          email: c.email,
          status: c.lead_status,
          days_waiting: days,
        });
      }
    );
  }
  items.sort((a, b) => b.days_waiting - a.days_waiting);
  return { count: items.length, items: items.slice(0, Number(args.limit) || 50) };
}
