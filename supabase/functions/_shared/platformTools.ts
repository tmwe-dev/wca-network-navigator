/**
 * Platform-wide tool definitions and handler executor.
 * 
 * Single source of truth for ALL tools available to AI agents.
 * Imported by: contacts-assistant, cockpit-assistant, import-assistant, extension-brain.
 * 
 * The canonical definitions live in agent-execute/toolDefs.ts and agent-execute/toolHandlers.ts.
 * This module re-exports them in a format consumable by edge functions that use
 * the OpenAI-compatible tool calling API.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "./sqlEscape.ts";

// ── Local interfaces for query row shapes ──
interface CountryStatRow { country_code: string; total_partners: number; with_profile: number; without_profile: number; with_email: number; with_phone: number; }
interface DirectoryCountRow { country_code: string; member_count: number; }
interface PartnerSummary { id: string; company_name: string; city: string; country_code: string; country_name: string; email: string | null; phone: string | null; rating: number | null; wca_id: number | null; website: string | null; raw_profile_html: string | null; raw_profile_markdown: string | null; is_favorite: boolean; office_type: string | null; lead_status: string | null; }
interface ServiceRow { service_category: string; }
interface DownloadJobRow { id: string; country_name: string; status: string; current_index: number; total_count: number; contacts_found_count: number; error_message: string | null; created_at: string; }
interface EmailQueueRow { id: string; status: string; scheduled_at: string | null; sent_at: string | null; recipient_email: string; subject: string; }
interface AgentTaskRow { id: string; agent_id: string; description: string; status: string; task_type: string; created_at: string; result_summary: string | null; }
interface ActivityRow { id: string; title: string; status: string; activity_type: string; scheduled_at: string | null; due_date: string | null; source_meta: Record<string, unknown> | null; partner_id: string | null; priority: string; created_at: string; description: string | null; }
interface ChannelMessageRow { id: string; channel: string; direction: string; from_address: string | null; to_address: string | null; subject: string | null; body_text: string | null; email_date: string | null; read_at: string | null; partner_id: string | null; category: string | null; created_at: string; thread_id?: string | null; in_reply_to?: string | null; }
interface AgentRow { id: string; name: string; role: string; is_active: boolean; stats: Record<string, unknown>; avatar_emoji: string; updated_at: string; }
interface WorkPlanStep { index?: number; title?: string; description?: string; status?: string; }
interface HoldingItem { id: string; source: string; name: string; country: string; city?: string; email: string | null; status: string; days_waiting: number; interactions?: number; }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SUPABASE CLIENT (service role — shared across handlers)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELPER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function resolvePartnerId(args: Record<string, unknown>): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase.from("partners").select("id, company_name").eq("id", args.partner_id).single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  if (args.company_name) {
    const { data } = await supabase.from("partners").select("id, company_name").ilike("company_name", `%${escapeLike(args.company_name as string)}%`).limit(1).single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL DEFINITIONS (OpenAI format)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const PLATFORM_TOOLS = [
  // ── Partners ──
  { type: "function", function: { name: "search_partners", description: "Search and filter partners by country, city, name, rating, email/phone/profile presence, office type, favorites, services.", parameters: { type: "object", properties: { country_code: { type: "string" }, city: { type: "string" }, search_name: { type: "string" }, has_email: { type: "boolean" }, has_phone: { type: "boolean" }, has_profile: { type: "boolean" }, min_rating: { type: "number" }, office_type: { type: "string", enum: ["head_office", "branch"] }, is_favorite: { type: "boolean" }, service: { type: "string" }, sort_by: { type: "string", enum: ["rating", "name", "recent"] }, limit: { type: "number" }, count_only: { type: "boolean" } } } } },
  { type: "function", function: { name: "get_partner_detail", description: "Get complete details of a partner: contacts, networks, services, certifications.", parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" } } } } },
  { type: "function", function: { name: "get_country_overview", description: "Aggregated statistics per country.", parameters: { type: "object", properties: { country_code: { type: "string" }, sort_by: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "update_partner", description: "Update partner fields (favorite, lead_status, rating, alias).", parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" }, is_favorite: { type: "boolean" }, lead_status: { type: "string" }, rating: { type: "number" }, company_alias: { type: "string" } } } } },
  { type: "function", function: { name: "add_partner_note", description: "Add a note/interaction to a partner.", parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" }, subject: { type: "string" }, notes: { type: "string" }, interaction_type: { type: "string" } }, required: ["subject"] } } },
  { type: "function", function: { name: "bulk_update_partners", description: "Update multiple partners at once.", parameters: { type: "object", properties: { country_code: { type: "string" }, partner_ids: { type: "array", items: { type: "string" } }, is_favorite: { type: "boolean" }, lead_status: { type: "string" } } } } },

  // ── Contacts (CRM) ──
  { type: "function", function: { name: "search_contacts", description: "Search imported contacts (CRM).", parameters: { type: "object", properties: { search_name: { type: "string" }, company_name: { type: "string" }, country: { type: "string" }, email: { type: "string" }, origin: { type: "string" }, lead_status: { type: "string" }, has_email: { type: "boolean" }, limit: { type: "number" }, count_only: { type: "boolean" } } } } },
  { type: "function", function: { name: "get_contact_detail", description: "Get full details of an imported contact.", parameters: { type: "object", properties: { contact_id: { type: "string" }, contact_name: { type: "string" } } } } },
  { type: "function", function: { name: "update_lead_status", description: "Update lead status of contacts.", parameters: { type: "object", properties: { contact_ids: { type: "array", items: { type: "string" } }, company_name: { type: "string" }, country: { type: "string" }, status: { type: "string" } }, required: ["status"] } } },

  // ── Prospects ──
  { type: "function", function: { name: "search_prospects", description: "Search Italian prospects.", parameters: { type: "object", properties: { company_name: { type: "string" }, city: { type: "string" }, province: { type: "string" }, codice_ateco: { type: "string" }, min_fatturato: { type: "number" }, lead_status: { type: "string" }, limit: { type: "number" }, count_only: { type: "boolean" } } } } },

  // ── Activities ──
  { type: "function", function: { name: "list_activities", description: "List activities from the agenda.", parameters: { type: "object", properties: { status: { type: "string" }, activity_type: { type: "string" }, partner_name: { type: "string" }, due_before: { type: "string" }, due_after: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "create_activity", description: "Create a new activity.", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, activity_type: { type: "string" }, partner_id: { type: "string" }, company_name: { type: "string" }, due_date: { type: "string" }, priority: { type: "string" }, email_subject: { type: "string" }, email_body: { type: "string" } }, required: ["title", "activity_type"] } } },
  { type: "function", function: { name: "update_activity", description: "Update an activity.", parameters: { type: "object", properties: { activity_id: { type: "string" }, status: { type: "string" }, priority: { type: "string" }, due_date: { type: "string" } }, required: ["activity_id"] } } },

  // ── Reminders ──
  { type: "function", function: { name: "list_reminders", description: "List reminders.", parameters: { type: "object", properties: { status: { type: "string" }, priority: { type: "string" }, partner_name: { type: "string" } } } } },
  { type: "function", function: { name: "create_reminder", description: "Create a reminder for a partner.", parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" }, title: { type: "string" }, description: { type: "string" }, due_date: { type: "string" }, priority: { type: "string" } }, required: ["title", "due_date"] } } },

  // ── Memory ──
  { type: "function", function: { name: "save_memory", description: "Save a memory to persistent storage.", parameters: { type: "object", properties: { content: { type: "string" }, memory_type: { type: "string" }, tags: { type: "array", items: { type: "string" } }, importance: { type: "number" } }, required: ["content", "memory_type", "tags"] } } },
  { type: "function", function: { name: "search_memory", description: "Search persistent memory.", parameters: { type: "object", properties: { tags: { type: "array", items: { type: "string" } }, search_text: { type: "string" }, limit: { type: "number" } } } } },

  // ── Outreach & Email ──
  { type: "function", function: { name: "generate_outreach", description: "Generate outreach message (email, LinkedIn, WhatsApp, SMS).", parameters: { type: "object", properties: { channel: { type: "string" }, contact_name: { type: "string" }, contact_email: { type: "string" }, company_name: { type: "string" }, country_code: { type: "string" }, language: { type: "string" }, goal: { type: "string" }, quality: { type: "string" } }, required: ["channel", "contact_name", "company_name"] } } },
  { type: "function", function: { name: "send_email", description: "Send an email.", parameters: { type: "object", properties: { to_email: { type: "string" }, to_name: { type: "string" }, subject: { type: "string" }, html_body: { type: "string" }, partner_id: { type: "string" } }, required: ["to_email", "subject", "html_body"] } } },
  { type: "function", function: { name: "schedule_email", description: "Schedule an email to be sent at a specific date and time.", parameters: { type: "object", properties: { to_email: { type: "string" }, to_name: { type: "string" }, subject: { type: "string" }, html_body: { type: "string" }, partner_id: { type: "string" }, scheduled_at: { type: "string" } }, required: ["to_email", "subject", "html_body", "scheduled_at"] } } },
  { type: "function", function: { name: "queue_outreach", description: "Queue an outreach message to be sent automatically.", parameters: { type: "object", properties: { channel: { type: "string", enum: ["email", "linkedin", "whatsapp", "sms"] }, recipient_name: { type: "string" }, recipient_email: { type: "string" }, recipient_phone: { type: "string" }, partner_id: { type: "string" }, contact_id: { type: "string" }, subject: { type: "string" }, body: { type: "string" }, priority: { type: "number" } }, required: ["channel", "body"] } } },

  // ── Inbox & Conversations ──
  { type: "function", function: { name: "get_inbox", description: "Read incoming messages from channel_messages.", parameters: { type: "object", properties: { channel: { type: "string", enum: ["email", "whatsapp", "linkedin"] }, unread_only: { type: "boolean" }, partner_id: { type: "string" }, from_date: { type: "string" }, to_date: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_conversation_history", description: "Get unified timeline for a partner or contact.", parameters: { type: "object", properties: { partner_id: { type: "string" }, contact_id: { type: "string" }, company_name: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_email_thread", description: "Get an email thread for a partner or email address.", parameters: { type: "object", properties: { partner_id: { type: "string" }, email_address: { type: "string" }, thread_id: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_holding_pattern", description: "Get contacts in the holding pattern (contacted/in_progress).", parameters: { type: "object", properties: { source_type: { type: "string", enum: ["wca", "crm", "prospect", "all"] }, country_code: { type: "string" }, min_days_waiting: { type: "number" }, max_days_waiting: { type: "number" }, limit: { type: "number" } } } } },

  // ── Directory & Deep Search ──
  { type: "function", function: { name: "get_directory_status", description: "Directory scanning status for countries.", parameters: { type: "object", properties: { country_code: { type: "string" } } } } },
  { type: "function", function: { name: "deep_search_partner", description: "Deep Search a partner (logo, social, web info).", parameters: { type: "object", properties: { partner_id: { type: "string" }, company_name: { type: "string" }, force: { type: "boolean" } } } } },
  { type: "function", function: { name: "deep_search_contact", description: "Deep Search a contact (LinkedIn, social).", parameters: { type: "object", properties: { contact_id: { type: "string" }, contact_name: { type: "string" } } } } },

  // ── Business Cards ──
  { type: "function", function: { name: "search_business_cards", description: "Search business cards.", parameters: { type: "object", properties: { event_name: { type: "string" }, company_name: { type: "string" }, contact_name: { type: "string" }, match_status: { type: "string" }, limit: { type: "number" } } } } },

  // ── System ──
  { type: "function", function: { name: "get_global_summary", description: "High-level summary of the entire database.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "check_blacklist", description: "Search the blacklist for companies.", parameters: { type: "object", properties: { company_name: { type: "string" }, country: { type: "string" } } } } },
  { type: "function", function: { name: "get_operations_dashboard", description: "Get a complete real-time overview of all system operations.", parameters: { type: "object", properties: {} } } },

  // ── Contacts Management ──
  { type: "function", function: { name: "manage_partner_contact", description: "Add, update, or delete a contact person for a partner.", parameters: { type: "object", properties: { action: { type: "string", enum: ["add", "update", "delete"] }, contact_id: { type: "string" }, partner_id: { type: "string" }, company_name: { type: "string" }, name: { type: "string" }, title: { type: "string" }, email: { type: "string" }, direct_phone: { type: "string" }, mobile: { type: "string" }, is_primary: { type: "boolean" } }, required: ["action"] } } },

  // ── UI Actions ──
  { type: "function", function: { name: "execute_ui_action", description: "Execute a UI action: navigate to a page, show a toast notification, or apply filters.", parameters: { type: "object", properties: { action: { type: "string", enum: ["navigate", "toast", "filter"] }, target: { type: "string" }, params: { type: "object" } }, required: ["action", "target"] } } },

  // ── Agent Management ──
  { type: "function", function: { name: "create_agent_task", description: "Create a task for a subordinate agent.", parameters: { type: "object", properties: { agent_name: { type: "string" }, agent_role: { type: "string" }, task_type: { type: "string" }, description: { type: "string" }, target_filters: { type: "object" } }, required: ["description", "task_type"] } } },
  { type: "function", function: { name: "list_agent_tasks", description: "List tasks across all agents.", parameters: { type: "object", properties: { status: { type: "string" }, agent_name: { type: "string" }, limit: { type: "number" } } } } },
  { type: "function", function: { name: "get_team_status", description: "Get team overview: all agents with stats, active tasks, last activity.", parameters: { type: "object", properties: {} } } },

  // ── Work Plans ──
  { type: "function", function: { name: "create_work_plan", description: "Create a strategic work plan with multi-step objectives.", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, steps: { type: "array", items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" } } } }, tags: { type: "array", items: { type: "string" } } }, required: ["title", "steps"] } } },
  { type: "function", function: { name: "list_work_plans", description: "List work plans.", parameters: { type: "object", properties: { status: { type: "string", enum: ["draft", "active", "completed", "archived"] }, tag: { type: "string" }, limit: { type: "number" } } } } },

  // ── Aliases ──
  { type: "function", function: { name: "generate_aliases", description: "Generate aliases for partner companies or contacts.", parameters: { type: "object", properties: { partner_ids: { type: "array", items: { type: "string" } }, country_code: { type: "string" }, type: { type: "string" }, limit: { type: "number" } } } } },

  // ── Delete ──
  { type: "function", function: { name: "delete_records", description: "Delete records from the system.", parameters: { type: "object", properties: { table: { type: "string" }, ids: { type: "array", items: { type: "string" } } }, required: ["table", "ids"] } } },
];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOOL HANDLER (executes any platform tool)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function executePlatformTool(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string
): Promise<unknown> {
  switch (name) {
    // ── Partners ──
    case "search_partners": {
      const isCount = !!args.count_only;
      let query = supabase.from("partners").select(
        isCount ? "id" : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, raw_profile_html, is_favorite, office_type, lead_status",
        isCount ? { count: "exact", head: true } : undefined
      );
      if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
      if (args.search_name) query = query.ilike("company_name", `%${escapeLike(String(args.search_name))}%`);
      if (args.has_email === true) query = query.not("email", "is", null);
      if (args.has_profile === true) query = query.not("raw_profile_html", "is", null);
      if (args.has_profile === false) query = query.is("raw_profile_html", null);
      if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
      if (args.office_type) query = query.eq("office_type", args.office_type);
      if (args.is_favorite === true) query = query.eq("is_favorite", true);
      query = query.order("rating", { ascending: false, nullsFirst: false }).limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error, count } = await query;
      if (error) return { error: error.message };
      if (isCount) return { count };
      return { count: data?.length, partners: (data || []).map((p: { id: string; company_name: string; city: string; country_code: string; country_name: string; email: string | null; rating: number | null; raw_profile_html: string | null; lead_status: string | null }) => ({ id: p.id, company_name: p.company_name, city: p.city, country_code: p.country_code, country_name: p.country_name, email: p.email, rating: p.rating, has_profile: !!p.raw_profile_html, lead_status: p.lead_status })) };
    }

    case "get_partner_detail": {
      let partner: PartnerSummary | null = null;
      if (args.partner_id) { const { data } = await supabase.from("partners").select("*").eq("id", args.partner_id).single(); partner = data as PartnerSummary | null; }
      else if (args.company_name) { const { data } = await supabase.from("partners").select("*").ilike("company_name", `%${escapeLike(String(args.company_name))}%`).limit(1).single(); partner = data as PartnerSummary | null; }
      if (!partner) return { error: "Partner non trovato" };
      const [contactsRes, networksRes, servicesRes] = await Promise.all([
        supabase.from("partner_contacts").select("name, email, title, direct_phone, mobile, is_primary").eq("partner_id", partner.id),
        supabase.from("partner_networks").select("network_name, expires").eq("partner_id", partner.id),
        supabase.from("partner_services").select("service_category").eq("partner_id", partner.id),
      ]);
      return { id: partner.id, company_name: partner.company_name, city: partner.city, country_code: partner.country_code, email: partner.email, phone: partner.phone, website: partner.website, rating: partner.rating, lead_status: partner.lead_status, has_profile: !!partner.raw_profile_html, profile_summary: partner.raw_profile_markdown?.substring(0, 1500) || null, contacts: contactsRes.data || [], networks: networksRes.data || [], services: (servicesRes.data || []).map((s: ServiceRow) => s.service_category) };
    }

    case "get_country_overview": {
      const { data, error } = await supabase.rpc("get_country_stats");
      if (error) return { error: error.message };
      let stats = (data || []) as CountryStatRow[];
      if (args.country_code) stats = stats.filter((s) => s.country_code === String(args.country_code).toUpperCase());
      stats.sort((a, b) => (b.total_partners || 0) - (a.total_partners || 0));
      return { total_countries: stats.length, countries: stats.slice(0, Number(args.limit) || 30).map((s) => ({ country_code: s.country_code, total_partners: s.total_partners, with_profile: s.with_profile, without_profile: s.without_profile, with_email: s.with_email, with_phone: s.with_phone })) };
    }

    case "update_partner": {
      const partner = await resolvePartnerId(args);
      if (!partner) return { error: "Partner non trovato" };
      const updates: Record<string, unknown> = {};
      if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
      if (args.lead_status) updates.lead_status = args.lead_status;
      if (args.rating !== undefined) updates.rating = Math.min(5, Math.max(0, Number(args.rating)));
      if (args.company_alias) updates.company_alias = args.company_alias;
      if (Object.keys(updates).length === 0) return { error: "Nessun campo da aggiornare" };
      updates.updated_at = new Date().toISOString();
      const { error } = await supabase.from("partners").update(updates).eq("id", partner.id);
      if (error) return { error: error.message };
      return { success: true, partner: partner.name, message: `Partner "${partner.name}" aggiornato.` };
    }

    case "add_partner_note": {
      const partner = await resolvePartnerId(args);
      if (!partner) return { error: "Partner non trovato" };
      const { error } = await supabase.from("interactions").insert({ partner_id: partner.id, interaction_type: String(args.interaction_type || "note"), subject: String(args.subject), notes: args.notes ? String(args.notes) : null });
      if (error) return { error: error.message };
      return { success: true, message: `Nota aggiunta a "${partner.name}".` };
    }

    case "bulk_update_partners": {
      const updates: Record<string, unknown> = {};
      if (args.is_favorite !== undefined) updates.is_favorite = args.is_favorite;
      if (args.lead_status) updates.lead_status = args.lead_status;
      if (Object.keys(updates).length === 0) return { error: "Nessun aggiornamento" };
      updates.updated_at = new Date().toISOString();
      let query = supabase.from("partners").update(updates);
      if (args.partner_ids) query = query.in("id", args.partner_ids as string[]);
      else if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      else return { error: "Specifica country_code o partner_ids" };
      const { error } = await query;
      if (error) return { error: error.message };
      return { success: true, message: "Partner aggiornati." };
    }

    // ── Contacts ──
    case "search_contacts": {
      const isCount = !!args.count_only;
      let query = supabase.from("imported_contacts").select(isCount ? "id" : "id, name, company_name, email, phone, country, lead_status, created_at", isCount ? { count: "exact", head: true } : undefined);
      if (args.search_name) query = query.ilike("name", `%${escapeLike(String(args.search_name))}%`);
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
      if (args.country) query = query.ilike("country", `%${escapeLike(String(args.country))}%`);
      if (args.email) query = query.ilike("email", `%${escapeLike(String(args.email))}%`);
      if (args.origin) query = query.eq("origin", args.origin);
      if (args.lead_status) query = query.eq("lead_status", args.lead_status);
      if (args.has_email === true) query = query.not("email", "is", null);
      query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
      query = query.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error, count } = await query;
      if (error) return { error: error.message };
      if (isCount) return { count };
      return { count: data?.length || 0, contacts: data || [] };
    }

    case "get_contact_detail": {
      let contact: Record<string, unknown> | null = null;
      if (args.contact_id) { const { data } = await supabase.from("imported_contacts").select("*").eq("id", args.contact_id).single(); contact = data as Record<string, unknown> | null; }
      else if (args.contact_name) { const { data } = await supabase.from("imported_contacts").select("*").ilike("name", `%${escapeLike(String(args.contact_name))}%`).limit(1).single(); contact = data as Record<string, unknown> | null; }
      if (!contact) return { error: "Contatto non trovato" };
      return contact;
    }

    case "update_lead_status": {
      const status = String(args.status);
      if (args.contact_ids && Array.isArray(args.contact_ids)) {
        const { error } = await supabase.from("imported_contacts").update({ lead_status: status }).in("id", args.contact_ids as string[]);
        if (error) return { error: error.message };
        return { success: true, updated: (args.contact_ids as string[]).length };
      }
      return { error: "Specificare contact_ids" };
    }

    // ── Prospects ──
    case "search_prospects": {
      let query = supabase.from("prospects").select("id, company_name, city, province, codice_ateco, fatturato, email, lead_status");
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
      if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
      if (args.province) query = query.ilike("province", `%${escapeLike(String(args.province))}%`);
      if (args.lead_status) query = query.eq("lead_status", args.lead_status);
      if (args.min_fatturato) query = query.gte("fatturato", Number(args.min_fatturato));
      query = query.limit(Math.min(Number(args.limit) || 20, 50));
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, prospects: data || [] };
    }

    // ── Activities ──
    case "list_activities": {
      let query = supabase.from("activities").select("id, title, activity_type, status, priority, due_date, partner_id, source_meta, created_at").order("due_date", { ascending: true, nullsFirst: false }).limit(Number(args.limit) || 30);
      if (args.status) query = query.eq("status", args.status);
      if (args.activity_type) query = query.eq("activity_type", args.activity_type);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, activities: (data || []).map((a: { source_meta: Record<string, unknown> | null } & Record<string, unknown>) => ({ ...a, company_name: (a.source_meta as Record<string, unknown> | null)?.company_name || null })) };
    }

    case "create_activity": {
      let partnerId = args.partner_id as string | null;
      let companyName = args.company_name as string || "";
      if (!partnerId && companyName) { const r = await resolvePartnerId(args); if (r) { partnerId = r.id; companyName = r.name; } }
      const { data, error } = await supabase.from("activities").insert({
        title: String(args.title), description: args.description ? String(args.description) : null,
        activity_type: String(args.activity_type), source_type: "partner", source_id: partnerId || crypto.randomUUID(),
        partner_id: partnerId, due_date: args.due_date ? String(args.due_date) : null,
        priority: String(args.priority || "medium"), source_meta: { company_name: companyName } as Record<string, unknown>,
        user_id: userId,
      }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, activity_id: data.id, message: `Attività "${args.title}" creata.` };
    }

    case "update_activity": {
      const updates: Record<string, unknown> = {};
      if (args.status) { updates.status = args.status; if (args.status === "completed") updates.completed_at = new Date().toISOString(); }
      if (args.priority) updates.priority = args.priority;
      if (args.due_date) updates.due_date = args.due_date;
      const { error } = await supabase.from("activities").update(updates).eq("id", args.activity_id);
      if (error) return { error: error.message };
      return { success: true, message: "Attività aggiornata." };
    }

    // ── Reminders ──
    case "list_reminders": {
      let query = supabase.from("reminders").select("id, title, description, due_date, priority, status, partner_id").order("due_date", { ascending: true }).limit(30);
      if (args.status) query = query.eq("status", args.status);
      if (args.priority) query = query.eq("priority", args.priority);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, reminders: data || [] };
    }

    case "create_reminder": {
      const partner = await resolvePartnerId(args);
      if (!partner) return { error: "Partner non trovato" };
      const { error } = await supabase.from("reminders").insert({ partner_id: partner.id, title: String(args.title), description: args.description ? String(args.description) : null, due_date: String(args.due_date), priority: String(args.priority || "medium"), user_id: userId });
      if (error) return { error: error.message };
      return { success: true, message: `Reminder creato per "${partner.name}".` };
    }

    // ── Memory ──
    case "save_memory": {
      const { data, error } = await supabase.from("ai_memory").insert({ user_id: userId, content: String(args.content), memory_type: String(args.memory_type || "fact"), tags: (args.tags as string[]) || [], importance: Math.min(5, Math.max(1, Number(args.importance) || 3)) }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, memory_id: data.id };
    }

    case "search_memory": {
      let query = supabase.from("ai_memory").select("content, memory_type, tags, importance, created_at").eq("user_id", userId).order("importance", { ascending: false }).limit(Number(args.limit) || 10);
      if (args.tags && (args.tags as string[]).length > 0) query = query.overlaps("tags", args.tags as string[]);
      if (args.search_text) query = query.ilike("content", `%${escapeLike(String(args.search_text))}%`);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, memories: data || [] };
    }

    // ── Outreach & Email ──
    case "generate_outreach": {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-outreach`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(args),
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error || "Errore generazione" };
      return { success: true, channel: data.channel, subject: data.subject, body: data.body };
    }

    case "send_email": {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ to: args.to_email, toName: args.to_name, subject: args.subject, html: args.html_body }),
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error || "Errore invio" };
      if (args.partner_id) await supabase.from("interactions").insert({ partner_id: args.partner_id, interaction_type: "email", subject: String(args.subject), notes: `Inviata a ${args.to_email}` });
      return { success: true, message: `Email inviata a ${args.to_email}.` };
    }

    case "schedule_email": {
      const scheduledAt = String(args.scheduled_at);
       
      const { data, error } = await supabase.from("email_campaign_queue").insert({
        recipient_email: String(args.to_email), recipient_name: args.to_name ? String(args.to_name) : null,
        subject: String(args.subject), html_body: String(args.html_body),
        partner_id: args.partner_id ? String(args.partner_id) : "00000000-0000-0000-0000-000000000000",
        scheduled_at: scheduledAt, status: "pending", user_id: userId,
      } as Record<string, unknown>).select("id").single();
      if (error) return { error: error.message };
      return { success: true, queue_id: data.id, scheduled_at: scheduledAt, message: `Email programmata per ${scheduledAt}.` };
    }

    case "queue_outreach": {
      const channel = String(args.channel || "email");
      const body = String(args.body || "");
      if (!body) return { error: "body è obbligatorio" };
      const { data, error } = await supabase.from("outreach_queue").insert({
        user_id: userId, channel, recipient_name: args.recipient_name ? String(args.recipient_name) : null,
        recipient_email: args.recipient_email ? String(args.recipient_email) : null,
        partner_id: args.partner_id ? String(args.partner_id) : null,
        contact_id: args.contact_id ? String(args.contact_id) : null,
        subject: args.subject ? String(args.subject) : null,
        body, priority: Number(args.priority) || 0, created_by: "agent",
      }).select("id, channel, recipient_name, status").single();
      if (error) return { error: error.message };
      return { success: true, queue_id: data.id, channel: data.channel, message: `Messaggio ${channel} accodato.` };
    }

    // ── Inbox & Conversations ──
    case "get_inbox": {
      let query = supabase.from("channel_messages").select("id, channel, direction, from_address, to_address, subject, body_text, email_date, read_at, partner_id, category, created_at")
        .eq("user_id", userId).eq("direction", "inbound").order("email_date", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
      if (args.channel) query = query.eq("channel", args.channel);
      if (args.unread_only) query = query.is("read_at", null);
      if (args.partner_id) query = query.eq("partner_id", args.partner_id);
      if (args.from_date) query = query.gte("email_date", args.from_date);
      if (args.to_date) query = query.lte("email_date", args.to_date);
      const { data, error } = await query;
      if (error) return { error: error.message };
      return { count: data?.length || 0, messages: (data || []).map((m: ChannelMessageRow) => ({ id: m.id, channel: m.channel, from: m.from_address, subject: m.subject, preview: m.body_text?.substring(0, 300) || "", date: m.email_date, read: !!m.read_at, partner_id: m.partner_id, category: m.category })) };
    }

    case "get_conversation_history": {
      let pid = args.partner_id as string;
      if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
      const timeline: { type: string; direction?: string; subject?: string; from?: string; date: string; preview?: string; subtype?: string; title?: string; status?: string; notes?: string }[] = [];
      if (pid) {
        const { data: emails } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel")
          .eq("user_id", userId).or(`partner_id.eq.${pid}`).order("email_date", { ascending: false }).limit(30);
        (emails || []).forEach((e: ChannelMessageRow) => timeline.push({ type: "email", direction: e.direction, subject: e.subject ?? undefined, from: e.from_address ?? undefined, date: e.email_date || e.created_at, preview: e.body_text?.substring(0, 200) }));
        const { data: acts } = await supabase.from("activities").select("id, title, activity_type, status, created_at, description")
          .or(`partner_id.eq.${pid},source_id.eq.${pid}`).order("created_at", { ascending: false }).limit(30);
        (acts || []).forEach((a: { activity_type: string; title: string; status: string; created_at: string }) => timeline.push({ type: "activity", subtype: a.activity_type, title: a.title, status: a.status, date: a.created_at }));
        const { data: ints } = await supabase.from("interactions").select("id, interaction_type, subject, notes, created_at")
          .eq("partner_id", pid).order("created_at", { ascending: false }).limit(30);
        (ints || []).forEach((i: { interaction_type: string; subject: string; created_at: string }) => timeline.push({ type: "interaction", subtype: i.interaction_type, title: i.subject, date: i.created_at }));
      }
      timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return { count: timeline.length, timeline: timeline.slice(0, Number(args.limit) || 50) };
    }

    case "get_email_thread": {
      let messages: ChannelMessageRow[] = [];
      if (args.thread_id) {
        const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date")
          .eq("user_id", userId).eq("thread_id", args.thread_id).order("email_date", { ascending: true });
        messages = (data || []) as ChannelMessageRow[];
      }
      if (messages.length === 0 && args.partner_id) {
        const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date")
          .eq("user_id", userId).eq("partner_id", args.partner_id).eq("channel", "email").order("email_date", { ascending: true }).limit(Number(args.limit) || 50);
        messages = (data || []) as ChannelMessageRow[];
      }
      if (messages.length === 0 && args.email_address) {
        const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date")
          .eq("user_id", userId).eq("channel", "email").or(`from_address.ilike.%${args.email_address}%,to_address.ilike.%${args.email_address}%`)
          .order("email_date", { ascending: true }).limit(Number(args.limit) || 50);
        messages = (data || []) as ChannelMessageRow[];
      }
      return { count: messages.length, thread: messages.map((m) => ({ id: m.id, direction: m.direction, from: m.from_address, to: m.to_address, subject: m.subject, preview: m.body_text?.substring(0, 500), date: m.email_date })) };
    }

    case "get_holding_pattern": {
      const items: HoldingItem[] = [];
      const activeStatuses = ["contacted", "in_progress"];
      const now = new Date();
      if (!args.source_type || args.source_type === "wca" || args.source_type === "all") {
        let pq = supabase.from("partners").select("id, company_name, country_code, city, email, lead_status, last_interaction_at, interaction_count")
          .in("lead_status", activeStatuses).order("last_interaction_at", { ascending: true, nullsFirst: true });
        if (args.country_code) pq = pq.eq("country_code", String(args.country_code).toUpperCase());
        const { data: partners } = await pq.limit(Number(args.limit) || 50);
        (partners || []).forEach((p: { id: string; company_name: string; country_code: string; city: string; email: string | null; lead_status: string; last_interaction_at: string | null; interaction_count: number }) => {
          const days = p.last_interaction_at ? Math.floor((now.getTime() - new Date(p.last_interaction_at).getTime()) / 86400000) : 999;
          if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
          if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
          items.push({ id: p.id, source: "wca", name: p.company_name, country: p.country_code, city: p.city, email: p.email, status: p.lead_status, days_waiting: days, interactions: p.interaction_count });
        });
      }
      if (!args.source_type || args.source_type === "crm" || args.source_type === "all") {
        const cq = supabase.from("imported_contacts").select("id, name, company_name, country, city, email, lead_status, last_interaction_at, interaction_count")
          .in("lead_status", activeStatuses).order("last_interaction_at", { ascending: true, nullsFirst: true });
        const { data: contacts } = await cq.limit(Number(args.limit) || 50);
        (contacts || []).forEach((c: { id: string; name: string; company_name: string; country: string; city: string; email: string | null; lead_status: string; last_interaction_at: string | null; interaction_count: number }) => {
          const days = c.last_interaction_at ? Math.floor((now.getTime() - new Date(c.last_interaction_at).getTime()) / 86400000) : 999;
          if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
          if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
          items.push({ id: c.id, source: "crm", name: c.company_name || c.name || "—", country: c.country, email: c.email, status: c.lead_status, days_waiting: days });
        });
      }
      items.sort((a, b) => b.days_waiting - a.days_waiting);
      return { count: items.length, items: items.slice(0, Number(args.limit) || 50) };
    }

    // ── Directory & Deep Search ──
    case "get_directory_status": {
      const { data: dirData } = await supabase.rpc("get_directory_counts");
      const { data: statsData } = await supabase.rpc("get_country_stats");
      const dirMap: Record<string, number> = {};
      for (const r of (dirData || []) as DirectoryCountRow[]) dirMap[r.country_code] = Number(r.member_count);
      const statsMap: Record<string, CountryStatRow> = {};
      for (const r of (statsData || []) as CountryStatRow[]) statsMap[r.country_code] = r;
      if (args.country_code) {
        const code = String(args.country_code).toUpperCase();
        return { country_code: code, directory_members: dirMap[code] || 0, db_partners: statsMap[code]?.total_partners || 0, gap: (dirMap[code] || 0) - (statsMap[code]?.total_partners || 0) };
      }
      const allCodes = [...new Set([...Object.keys(dirMap), ...Object.keys(statsMap)])];
      const gaps = allCodes.map(c => ({ country_code: c, dir: dirMap[c] || 0, db: statsMap[c]?.total_partners || 0, gap: (dirMap[c] || 0) - (statsMap[c]?.total_partners || 0) })).filter(r => r.gap > 0).sort((a, b) => b.gap - a.gap);
      return { countries_with_gaps: gaps.length, gaps: gaps.slice(0, 30) };
    }

    case "deep_search_partner": {
      let pid = args.partner_id as string;
      if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
      if (!pid) return { error: "Partner non trovato" };
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-partner`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ partner_id: pid, force: !!args.force }),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "deep_search_contact": {
      let cid = args.contact_id as string;
      if (!cid && args.contact_name) { const { data } = await supabase.from("imported_contacts").select("id").ilike("name", `%${escapeLike(String(args.contact_name))}%`).limit(1).single(); if (data) cid = data.id; }
      if (!cid) return { error: "Contatto non trovato" };
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/deep-search-contact`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ contact_id: cid }),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    // ── Business Cards ──
    case "search_business_cards": {
      let query = supabase.from("business_cards").select("id, company_name, contact_name, email, event_name, match_status, created_at").order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
      if (args.event_name) query = query.ilike("event_name", `%${escapeLike(String(args.event_name))}%`);
      const { data, error } = await query;
      return error ? { error: error.message } : { count: data?.length || 0, cards: data || [] };
    }

    // ── System ──
    case "get_global_summary": {
      const [statsRes, dirRes, jobsRes] = await Promise.all([
        supabase.rpc("get_country_stats"), supabase.rpc("get_directory_counts"),
        supabase.from("download_jobs").select("id, status").in("status", ["running", "pending"]),
      ]);
      const rows = (statsRes.data || []) as CountryStatRow[];
      const totals = rows.reduce((acc: { partners: number; with_profile: number; with_email: number }, r: CountryStatRow) => ({ partners: acc.partners + (Number(r.total_partners) || 0), with_profile: acc.with_profile + (Number(r.with_profile) || 0), with_email: acc.with_email + (Number(r.with_email) || 0) }), { partners: 0, with_profile: 0, with_email: 0 });
      const dirTotal = ((dirRes.data || []) as DirectoryCountRow[]).reduce((s: number, r: DirectoryCountRow) => s + (Number(r.member_count) || 0), 0);
      return { total_countries: rows.length, total_partners: totals.partners, with_profile: totals.with_profile, with_email: totals.with_email, directory_members: dirTotal, active_jobs: jobsRes.data?.length || 0 };
    }

    case "check_blacklist": {
      let query = supabase.from("blacklist_entries").select("company_name, country, total_owed_amount, claims, status");
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
      if (args.country) query = query.ilike("country", `%${escapeLike(String(args.country))}%`);
      const { data, error } = await query.limit(20);
      if (error) return { error: error.message };
      return { count: data?.length || 0, entries: data || [] };
    }

    case "get_operations_dashboard": {
      const [dlJobs, emailQ, agTasks, acts] = await Promise.all([
        supabase.from("download_jobs").select("id, country_name, status, current_index, total_count, contacts_found_count, error_message, created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("email_campaign_queue").select("id, status, scheduled_at, sent_at, recipient_email, subject").order("created_at", { ascending: false }).limit(20),
        supabase.from("agent_tasks").select("id, agent_id, description, status, task_type, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
        supabase.from("activities").select("id, title, status, activity_type, scheduled_at, due_date").neq("status", "cancelled").order("created_at", { ascending: false }).limit(15),
      ]);
      return {
        downloads: { active: (dlJobs.data || []).filter((j: DownloadJobRow) => ["running", "pending"].includes(j.status)).length, jobs: (dlJobs.data || []).map((j: DownloadJobRow) => ({ id: j.id, country: j.country_name, status: j.status, progress: `${j.current_index}/${j.total_count}` })) },
        emails: { pending: (emailQ.data || []).filter((e: EmailQueueRow) => e.status === "pending").length, sent: (emailQ.data || []).filter((e: EmailQueueRow) => e.status === "sent").length },
        agent_tasks: { running: (agTasks.data || []).filter((t: AgentTaskRow) => ["pending", "running"].includes(t.status)).length, recent: (agTasks.data || []).slice(0, 8) },
        activities: { pending: (acts.data || []).filter((a: ActivityRow) => a.status === "pending").length, recent: (acts.data || []).slice(0, 8) },
      };
    }

    // ── Contact Management ──
    case "manage_partner_contact": {
      const action = String(args.action);
      if (action === "delete" && args.contact_id) {
        const { error } = await supabase.from("partner_contacts").delete().eq("id", args.contact_id);
        return error ? { error: error.message } : { success: true, message: "Contatto eliminato." };
      }
      if (action === "update" && args.contact_id) {
        const updates: Record<string, unknown> = {};
        if (args.name) updates.name = args.name;
        if (args.title) updates.title = args.title;
        if (args.email) updates.email = args.email;
        if (args.direct_phone) updates.direct_phone = args.direct_phone;
        if (args.mobile) updates.mobile = args.mobile;
        const { error } = await supabase.from("partner_contacts").update(updates).eq("id", args.contact_id);
        return error ? { error: error.message } : { success: true, message: "Contatto aggiornato." };
      }
      if (action === "add") {
        let pid = args.partner_id as string;
        if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
        if (!pid) return { error: "Partner non trovato" };
        const { error } = await supabase.from("partner_contacts").insert({ partner_id: pid, name: String(args.name), title: args.title ? String(args.title) : null, email: args.email ? String(args.email) : null });
        return error ? { error: error.message } : { success: true, message: `Contatto "${args.name}" aggiunto.` };
      }
      return { error: "Azione non valida" };
    }

    // ── UI Actions ──
    case "execute_ui_action": {
      const action = String(args.action || "toast");
      const target = String(args.target || "");
      return { success: true, ui_action: { action, target, params: args.params || {} } };
    }

    // ── Agent Management ──
    case "create_agent_task": {
      let agentQuery = supabase.from("agents").select("id, name").eq("user_id", userId);
      if (args.agent_name) agentQuery = agentQuery.ilike("name", `%${escapeLike(String(args.agent_name))}%`);
      else if (args.agent_role) agentQuery = agentQuery.eq("role", args.agent_role);
      const { data: agents } = await agentQuery.limit(1);
      if (!agents || agents.length === 0) return { error: `Agente non trovato.` };
      const targetAgent = agents[0];
      const { data, error } = await supabase.from("agent_tasks").insert({
        agent_id: targetAgent.id, user_id: userId, task_type: String(args.task_type || "research"),
        description: String(args.description), target_filters: (args.target_filters || {}) as Record<string, unknown>,
      }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, task_id: data.id, agent_name: targetAgent.name, message: `Task creato per ${targetAgent.name}.` };
    }

    case "list_agent_tasks": {
      let query = supabase.from("agent_tasks").select("id, agent_id, task_type, description, status, result_summary, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(Number(args.limit) || 30);
      if (args.status) query = query.eq("status", args.status);
      const { data: tasks, error } = await query;
      if (error) return { error: error.message };
      const agentIds = [...new Set((tasks || []).map((t: AgentTaskRow) => t.agent_id))];
      const { data: agentsData } = await supabase.from("agents").select("id, name").in("id", agentIds);
      const nameMap: Record<string, string> = {};
      for (const a of (agentsData || []) as { id: string; name: string }[]) nameMap[a.id] = a.name;
      let results = (tasks || []).map((t: AgentTaskRow) => ({ ...t, agent_name: nameMap[t.agent_id] || "?" }));
      if (args.agent_name) results = results.filter((t) => t.agent_name.toLowerCase().includes(String(args.agent_name).toLowerCase()));
      return { count: results.length, tasks: results };
    }

    case "get_team_status": {
      const { data: agents } = await supabase.from("agents").select("id, name, role, is_active, stats, avatar_emoji, updated_at").eq("user_id", userId).order("name");
      if (!agents) return { error: "Nessun agente trovato" };
      const agentIds = agents.map((a: AgentRow) => a.id);
      const { data: tasks } = await supabase.from("agent_tasks").select("agent_id, status").in("agent_id", agentIds);
      const taskStats: Record<string, { pending: number; running: number; completed: number; failed: number }> = {};
      for (const t of (tasks || []) as { agent_id: string; status: string }[]) {
        if (!taskStats[t.agent_id]) taskStats[t.agent_id] = { pending: 0, running: 0, completed: 0, failed: 0 };
        if (taskStats[t.agent_id][t.status as keyof typeof taskStats[string]] !== undefined) taskStats[t.agent_id][t.status as keyof typeof taskStats[string]]++;
      }
      return {
        team_size: agents.length, active_agents: agents.filter((a: AgentRow) => a.is_active).length,
        agents: agents.map((a: AgentRow) => ({ name: a.name, role: a.role, emoji: a.avatar_emoji, is_active: a.is_active, stats: a.stats, tasks: taskStats[a.id] || { pending: 0, running: 0, completed: 0, failed: 0 }, last_activity: a.updated_at })),
      };
    }

    // ── Work Plans ──
    case "create_work_plan": {
      const rawSteps = (args.steps as WorkPlanStep[] || []).map((s: WorkPlanStep, i: number) => ({ index: i, title: s.title || `Step ${i + 1}`, description: s.description || "", status: "pending" }));
      const { data, error } = await supabase.from("ai_work_plans").insert({
        user_id: userId, title: String(args.title), description: String(args.description || ""),
        steps: rawSteps as unknown as Record<string, unknown>[], status: "active", tags: (args.tags || []) as string[],
      }).select("id, title").single();
      if (error) return { error: error.message };
      return { success: true, plan_id: data.id, title: data.title, total_steps: rawSteps.length };
    }

    case "list_work_plans": {
      let query = supabase.from("ai_work_plans").select("id, title, description, status, current_step, steps, tags, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      const plans = (data || []).map((p: { id: string; title: string; description: string | null; status: string; current_step: number; steps: unknown; tags: string[]; created_at: string }) => ({ ...p, total_steps: Array.isArray(p.steps) ? p.steps.length : 0, completed_steps: Array.isArray(p.steps) ? (p.steps as WorkPlanStep[]).filter((s) => s.status === "completed").length : 0 }));
      return { count: plans.length, plans };
    }

    // ── Aliases ──
    case "generate_aliases": {
      const body: Record<string, unknown> = { type: args.type || "company", limit: Number(args.limit) || 20 };
      if (args.partner_ids) body.partner_ids = args.partner_ids;
      if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-aliases`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(body),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    // ── Delete ──
    case "delete_records": {
      const table = String(args.table);
      const ids = args.ids as string[];
      const valid = ["partners", "prospects", "activities", "reminders"];
      if (!valid.includes(table)) return { error: `Tabella non valida: ${table}` };

      const { error } = await supabase.from(table as "partners").delete().eq("user_id", userId).in("id", ids);
      return error ? { error: error.message } : { success: true, deleted: ids.length };
    }

    default:
      return { error: `Tool sconosciuto: ${name}` };
  }
}
