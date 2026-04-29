/**
 * domainsExtraHandler.ts - Tool handlers per domini transazionali
 * Aggiunti 2026-04-29 per dare a Command paritetà con la UI su:
 * deals, calendar, outreach_queue, notifications, agent_tasks, kb,
 * blacklist, email_send_log, holding_pattern, dashboard, partner_contacts.
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

// ─────────────────────────────────────────────────────────────────
// Deals
// ─────────────────────────────────────────────────────────────────

export async function handleListDeals(args: Record<string, unknown>): Promise<unknown> {
  let q = supabase
    .from("deals")
    .select("id, title, stage, amount, currency, probability, partner_id, contact_id, expected_close_date, created_at, updated_at");
  if (args.stage) q = q.eq("stage", args.stage);
  if (Array.isArray(args.stages) && (args.stages as string[]).length) q = q.in("stage", args.stages as string[]);
  if (args.partner_id) q = q.eq("partner_id", args.partner_id);
  if (args.contact_id) q = q.eq("contact_id", args.contact_id);
  if (args.min_amount) q = q.gte("amount", Number(args.min_amount));
  if (args.closing_within_days) {
    const d = new Date();
    d.setDate(d.getDate() + Number(args.closing_within_days));
    q = q.lte("expected_close_date", d.toISOString().slice(0, 10));
  }
  q = q.order("updated_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 100));
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, deals: data || [] };
}

export async function handleGetPipelineView(_args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase.from("deals").select("stage, amount");
  if (error) return { error: error.message };
  const stages: Record<string, { count: number; total_value: number }> = {};
  for (const d of (data || []) as Array<{ stage: string; amount: number | null }>) {
    const s = d.stage || "unknown";
    if (!stages[s]) stages[s] = { count: 0, total_value: 0 };
    stages[s].count += 1;
    stages[s].total_value += Number(d.amount || 0);
  }
  return { stages, total_deals: (data || []).length };
}

// ─────────────────────────────────────────────────────────────────
// Outreach queue
// ─────────────────────────────────────────────────────────────────

export async function handleListOutreachQueue(args: Record<string, unknown>): Promise<unknown> {
  let q = supabase
    .from("outreach_queue")
    .select("id, channel, status, recipient_name, recipient_email, subject, partner_id, contact_id, attempts, last_error, created_at, processed_at, replied_at")
    .is("deleted_at", null);
  if (args.status) q = q.eq("status", args.status);
  if (Array.isArray(args.statuses) && (args.statuses as string[]).length) q = q.in("status", args.statuses as string[]);
  if (args.channel) q = q.eq("channel", args.channel);
  if (args.partner_id) q = q.eq("partner_id", args.partner_id);
  if (args.contact_id) q = q.eq("contact_id", args.contact_id);
  if (args.has_reply === true) q = q.not("replied_at", "is", null);
  if (args.has_reply === false) q = q.is("replied_at", null);
  q = q.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 100));
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, queue: data || [] };
}

// ─────────────────────────────────────────────────────────────────
// Calendar
// ─────────────────────────────────────────────────────────────────

export async function handleListCalendarEvents(args: Record<string, unknown>): Promise<unknown> {
  let q = supabase
    .from("calendar_events")
    .select("id, title, description, event_type, start_at, end_at, all_day, partner_id, contact_id, deal_id, location, status")
    .is("deleted_at", null);
  if (args.event_type) q = q.eq("event_type", args.event_type);
  if (args.status) q = q.eq("status", args.status);
  if (args.partner_id) q = q.eq("partner_id", args.partner_id);
  if (args.contact_id) q = q.eq("contact_id", args.contact_id);
  if (args.deal_id) q = q.eq("deal_id", args.deal_id);
  if (args.from_date) q = q.gte("start_at", args.from_date);
  if (args.to_date) q = q.lte("start_at", args.to_date);
  if (args.upcoming === true) q = q.gte("start_at", new Date().toISOString());
  q = q.order("start_at", { ascending: true }).limit(Math.min(Number(args.limit) || 20, 100));
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, events: data || [] };
}

// ─────────────────────────────────────────────────────────────────
// Notifications
// ─────────────────────────────────────────────────────────────────

export async function handleListNotifications(args: Record<string, unknown>, userId: string): Promise<unknown> {
  let q = supabase
    .from("notifications")
    .select("id, title, body, type, priority, read, dismissed, action_url, entity_type, entity_id, created_at")
    .eq("user_id", userId);
  if (args.unread_only === true) q = q.eq("read", false);
  if (args.type) q = q.eq("type", args.type);
  if (args.entity_type) q = q.eq("entity_type", args.entity_type);
  if (args.entity_id) q = q.eq("entity_id", args.entity_id);
  q = q.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 100));
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, notifications: data || [] };
}

// ─────────────────────────────────────────────────────────────────
// Agent tasks
// ─────────────────────────────────────────────────────────────────

export async function handleListAgentTasksStatus(args: Record<string, unknown>): Promise<unknown> {
  let q = supabase
    .from("agent_tasks")
    .select("id, agent_id, task_type, description, status, scheduled_at, started_at, completed_at, result_summary, created_at");
  if (args.status) q = q.eq("status", args.status);
  if (args.agent_id) q = q.eq("agent_id", args.agent_id);
  if (args.task_type) q = q.eq("task_type", args.task_type);
  q = q.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 100));
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, tasks: data || [] };
}

// ─────────────────────────────────────────────────────────────────
// Knowledge Base
// ─────────────────────────────────────────────────────────────────

export async function handleSearchKb(args: Record<string, unknown>): Promise<unknown> {
  const term = String(args.query || "").trim();
  let q = supabase
    .from("kb_entries")
    .select("id, title, category, chapter, content, tags, priority, updated_at")
    .limit(Math.min(Number(args.limit) || 10, 30));
  if (term) {
    q = q.or(`title.ilike.%${escapeLike(term)}%,content.ilike.%${escapeLike(term)}%`);
  }
  if (args.category) q = q.eq("category", args.category);
  if (args.chapter) q = q.eq("chapter", args.chapter);
  q = q.order("priority", { ascending: false, nullsFirst: false });
  const { data, error } = await q;
  if (error) return { error: error.message };
  return {
    count: data?.length || 0,
    entries: (data || []).map((e: Record<string, unknown>) => ({
      ...e,
      content_preview: String(e.content || "").substring(0, 500),
    })),
  };
}

// ─────────────────────────────────────────────────────────────────
// Lead score breakdown
// ─────────────────────────────────────────────────────────────────

export async function handleGetLeadScoreBreakdown(args: Record<string, unknown>): Promise<unknown> {
  if (!args.contact_id) return { error: "contact_id richiesto" };
  const { data, error } = await supabase
    .from("imported_contacts")
    .select("id, name, lead_score, lead_score_breakdown, lead_score_updated_at")
    .eq("id", args.contact_id as string)
    .maybeSingle();
  if (error) return { error: error.message };
  if (!data) return { error: "Contatto non trovato" };
  return data;
}

// ─────────────────────────────────────────────────────────────────
// Blacklist email check
// ─────────────────────────────────────────────────────────────────

export async function handleCheckBlacklistEmail(args: Record<string, unknown>): Promise<unknown> {
  const email = String(args.email || "").toLowerCase().trim();
  if (!email) return { error: "email richiesta" };
  const domain = email.split("@")[1] || "";
  const { data, error } = await supabase
    .from("blacklist")
    .select("email, domain, reason, created_at")
    .or(`email.eq.${email},domain.eq.${domain}`);
  if (error) return { error: error.message };
  return { hit: (data || []).length > 0, entries: data || [] };
}

// ─────────────────────────────────────────────────────────────────
// Email send log
// ─────────────────────────────────────────────────────────────────

export async function handleListEmailSendLog(args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await supabase
    .from("email_send_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(args.limit) || 20, 100));
  if (error) return { error: error.message };
  let rows = (data || []) as Array<Record<string, unknown>>;
  if (args.recipient_email) {
    const e = String(args.recipient_email).toLowerCase();
    rows = rows.filter((r) => String(r.recipient_email || "").toLowerCase() === e);
  }
  return { count: rows.length, log: rows };
}

// ─────────────────────────────────────────────────────────────────
// Holding pattern list
// ─────────────────────────────────────────────────────────────────

export async function handleGetHoldingPatternList(args: Record<string, unknown>): Promise<unknown> {
  const limit = Math.min(Number(args.limit) || 50, 200);
  let q = supabase
    .from("imported_contacts")
    .select("id, name, company_name, email, country, lead_status, last_interaction_at, interaction_count, created_at")
    .eq("interaction_count", 0)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (args.country) q = q.eq("country", args.country);
  if (args.lead_status) q = q.eq("lead_status", args.lead_status);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, contacts: data || [] };
}

// ─────────────────────────────────────────────────────────────────
// Global dashboard
// ─────────────────────────────────────────────────────────────────

export async function handleGetGlobalDashboard(_args: Record<string, unknown>): Promise<unknown> {
  const [partnersC, contactsC, manualC, dealsC, queueC, notifC, eventsC, bcaC, dealStages] = await Promise.all([
    supabase.from("partners").select("id", { count: "exact", head: true }),
    supabase.from("imported_contacts").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("imported_contacts").select("id", { count: "exact", head: true }).eq("origin", "manual").is("deleted_at", null),
    supabase.from("deals").select("id", { count: "exact", head: true }),
    supabase.from("outreach_queue").select("id", { count: "exact", head: true }).eq("status", "pending").is("deleted_at", null),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
    supabase.from("calendar_events").select("id", { count: "exact", head: true }).gte("start_at", new Date().toISOString()).is("deleted_at", null),
    supabase.from("business_cards").select("id", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("deals").select("stage"),
  ]);
  const stageBreakdown: Record<string, number> = {};
  for (const d of (dealStages.data || []) as Array<{ stage: string }>) {
    const s = d.stage || "unknown";
    stageBreakdown[s] = (stageBreakdown[s] || 0) + 1;
  }
  return {
    totals: {
      partners: partnersC.count || 0,
      contacts: contactsC.count || 0,
      contacts_manual: manualC.count || 0,
      deals: dealsC.count || 0,
      business_cards: bcaC.count || 0,
    },
    pipeline_stage_breakdown: stageBreakdown,
    operational: {
      outreach_queue_pending: queueC.count || 0,
      notifications_unread: notifC.count || 0,
      calendar_events_upcoming: eventsC.count || 0,
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Partner contacts search (cerca direttamente nei contatti diretti dei partner)
// ─────────────────────────────────────────────────────────────────

export async function handleSearchPartnerContacts(args: Record<string, unknown>): Promise<unknown> {
  let q = supabase
    .from("partner_contacts")
    .select("id, partner_id, name, email, title, direct_phone, mobile, is_primary, contact_alias, created_at")
    .is("deleted_at", null);
  if (args.name) q = q.ilike("name", `%${escapeLike(String(args.name))}%`);
  if (args.email) q = q.ilike("email", `%${escapeLike(String(args.email))}%`);
  if (args.partner_id) q = q.eq("partner_id", args.partner_id);
  if (args.is_primary === true) q = q.eq("is_primary", true);
  q = q.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 100));
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, contacts: data || [] };
}