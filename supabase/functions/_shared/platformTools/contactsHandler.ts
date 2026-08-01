/**
 * contactsHandler.ts - Contact/CRM-related tool handlers
 * Handles: search, detail, lead status updates.
 *
 * REWRITE 2026-04-29: handleGetContactDetail aggrega ora interactions,
 * channel_messages, business_card collegato, partner collegato, outreach_queue,
 * calendar_events, agent_tasks, notifications, blacklist. Distingue contatti
 * MANUALI (origin='manual') e mostra esplicitamente note dell'operatore.
 * handleSearchContacts esteso con paginazione, sort, filtri completi.
 */

import { supabase, escapeLike } from "./supabaseClient.ts";
import { applyLeadStatusChange } from "../leadStatusGuard.ts";

export async function handleSearchContacts(
  args: Record<string, unknown>
): Promise<unknown> {
  const isCount = !!args.count_only;
  const cols = isCount
    ? "id"
    : "id, name, company_name, email, phone, mobile, country, city, position, lead_status, lead_score, origin, note, company_alias, contact_alias, last_interaction_at, interaction_count, deep_search_at, created_at";
  let query = supabase
    .from("imported_contacts")
    .select(cols, isCount ? { count: "exact", head: true } : undefined);
  if (args.search_name)
    query = query.ilike("name", `%${escapeLike(String(args.search_name))}%`);
  if (args.company_name)
    query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
  if (args.country) query = query.ilike("country", `%${escapeLike(String(args.country))}%`);
  if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
  if (args.email) query = query.ilike("email", `%${escapeLike(String(args.email))}%`);
  if (args.origin) query = query.eq("origin", args.origin);
  if (args.only_manual === true) query = query.eq("origin", "manual");
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  if (Array.isArray(args.lead_statuses) && (args.lead_statuses as string[]).length) {
    query = query.in("lead_status", args.lead_statuses as string[]);
  }
  if (args.has_email === true) query = query.not("email", "is", null);
  if (args.has_email === false) query = query.is("email", null);
  if (args.has_phone === true) query = query.or("phone.not.is.null,mobile.not.is.null");
  if (args.has_deep_search === true) query = query.not("deep_search_at", "is", null);
  if (args.has_deep_search === false) query = query.is("deep_search_at", null);
  if (args.has_alias === true) query = query.not("company_alias", "is", null);
  if (args.holding_pattern === "out") query = query.eq("interaction_count", 0);
  if (args.holding_pattern === "in") query = query.gt("interaction_count", 0);
  if (args.import_log_id) query = query.eq("import_log_id", args.import_log_id);
  if (args.date_from) query = query.gte("created_at", args.date_from);
  if (args.date_to) query = query.lte("created_at", args.date_to);
  // Soft-delete safety (in addition to RESTRICTIVE RLS)
  query = query.is("deleted_at", null);
  query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");

  // Sort
  const sortMap: Record<string, { col: string; asc: boolean }> = {
    recent: { col: "created_at", asc: false },
    name_asc: { col: "name", asc: true },
    name_desc: { col: "name", asc: false },
    company_asc: { col: "company_name", asc: true },
    company_desc: { col: "company_name", asc: false },
    score_desc: { col: "lead_score", asc: false },
    last_interaction: { col: "last_interaction_at", asc: false },
  };
  const sort = sortMap[String(args.sort || "recent")] ?? sortMap.recent;
  query = query.order(sort.col, { ascending: sort.asc, nullsFirst: false });

  // Pagination
  const limit = Math.min(Number(args.limit) || 20, 100);
  const page = Math.max(Number(args.page) || 1, 1);
  const from = (page - 1) * limit;
  query = query.range(from, from + limit - 1);

  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };
  return { count: data?.length || 0, page, page_size: limit, contacts: data || [] };
}

export async function handleGetContactDetail(
  args: Record<string, unknown>
): Promise<unknown> {
  let contact: Record<string, unknown> | null = null;
  if (args.contact_id) {
    const { data } = await supabase
      .from("imported_contacts")
      .select("*")
      .eq("id", args.contact_id as string)
      .maybeSingle();
    contact = data as Record<string, unknown> | null;
  } else if (args.contact_name) {
    const { data } = await supabase
      .from("imported_contacts")
      .select("*")
      .ilike("name", `%${escapeLike(String(args.contact_name))}%`)
      .limit(1)
      .maybeSingle();
    contact = data as Record<string, unknown> | null;
  } else if (args.email) {
    const { data } = await supabase
      .from("imported_contacts")
      .select("*")
      .ilike("email", `%${escapeLike(String(args.email))}%`)
      .limit(1)
      .maybeSingle();
    contact = data as Record<string, unknown> | null;
  }
  if (!contact) return { error: "Contatto non trovato" };

  const contactId = String(contact.id);
  const contactEmail = String(contact.email || "").toLowerCase().trim();
  const transferredPartnerId = (contact.transferred_to_partner_id as string) || null;

  const [
    interactionsRes,
    bcaRes,
    partnerRes,
    messagesRes,
    queueRes,
    eventsRes,
    tasksRes,
    notificationsRes,
    blacklistRes,
  ] = await Promise.all([
    supabase
      .from("contact_interactions")
      .select("id, interaction_type, title, description, outcome, created_at, created_by")
      .eq("contact_id", contactId)
      .order("created_at", { ascending: false })
      .limit(20),
    contactEmail
      ? supabase
          .from("business_cards")
          .select("id, contact_name, company_name, event_name, met_at, match_status, ocr_confidence, notes")
          .ilike("email", contactEmail)
          .is("deleted_at", null)
          .limit(5)
      : Promise.resolve({ data: [] }),
    transferredPartnerId
      ? supabase
          .from("partners")
          .select("id, company_name, country_code, city, rating, lead_status, member_since, membership_expires")
          .eq("id", transferredPartnerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    contactEmail
      ? supabase
          .from("channel_messages")
          .select("id, channel, direction, subject, from_address, to_address, email_date, category")
          .or(`from_address.ilike.%${contactEmail}%,to_address.ilike.%${contactEmail}%`)
          .is("deleted_at", null)
          .order("email_date", { ascending: false })
          .limit(10)
      : Promise.resolve({ data: [] }),
    supabase
      .from("outreach_queue")
      .select("id, channel, status, subject, recipient_email, created_at, processed_at, attempts, last_error")
      .eq("contact_id", contactId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("calendar_events")
      .select("id, title, event_type, start_at, end_at, status")
      .eq("contact_id", contactId)
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(5),
    supabase
      .from("agent_tasks")
      .select("id, agent_id, task_type, status, scheduled_at, completed_at, result_summary")
      .contains("target_filters", { contact_id: contactId })
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("notifications")
      .select("id, title, body, type, priority, read, created_at")
      .eq("entity_type", "contact")
      .eq("entity_id", contactId)
      .order("created_at", { ascending: false })
      .limit(5),
    contactEmail
      ? supabase
          .from("blacklist")
          .select("email, domain, reason")
          .or(`email.eq.${contactEmail},domain.eq.${contactEmail.split("@")[1] || ""}`)
      : Promise.resolve({ data: [] }),
  ]);

  // Holding pattern computation
  const lastInteraction = contact.last_interaction_at as string | null;
  const interactionCount = (contact.interaction_count as number) || 0;
  const daysSinceLast = lastInteraction
    ? Math.floor((Date.now() - new Date(lastInteraction).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const holdingState = interactionCount === 0 ? "out" : "in";

  const origin = (contact.origin as string) || null;
  const isManual = origin === "manual" || origin === "manual_entry";

  return {
    // Core identity
    id: contact.id,
    name: contact.name,
    company_name: contact.company_name,
    email: contact.email,
    phone: contact.phone,
    mobile: contact.mobile,
    country: contact.country,
    city: contact.city,
    address: contact.address,
    zip_code: contact.zip_code,
    position: contact.position,
    company_alias: contact.company_alias,
    contact_alias: contact.contact_alias,

    // Origin / provenance — IMPORTANTE: contatti manuali sono lavoro umano prezioso
    origin,
    is_manual: isManual,
    note: contact.note,
    external_id: contact.external_id,
    import_log_id: contact.import_log_id,

    // Pipeline state
    lead_status: contact.lead_status,
    status_reason: contact.status_reason,
    lead_score: contact.lead_score,
    lead_score_breakdown: contact.lead_score_breakdown,
    lead_score_updated_at: contact.lead_score_updated_at,
    email_status: contact.email_status,
    is_transferred: contact.is_transferred,
    transferred_to_partner_id: transferredPartnerId,
    transferred_at: contact.transferred_at,

    // Activity & holding pattern
    interaction_count: interactionCount,
    last_interaction_at: lastInteraction,
    days_since_last_interaction: daysSinceLast,
    holding_pattern_state: holdingState,

    // Enrichment / deep search
    deep_search_at: contact.deep_search_at,
    enrichment_data: contact.enrichment_data,

    // WCA matching
    wca_partner_id: contact.wca_partner_id,
    wca_match_confidence: contact.wca_match_confidence,
    matched_partner: partnerRes.data || null,

    // Cross-entity aggregations
    business_cards: bcaRes.data || [],
    interactions_timeline: interactionsRes.data || [],
    recent_messages: messagesRes.data || [],
    outreach_queue: queueRes.data || [],
    upcoming_events: eventsRes.data || [],
    agent_tasks: tasksRes.data || [],
    recent_notifications: notificationsRes.data || [],

    blacklist_hit: (blacklistRes.data || []).length > 0,
    blacklist_entries: blacklistRes.data || [],

    created_at: contact.created_at,
  };
}

export async function handleUpdateLeadStatus(
  args: Record<string, unknown>,
  userId?: string
): Promise<unknown> {
  const status = String(args.status);
  if (args.contact_ids && Array.isArray(args.contact_ids)) {
    const contactIds = args.contact_ids as string[];
    let successCount = 0;
    let lastError: string | null = null;

    for (const contactId of contactIds) {
      const result = await applyLeadStatusChange(supabase, {
        table: "imported_contacts",
        recordId: contactId,
        newStatus: status,
        userId: userId || "unknown",
        actor: { type: "ai_agent", name: "platform-tools" },
        decisionOrigin: "ai_auto",
        trigger: "platform_tool_update",
      });

      if (!result.applied) {
        lastError = result.blockedReason || "Failed to update lead status";
      } else {
        successCount++;
      }
    }

    if (successCount === 0) {
      return { error: lastError || "Failed to update lead status" };
    }
    return { success: true, updated: successCount };
  }
  return { error: "Specificare contact_ids" };
}
