/**
 * Read-only tool handlers for AI assistants.
 * Extracted from ai-assistant/index.ts for maintainability.
 * Vol. I §5 — Guardrails: ogni modulo ha un unico scopo.
 */

import { escapeLike } from "./sqlEscape.ts";

type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient>;

export function createReadHandlers(supabase: SupabaseClient) {

  async function executeSearchPartners(args: Record<string, unknown>, userId?: string) {
    const isCount = !!args.count_only;
    let partnerIdFilter: string[] | null = null;

    if (args.service) {
      let q = supabase.from("partner_services").select("partner_id").eq("service_category", args.service);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      partnerIdFilter = (data || []).map((r: { partner_id: string }) => r.partner_id);
      if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
    }
    if (args.certification) {
      let q = supabase.from("partner_certifications").select("partner_id").eq("certification", args.certification);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      const certIds = (data || []).map((r: { partner_id: string }) => r.partner_id);
      partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => certIds.includes(id)) : certIds;
      if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
    }
    if (args.network_name) {
      let q = supabase.from("partner_networks").select("partner_id").ilike("network_name", `%${escapeLike(args.network_name)}%`);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      const netIds = (data || []).map((r: { partner_id: string }) => r.partner_id);
      partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => netIds.includes(id)) : netIds;
      if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
    }
    if (args.has_phone !== undefined && args.has_phone) {
      let q = supabase.from("partner_contacts").select("partner_id").or("direct_phone.not.is.null,mobile.not.is.null");
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      const phoneIds = [...new Set((data || []).map((r: { partner_id: string }) => r.partner_id))];
      partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => phoneIds.includes(id)) : phoneIds;
      if (partnerIdFilter.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
    }

    let query = supabase.from("partners").select(
      isCount ? "id" : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, raw_profile_html, is_favorite, office_type, has_branches, member_since",
      isCount ? { count: "exact", head: true } : undefined
    );

    if (userId) query = query.eq("user_id", userId);
    if (partnerIdFilter) query = query.in("id", partnerIdFilter.slice(0, 500));
    if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
    if (args.city) query = query.ilike("city", `%${escapeLike(args.city)}%`);
    if (args.search_name) query = query.ilike("company_name", `%${escapeLike(args.search_name)}%`);
    if (args.has_email === true) query = query.not("email", "is", null);
    if (args.has_email === false) query = query.is("email", null);
    if (args.has_profile === true) query = query.not("raw_profile_html", "is", null);
    if (args.has_profile === false) query = query.is("raw_profile_html", null);
    if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
    if (args.office_type) query = query.eq("office_type", args.office_type);
    if (args.is_favorite === true) query = query.eq("is_favorite", true);
    if (args.has_branches === true) query = query.eq("has_branches", true);

    const sortBy = String(args.sort_by || "rating");
    if (sortBy === "name") query = query.order("company_name", { ascending: true });
    else if (sortBy === "recent") query = query.order("created_at", { ascending: false });
    else if (sortBy === "seniority") query = query.order("member_since", { ascending: true, nullsFirst: false });
    else query = query.order("rating", { ascending: false, nullsFirst: false });

    const limit = Math.min(Number(args.limit) || 20, 50);
    query = query.limit(limit);

    const { data, error, count } = await query;
    if (error) return { error: error.message };
    if (isCount) return { count };

    return {
      count: data?.length,
      partners: (data || []).map((p: Record<string, unknown>) => ({
        id: p.id, company_name: p.company_name, city: p.city,
        country: `${p.country_name} (${p.country_code})`,
        email: p.email || null, phone: p.phone || null, rating: p.rating ?? null,
        has_profile: !!p.raw_profile_html, website: p.website || null,
        is_favorite: p.is_favorite, office_type: p.office_type, has_branches: p.has_branches,
        member_since: p.member_since || null,
      })),
    };
  }

  async function executeCountryOverview(args: Record<string, unknown>) {
    const { data, error } = await supabase.rpc("get_country_stats");
    if (error) return { error: error.message };
    let stats = data || [];
    if (args.country_code) stats = stats.filter((s: Record<string, unknown>) => s.country_code === String(args.country_code).toUpperCase());
    const sortBy = String(args.sort_by || "total");
    if (sortBy === "missing_profiles") stats.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.without_profile || 0) - (a.without_profile || 0));
    else if (sortBy === "missing_emails") stats.sort((a: Record<string, unknown>, b: Record<string, unknown>) => ((b.total_partners - b.with_email) || 0) - ((a.total_partners - a.with_email) || 0));
    else stats.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.total_partners || 0) - (a.total_partners || 0));
    const limit = Number(args.limit) || 30;
    return {
      total_countries: stats.length,
      countries: stats.slice(0, limit).map((s: Record<string, unknown>) => ({
        country_code: s.country_code, total_partners: s.total_partners, hq: s.hq_count, branches: s.branch_count,
        with_profile: s.with_profile, without_profile: s.without_profile, with_email: s.with_email, with_phone: s.with_phone,
        profile_coverage: s.total_partners ? `${Math.round((s.with_profile / s.total_partners) * 100)}%` : "0%",
      })),
    };
  }

  async function executeDirectoryStatus(args: Record<string, unknown>) {
    const { data: dirData } = await supabase.rpc("get_directory_counts");
    const { data: statsData } = await supabase.rpc("get_country_stats");
    const dirMap: Record<string, { members: number; verified: boolean }> = {};
    for (const r of (dirData || []) as Array<{ country_code: string; member_count: number; is_verified: boolean }>) dirMap[r.country_code] = { members: Number(r.member_count), verified: r.is_verified };
    const statsMap: Record<string, Record<string, unknown>> = {};
    for (const r of (statsData || []) as Array<Record<string, unknown>>) statsMap[r.country_code] = r;
    const allCodes = [...new Set([...Object.keys(dirMap), ...Object.keys(statsMap)])];
    if (args.country_code) {
      const code = String(args.country_code).toUpperCase();
      const dir = dirMap[code]; const db = statsMap[code];
      return {
        country_code: code, directory_members: dir?.members || 0, directory_verified: dir?.verified || false,
        db_partners: db?.total_partners || 0, db_with_profile: db?.with_profile || 0, db_without_profile: db?.without_profile || 0,
        gap: (dir?.members || 0) - (db?.total_partners || 0),
        status: !dir && !db ? "mai_esplorato" : !dir ? "no_directory" : (db?.total_partners || 0) >= (dir?.members || 0) && (db?.without_profile || 0) === 0 ? "completato" : "incompleto",
      };
    }
    const results = allCodes.map(code => ({
      country_code: code, directory_members: dirMap[code]?.members || 0, db_partners: statsMap[code]?.total_partners || 0,
      gap: (dirMap[code]?.members || 0) - (statsMap[code]?.total_partners || 0), profiles_missing: statsMap[code]?.without_profile || 0,
    })).filter(r => r.gap > 0 || r.profiles_missing > 0).sort((a, b) => b.gap - a.gap);
    return { countries_with_gaps: results.length, gaps: results.slice(0, 30) };
  }

  async function executeListJobs(args: Record<string, unknown>, userId?: string) {
    let query = supabase.from("download_jobs")
      .select("id, country_code, country_name, status, job_type, current_index, total_count, contacts_found_count, contacts_missing_count, created_at, updated_at, last_processed_company, error_message, network_name")
      .order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
    if (userId) query = query.eq("user_id", userId);
    if (args.status) query = query.eq("status", args.status);
    if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
    const { data, error } = await query;
    if (error) return { error: error.message };
    return {
      count: data?.length,
      jobs: (data || []).map((j: Record<string, unknown>) => ({
        id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status, type: j.job_type,
        progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count, missing: j.contacts_missing_count,
        last_company: j.last_processed_company || null, network: j.network_name, error: j.error_message || null, created: j.created_at,
      })),
    };
  }

  async function executePartnerDetail(args: Record<string, unknown>, userId?: string) {
    let partner: Record<string, unknown> | null = null;
    if (args.partner_id) {
      let q = supabase.from("partners").select("*").eq("id", args.partner_id);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q.maybeSingle();
      partner = data;
    } else if (args.company_name) {
      let q = supabase.from("partners").select("*").ilike("company_name", `%${escapeLike(args.company_name)}%`);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q.limit(1).maybeSingle();
      partner = data;
    }
    if (!partner) return { error: "Partner non trovato" };
    const pid = partner.id as string;
    const ownerFilter = userId ? { user_id: userId } : null;
    const applyOwner = <T extends { eq: (col: string, val: unknown) => T }>(q: T): T =>
      ownerFilter ? q.eq("user_id", ownerFilter.user_id) : q;
    const [contactsRes, networksRes, servicesRes, certsRes, socialsRes, blacklistRes] = await Promise.all([
      applyOwner(supabase.from("partner_contacts").select("name, email, title, direct_phone, mobile, is_primary").eq("partner_id", pid)),
      applyOwner(supabase.from("partner_networks").select("network_name, expires, network_id").eq("partner_id", pid)),
      applyOwner(supabase.from("partner_services").select("service_category").eq("partner_id", pid)),
      applyOwner(supabase.from("partner_certifications").select("certification").eq("partner_id", pid)),
      applyOwner(supabase.from("partner_social_links").select("platform, url").eq("partner_id", pid)),
      supabase.from("blacklist_entries").select("company_name, total_owed_amount, claims, status").eq("matched_partner_id", pid),
    ]);
    return {
      id: partner.id, company_name: partner.company_name, alias: partner.company_alias, city: partner.city,
      country: `${partner.country_name} (${partner.country_code})`, address: partner.address || null,
      email: partner.email || null, phone: partner.phone || null, mobile: partner.mobile || null, fax: partner.fax || null,
      website: partner.website || null, rating: partner.rating, rating_details: partner.rating_details,
      office_type: partner.office_type, has_branches: partner.has_branches, branch_cities: partner.branch_cities,
      is_favorite: partner.is_favorite, is_active: partner.is_active, wca_id: partner.wca_id,
      member_since: partner.member_since, membership_expires: partner.membership_expires,
      has_profile: !!partner.raw_profile_html,
      profile_summary: partner.raw_profile_markdown ? String(partner.raw_profile_markdown).substring(0, 2000) : null,
      contacts: (contactsRes.data || []).map((c: Record<string, unknown>) => ({ name: c.name, title: c.title, email: c.email, phone: c.direct_phone || c.mobile, is_primary: c.is_primary })),
      networks: (networksRes.data || []).map((n: Record<string, unknown>) => ({ name: n.network_name, expires: n.expires })),
      services: (servicesRes.data || []).map((s: { service_category: string }) => s.service_category),
      certifications: (certsRes.data || []).map((c: { certification: string }) => c.certification),
      social_links: (socialsRes.data || []).map((s: { platform: string; url: string }) => ({ platform: s.platform, url: s.url })),
      blacklist_matches: (blacklistRes.data || []).map((b: Record<string, unknown>) => ({ company: b.company_name, owed: b.total_owed_amount, claims: b.claims, status: b.status })),
    };
  }

  async function executeGlobalSummary() {
    const [statsRes, dirRes, jobsRes] = await Promise.all([
      supabase.rpc("get_country_stats"), supabase.rpc("get_directory_counts"),
      supabase.from("download_jobs").select("id, status").in("status", ["running", "pending"]),
    ]);
    const rows = statsRes.data || [];
    const totals = rows.reduce((acc: Record<string, number>, r: Record<string, unknown>) => ({
      partners: acc.partners + (Number(r.total_partners) || 0), with_profile: acc.with_profile + (Number(r.with_profile) || 0),
      without_profile: acc.without_profile + (Number(r.without_profile) || 0), with_email: acc.with_email + (Number(r.with_email) || 0),
      with_phone: acc.with_phone + (Number(r.with_phone) || 0),
    }), { partners: 0, with_profile: 0, without_profile: 0, with_email: 0, with_phone: 0 });
    const dirRows = dirRes.data || [];
    const dirTotal = dirRows.reduce((sum: number, r: Record<string, unknown>) => sum + (Number(r.member_count) || 0), 0);
    return {
      total_countries_with_data: rows.length, total_partners: totals.partners,
      with_profile: totals.with_profile, without_profile: totals.without_profile,
      with_email: totals.with_email, with_phone: totals.with_phone,
      profile_coverage: totals.partners ? `${Math.round((totals.with_profile / totals.partners) * 100)}%` : "0%",
      email_coverage: totals.partners ? `${Math.round((totals.with_email / totals.partners) * 100)}%` : "0%",
      directory_members_total: dirTotal, directory_countries_scanned: dirRows.length,
      download_gap: dirTotal - totals.partners, active_jobs: jobsRes.data?.length || 0,
    };
  }

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
    const partnerIds = [...new Set((data || []).map((r: { partner_id: string }) => r.partner_id))];
    let pq = supabase.from("partners").select("id, company_name").in("id", partnerIds);
    if (userId) pq = pq.eq("user_id", userId);
    const { data: partners } = await pq;
    const nameMap: Record<string, string> = {};
    for (const p of (partners || []) as Array<{ id: string; company_name: string }>) nameMap[p.id] = p.company_name;
    let results = (data || []).map((r: Record<string, unknown>) => ({
      id: r.id, title: r.title, description: r.description, due_date: r.due_date,
      priority: r.priority, status: r.status, partner: nameMap[r.partner_id] || "Sconosciuto",
    }));
    if (args.partner_name) {
      const search = String(args.partner_name).toLowerCase();
      results = results.filter(r => r.partner.toLowerCase().includes(search));
    }
    return { count: results.length, reminders: results };
  }

  async function executePartnersWithoutContacts(args: Record<string, unknown>) {
    let query = supabase.from("partners_no_contacts").select("wca_id, company_name, city, country_code, retry_count, scraped_at")
      .eq("resolved", false).order("scraped_at", { ascending: false }).limit(Number(args.limit) || 30);
    if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
    const { data, error } = await query;
    if (error) return { error: error.message };
    return {
      count: data?.length || 0,
      partners: (data || []).map((p: Record<string, unknown>) => ({
        wca_id: p.wca_id, company_name: p.company_name, city: p.city, country_code: p.country_code,
        retry_count: p.retry_count, last_scraped: p.scraped_at,
      })),
    };
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

  async function executeGetContactDetail(args: Record<string, unknown>) {
    let contact: Record<string, unknown> | null = null;
    if (args.contact_id) {
      const { data } = await supabase.from("imported_contacts").select("*").eq("id", args.contact_id).single();
      contact = data;
    } else if (args.contact_name) {
      const { data } = await supabase.from("imported_contacts").select("*").ilike("name", `%${escapeLike(args.contact_name)}%`).limit(1).single();
      contact = data;
    }
    if (!contact) return { error: "Contatto non trovato" };
    const { data: interactions } = await supabase.from("contact_interactions").select("*").eq("contact_id", contact.id).order("created_at", { ascending: false }).limit(10);
    return { ...contact, interactions: interactions || [] };
  }

  async function executeSearchProspects(args: Record<string, unknown>) {
    const isCount = !!args.count_only;
    let query = supabase.from("prospects").select(
      isCount ? "id" : "id, company_name, city, province, region, codice_ateco, descrizione_ateco, fatturato, dipendenti, email, phone, pec, website, lead_status, partita_iva, forma_giuridica, rating_affidabilita, created_at",
      isCount ? { count: "exact", head: true } : undefined
    );
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

  async function executeListActivities(args: Record<string, unknown>) {
    let query = supabase.from("activities").select("id, title, description, activity_type, status, priority, due_date, source_type, source_meta, partner_id, created_at, completed_at, email_subject")
      .order("due_date", { ascending: true, nullsFirst: false }).limit(Number(args.limit) || 30);
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
        return meta?.company_name?.toLowerCase().includes(search) || false;
      });
    }
    return { count: results.length, activities: results.map((a: Record<string, unknown>) => ({ ...a, company_name: (a.source_meta as Record<string, unknown> | null)?.company_name || null })) };
  }

  async function executeSearchBusinessCards(args: Record<string, unknown>) {
    let query = supabase.from("business_cards")
      .select("id, company_name, contact_name, email, phone, event_name, met_at, location, match_status, match_confidence, matched_partner_id, matched_contact_id, tags, created_at")
      .order("created_at", { ascending: false })
      .limit(Number(args.limit) || 20);
    if (args.event_name) query = query.ilike("event_name", `%${escapeLike(args.event_name)}%`);
    if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name)}%`);
    if (args.contact_name) query = query.ilike("contact_name", `%${escapeLike(args.contact_name)}%`);
    if (args.match_status) query = query.eq("match_status", args.match_status);
    const { data, error } = await query;
    if (error) return { error: error.message };
    const partnerIds = [...new Set((data || []).filter((c: Record<string, unknown>) => c.matched_partner_id).map((c: Record<string, unknown>) => c.matched_partner_id))];
    const partnerNames: Record<string, string> = {};
    if (partnerIds.length > 0) {
      const { data: partners } = await supabase.from("partners").select("id, company_name").in("id", partnerIds);
      for (const p of (partners || []) as Array<{ id: string; company_name: string }>) partnerNames[p.id] = p.company_name;
    }
    return {
      count: data?.length || 0,
      cards: (data || []).map((c: Record<string, unknown>) => ({
        id: c.id, company_name: c.company_name, contact_name: c.contact_name, email: c.email,
        event_name: c.event_name, met_at: c.met_at, location: c.location,
        match_status: c.match_status, match_confidence: c.match_confidence,
        matched_partner: c.matched_partner_id ? partnerNames[c.matched_partner_id] || c.matched_partner_id : null,
        tags: c.tags,
      })),
    };
  }

  async function executeCheckJobStatus(args: Record<string, unknown>) {
    const result: Record<string, unknown> = {};
    if (args.job_id) {
      const { data: job, error } = await supabase.from("download_jobs")
        .select("id, country_code, country_name, status, job_type, current_index, total_count, contacts_found_count, contacts_missing_count, created_at, updated_at, completed_at, last_processed_company, error_message, network_name")
        .eq("id", args.job_id).single();
      if (error || !job) {
        result.job = { error: "Job non trovato", job_id: args.job_id };
      } else {
        const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
        const elapsed = job.updated_at && job.created_at ? Math.round((new Date(job.updated_at).getTime() - new Date(job.created_at).getTime()) / 60000) : null;
        result.job = {
          id: job.id, country: `${job.country_name} (${job.country_code})`, status: job.status, type: job.job_type,
          progress_percent: progress, current: job.current_index, total: job.total_count,
          contacts_found: job.contacts_found_count, contacts_missing: job.contacts_missing_count,
          last_company: job.last_processed_company, error: job.error_message || null, elapsed_minutes: elapsed,
          completed_at: job.completed_at, is_finished: ["completed", "cancelled", "failed"].includes(job.status),
          verdict: job.status === "completed" ? `✅ Completato: ${job.contacts_found_count} contatti trovati, ${job.contacts_missing_count} mancanti`
            : job.status === "running" ? `⏳ In corso: ${progress}% (${job.current_index}/${job.total_count})`
            : job.status === "failed" || job.error_message ? `❌ Errore: ${job.error_message || "sconosciuto"}`
            : `🕐 ${job.status}`,
        };
      }
    }
    const { data: activeJobs } = await supabase.from("download_jobs")
      .select("id, country_name, country_code, status, current_index, total_count, job_type, last_processed_company, error_message, created_at")
      .in("status", ["running", "pending", "paused"]).order("created_at", { ascending: false }).limit(10);
    result.active_downloads = {
      count: activeJobs?.length || 0,
      jobs: (activeJobs || []).map((j: Record<string, unknown>) => ({
        id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status,
        progress: j.total_count > 0 ? `${Math.round((j.current_index / j.total_count) * 100)}%` : "0%",
        detail: `${j.current_index}/${j.total_count}`, last_company: j.last_processed_company, error: j.error_message,
      })),
    };
    const { data: recentJobs } = await supabase.from("download_jobs")
      .select("id, country_name, country_code, status, current_index, total_count, contacts_found_count, contacts_missing_count, completed_at, error_message")
      .in("status", ["completed", "cancelled", "failed"]).order("completed_at", { ascending: false }).limit(5);
    result.recently_completed = {
      count: recentJobs?.length || 0,
      jobs: (recentJobs || []).map((j: Record<string, unknown>) => ({
        id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status,
        processed: `${j.current_index}/${j.total_count}`, contacts_found: j.contacts_found_count,
        contacts_missing: j.contacts_missing_count, completed_at: j.completed_at, error: j.error_message,
      })),
    };
    if (args.include_email_queue !== false) {
      const { data: emailQueue } = await supabase.from("email_campaign_queue").select("status").in("status", ["pending", "sending"]);
      const pending = (emailQueue || []).filter((r: Record<string, unknown>) => r.status === "pending").length;
      const sending = (emailQueue || []).filter((r: Record<string, unknown>) => r.status === "sending").length;
      result.email_queue = { pending, sending, total: pending + sending };
    }
    return result;
  }

  return {
    executeSearchPartners,
    executeCountryOverview,
    executeDirectoryStatus,
    executeListJobs,
    executePartnerDetail,
    executeGlobalSummary,
    executeCheckBlacklist,
    executeListReminders,
    executePartnersWithoutContacts,
    executeSearchContacts,
    executeGetContactDetail,
    executeSearchProspects,
    executeListActivities,
    executeSearchBusinessCards,
    executeCheckJobStatus,
  };
}
