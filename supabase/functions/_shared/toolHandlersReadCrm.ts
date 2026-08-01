/**
 * Read handler: dominio CRM (contatti, prospect, attività, reminder).
 * Estratto da `toolHandlersRead.ts` (stessi handler, stessa firma, stesso comportamento).
 */

import { escapeLike } from "./sqlEscape.ts";

// Permissive client type — vedi toolHandlersRead.ts
// deno-lint-ignore no-explicit-any
type SupabaseClient = import("./supabaseClient.ts").AnySupabaseClient;

export function createCrmReadHandlers(supabase: SupabaseClient) {

  async function executeCheckBlacklist(args: Record<string, unknown>) {
    let query = supabase.from("blacklist_entries").select("company_name, country, city, total_owed_amount, claims, status, blacklist_no, matched_partner_id");
    if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
    if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);
    query = query.order("total_owed_amount", { ascending: false, nullsFirst: false }).limit(20);
    const { data, error } = await query;
    if (error) return { error: error.message };
    return {
      count: data?.length || 0,
      entries: (data || []).map((b: Record<string, unknown>) => ({
        company: b.company_name, country: b.country, city: b.city, owed: b.total_owed_amount,
        claims: b.claims, status: b.status, has_matched_partner: !!b.matched_partner_id,
      })),
    };
  }

  async function executeListReminders(args: Record<string, unknown>, userId?: string) {
    let query = supabase.from("reminders").select("id, title, description, due_date, priority, status, partner_id, created_at")
      .order("due_date", { ascending: true }).limit(30);
    if (userId) query = query.eq("user_id", userId);
    if (args.status) query = query.eq("status", args.status);
    if (args.priority) query = query.eq("priority", args.priority);
    const { data, error } = await query;
    if (error) return { error: error.message };
    const partnerIds = [...new Set((data || []).map((r: { partner_id: string }) => r.partner_id))] as string[];
    let pq = supabase.from("partners").select("id, company_name").in("id", partnerIds);
    if (userId) pq = pq.eq("user_id", userId);
    const { data: partners } = await pq;
    const nameMap: Record<string, string> = {};
    for (const p of (partners || []) as Array<{ id: string; company_name: string }>) nameMap[p.id] = p.company_name;
    let results: Array<Record<string, unknown> & { partner: string }> = (data || []).map((r: Record<string, unknown>) => ({
      id: r.id, title: r.title, description: r.description, due_date: r.due_date,
      priority: r.priority, status: r.status, partner: nameMap[r.partner_id as string] || "Sconosciuto",
    }));
    if (args.partner_name) {
      const search = String(args.partner_name).toLowerCase();
      results = results.filter((r) => r.partner.toLowerCase().includes(search));
    }
    return { count: results.length, reminders: results };
  }

  async function executeSearchContacts(args: Record<string, unknown>, userId?: string) {
    const isCount = !!args.count_only;
    let query = supabase.from("imported_contacts").select(
      isCount ? "id" : "id, name, company_name, email, phone, mobile, country, city, origin, lead_status, position, deep_search_at, company_alias, contact_alias, created_at",
      isCount ? { count: "exact", head: true } : undefined
    );
    if (userId) query = query.eq("user_id", userId);
    if (args.search_name) query = query.ilike("name", `%${escapeLike(args.search_name)}%`);
    if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
    if (args.country) query = query.ilike("country", `%${escapeLike(args.country)}%`);
    if (args.email) query = query.ilike("email", `%${escapeLike(args.email)}%`);
    if (args.origin) query = query.ilike("origin", `%${escapeLike(args.origin)}%`);
    if (args.lead_status) query = query.eq("lead_status", args.lead_status);
    if (args.has_email === true) query = query.not("email", "is", null);
    if (args.has_email === false) query = query.is("email", null);
    if (args.has_phone === true) query = query.or("phone.not.is.null,mobile.not.is.null");
    query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
    query = query.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
    const { data, error, count } = await query;
    if (error) return { error: error.message };
    if (isCount) return { count };
    return { count: data?.length || 0, contacts: data || [] };
  }

  async function executeGetContactDetail(args: Record<string, unknown>, userId?: string) {
    let contact: Record<string, unknown> | null = null;
    if (args.contact_id) {
      let q = supabase.from("imported_contacts").select("*").eq("id", args.contact_id);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q.maybeSingle();
      contact = data;
    } else if (args.contact_name) {
      let q = supabase.from("imported_contacts").select("*").ilike("name", `%${escapeLike(args.contact_name)}%`);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q.limit(1).maybeSingle();
      contact = data;
    }
    if (!contact) return { error: "Contatto non trovato" };
    const { data: interactions } = await supabase.from("contact_interactions").select("*").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(10);
    return { ...contact, interactions: interactions || [] };
  }

  async function executeSearchProspects(args: Record<string, unknown>, userId?: string) {
    const isCount = !!args.count_only;
    let query = supabase.from("prospects").select(
      isCount ? "id" : "id, company_name, city, province, region, codice_ateco, descrizione_ateco, fatturato, dipendenti, email, phone, pec, website, lead_status, partita_iva, forma_giuridica, rating_affidabilita, created_at",
      isCount ? { count: "exact", head: true } : undefined
    );
    if (userId) query = query.eq("user_id", userId);
    if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
    if (args.city) query = query.ilike("city", `%${escapeLike(args.city)}%`);
    if (args.province) query = query.ilike("province", `%${escapeLike(args.province)}%`);
    if (args.region) query = query.ilike("region", `%${escapeLike(args.region)}%`);
    if (args.codice_ateco) query = query.ilike("codice_ateco", `%${escapeLike(args.codice_ateco)}%`);
    if (args.min_fatturato) query = query.gte("fatturato", Number(args.min_fatturato));
    if (args.max_fatturato) query = query.lte("fatturato", Number(args.max_fatturato));
    if (args.lead_status) query = query.eq("lead_status", args.lead_status);
    if (args.has_email === true) query = query.not("email", "is", null);
    query = query.order("fatturato", { ascending: false, nullsFirst: false }).limit(Math.min(Number(args.limit) || 20, 50));
    const { data, error, count } = await query;
    if (error) return { error: error.message };
    if (isCount) return { count };
    return { count: data?.length || 0, prospects: data || [] };
  }

  async function executeListActivities(args: Record<string, unknown>, userId?: string) {
    let query = supabase.from("activities").select("id, title, description, activity_type, status, priority, due_date, source_type, source_meta, partner_id, created_at, completed_at, email_subject")
      .order("due_date", { ascending: true, nullsFirst: false }).limit(Number(args.limit) || 30);
    if (userId) query = query.eq("user_id", userId);
    if (args.status) query = query.eq("status", args.status);
    if (args.activity_type) query = query.eq("activity_type", args.activity_type);
    if (args.source_type) query = query.eq("source_type", args.source_type);
    if (args.due_before) query = query.lte("due_date", args.due_before);
    if (args.due_after) query = query.gte("due_date", args.due_after);
    const { data, error } = await query;
    if (error) return { error: error.message };
    let results = data || [];
    if (args.partner_name) {
      const search = String(args.partner_name).toLowerCase();
      results = results.filter((a: Record<string, unknown>) => {
        const meta = a.source_meta as Record<string, unknown> | null;
        const cn = meta?.company_name as string | undefined;
        return cn ? cn.toLowerCase().includes(search) : false;
      });
    }
    return { count: results.length, activities: results.map((a: Record<string, unknown>) => ({ ...a, company_name: (a.source_meta as Record<string, unknown> | null)?.company_name || null })) };
  }

  async function executeSearchBusinessCards(args: Record<string, unknown>, userId?: string) {
    let query = supabase.from("business_cards")
      .select("id, company_name, contact_name, email, phone, event_name, met_at, location, match_status, match_confidence, matched_partner_id, matched_contact_id, tags, created_at")
      .order("created_at", { ascending: false })
      .limit(Number(args.limit) || 20);
    if (userId) query = query.eq("user_id", userId);
    if (args.event_name) query = query.ilike("event_name", `%${escapeLike(args.event_name)}%`);
    if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
    if (args.contact_name) query = query.ilike("contact_name", `%${escapeLike(args.contact_name)}%`);
    if (args.match_status) query = query.eq("match_status", args.match_status);
    const { data, error } = await query;
    if (error) return { error: error.message };
    const partnerIds = [...new Set((data || []).filter((c: Record<string, unknown>) => c.matched_partner_id).map((c: Record<string, unknown>) => c.matched_partner_id))] as string[];
    const partnerNames: Record<string, string> = {};
    if (partnerIds.length > 0) {
      let pq = supabase.from("partners").select("id, company_name").in("id", partnerIds);
      if (userId) pq = pq.eq("user_id", userId);
      const { data: partners } = await pq;
      for (const p of (partners || []) as Array<{ id: string; company_name: string }>) partnerNames[p.id] = p.company_name;
    }
    return {
      count: data?.length || 0,
      cards: (data || []).map((c: Record<string, unknown>) => ({
        id: c.id, company_name: c.company_name, contact_name: c.contact_name, email: c.email,
        event_name: c.event_name, met_at: c.met_at, location: c.location,
        match_status: c.match_status, match_confidence: c.match_confidence,
        matched_partner: c.matched_partner_id ? partnerNames[c.matched_partner_id as string] || c.matched_partner_id : null,
        tags: c.tags,
      })),
    };
  }

  return {
    executeCheckBlacklist,
    executeListReminders,
    executeSearchContacts,
    executeGetContactDetail,
    executeSearchProspects,
    executeListActivities,
    executeSearchBusinessCards,
  };
}
