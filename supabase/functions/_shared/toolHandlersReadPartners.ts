/**
 * Read handler: dominio partner/directory.
 * Estratto da `toolHandlersRead.ts` (stessi handler, stessa firma, stesso comportamento).
 */

import { escapeLike } from "./sqlEscape.ts";

// Permissive client type — vedi toolHandlersRead.ts
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export function createPartnerReadHandlers(supabase: SupabaseClient) {

  async function executeSearchPartners(args: Record<string, unknown>, userId?: string) {
    const isCount = !!args.count_only;
    let partnerIdFilter: string[] | null = null;

    if (args.service) {
      let q = supabase.from("partner_services").select("partner_id").eq("service_category", args.service);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      partnerIdFilter = (data || []).map((r: { partner_id: string }) => r.partner_id);
      if (partnerIdFilter!.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
    }
    if (args.certification) {
      let q = supabase.from("partner_certifications").select("partner_id").eq("certification", args.certification);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      const certIds = (data || []).map((r: { partner_id: string }) => r.partner_id);
      partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => certIds.includes(id)) : certIds;
      if (partnerIdFilter!.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
    }
    if (args.network_name) {
      let q = supabase.from("partner_networks").select("partner_id").ilike("network_name", `%${escapeLike(args.network_name)}%`);
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      const netIds = (data || []).map((r: { partner_id: string }) => r.partner_id);
      partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => netIds.includes(id)) : netIds;
      if (partnerIdFilter!.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
    }
    if (args.has_phone !== undefined && args.has_phone) {
      let q = supabase.from("partner_contacts").select("partner_id").or("direct_phone.not.is.null,mobile.not.is.null");
      if (userId) q = q.eq("user_id", userId);
      const { data } = await q;
      const phoneIds = [...new Set((data || []).map((r: { partner_id: string }) => r.partner_id))] as string[];
      partnerIdFilter = partnerIdFilter ? partnerIdFilter.filter(id => phoneIds.includes(id)) : phoneIds;
      if (partnerIdFilter!.length === 0) return isCount ? { count: 0 } : { count: 0, partners: [] };
    }

    let query = supabase.from("partners").select(
      isCount ? "id" : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, profile_description, raw_profile_markdown, is_favorite, office_type, has_branches, member_since",
      isCount ? { count: "exact", head: true } : undefined
    );

    if (userId) query = query.eq("user_id", userId);
    if (partnerIdFilter) query = query.in("id", partnerIdFilter.slice(0, 500));
    if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
    if (args.city) query = query.ilike("city", `%${escapeLike(args.city)}%`);
    if (args.search_name) query = query.ilike("company_name", `%${escapeLike(args.search_name)}%`);
    if (args.has_email === true) query = query.not("email", "is", null);
    if (args.has_email === false) query = query.is("email", null);
    // has_profile uses profile_description (sourced from WCA sync) — NOT raw_profile_html (legacy scraper, empty)
    if (args.has_profile === true) query = query.not("profile_description", "is", null);
    if (args.has_profile === false) query = query.is("profile_description", null);
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
        has_profile: !!p.profile_description, website: p.website || null,
        is_favorite: p.is_favorite, office_type: p.office_type, has_branches: p.has_branches,
        member_since: p.member_since || null,
      })),
    };
  }

  async function executeCountryOverview(args: Record<string, unknown>) {
    type StatRow = { country_code: string; total_partners: number; with_profile: number; without_profile: number; with_email: number; with_phone: number; hq_count: number; branch_count: number };
    const { data, error } = await supabase.rpc("get_country_stats");
    if (error) return { error: error.message };
    let stats: StatRow[] = (data || []) as StatRow[];
    if (args.country_code) stats = stats.filter((s) => s.country_code === String(args.country_code).toUpperCase());
    const sortBy = String(args.sort_by || "total");
    if (sortBy === "missing_profiles") stats.sort((a, b) => (b.without_profile || 0) - (a.without_profile || 0));
    else if (sortBy === "missing_emails") stats.sort((a, b) => ((b.total_partners - b.with_email) || 0) - ((a.total_partners - a.with_email) || 0));
    else stats.sort((a, b) => (b.total_partners || 0) - (a.total_partners || 0));
    const limit = Number(args.limit) || 30;
    return {
      total_countries: stats.length,
      countries: stats.slice(0, limit).map((s) => ({
        country_code: s.country_code, total_partners: s.total_partners, hq: s.hq_count, branches: s.branch_count,
        with_profile: s.with_profile, without_profile: s.without_profile, with_email: s.with_email, with_phone: s.with_phone,
        profile_coverage: s.total_partners ? `${Math.round((s.with_profile / s.total_partners) * 100)}%` : "0%",
      })),
    };
  }

  async function executeDirectoryStatus(args: Record<string, unknown>) {
    type StatRow = { country_code: string; total_partners: number; with_profile: number; without_profile: number };
    const { data: dirData } = await supabase.rpc("get_directory_counts");
    const { data: statsData } = await supabase.rpc("get_country_stats");
    const dirMap: Record<string, { members: number; verified: boolean }> = {};
    for (const r of (dirData || []) as Array<{ country_code: string; member_count: number; is_verified: boolean }>) dirMap[r.country_code] = { members: Number(r.member_count), verified: r.is_verified };
    const statsMap: Record<string, StatRow> = {};
    for (const r of (statsData || []) as StatRow[]) statsMap[r.country_code] = r;
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
    const [contactsRes, networksRes, servicesRes, certsRes, socialsRes, blacklistRes, bcaRes, importedRes] = await Promise.all([
      applyOwner(supabase.from("partner_contacts").select("name, email, title, direct_phone, mobile, is_primary").eq("partner_id", pid)),
      applyOwner(supabase.from("partner_networks").select("network_name, expires, network_id").eq("partner_id", pid)),
      applyOwner(supabase.from("partner_services").select("service_category").eq("partner_id", pid)),
      applyOwner(supabase.from("partner_certifications").select("certification").eq("partner_id", pid)),
      applyOwner(supabase.from("partner_social_links").select("platform, url").eq("partner_id", pid)),
      supabase.from("blacklist_entries").select("company_name, total_owed_amount, claims, status").eq("matched_partner_id", pid),
      // Business cards condivise (BCA): visibilità globale per scelta di prodotto
      supabase.from("business_cards")
        .select("contact_name, email, phone, mobile, position, event_name, met_at, location")
        .eq("matched_partner_id", pid)
        .is("deleted_at", null),
      // Contatti importati (CRM) collegati allo stesso partner via match by company name
      // (per coerenza con la sidebar Network che li somma)
      applyOwner(
        supabase.from("imported_contacts")
          .select("name, email, phone, mobile, position, lead_status, origin")
          .ilike("company_name", String(partner.company_name || ""))
          .limit(50),
      ),
    ]);
    const partnerContacts = (contactsRes.data || []).map((c: Record<string, unknown>) => ({
      name: c.name, title: c.title, email: c.email,
      phone: c.direct_phone || c.mobile, is_primary: c.is_primary, source: "partner",
    }));
    const bcaContacts = (bcaRes.data || []).map((c: Record<string, unknown>) => ({
      name: c.contact_name, title: c.position, email: c.email,
      phone: c.phone || c.mobile,
      met_at: c.met_at, event: c.event_name, location: c.location,
      source: "business_card",
    }));
    const importedContacts = (importedRes.data || []).map((c: Record<string, unknown>) => ({
      name: c.name, title: c.position, email: c.email,
      phone: c.phone || c.mobile, lead_status: c.lead_status, origin: c.origin,
      source: "imported",
    }));
    // Dedup per email per evitare doppi conteggi tra le 3 fonti
    const allContacts = [...partnerContacts, ...bcaContacts, ...importedContacts];
    const seenEmails = new Set<string>();
    const dedupedContacts = allContacts.filter((c) => {
      const e = String(c.email || "").trim().toLowerCase();
      if (!e) return true;
      if (seenEmails.has(e)) return false;
      seenEmails.add(e);
      return true;
    });
    return {
      id: partner.id, company_name: partner.company_name, alias: partner.company_alias, city: partner.city,
      country: `${partner.country_name} (${partner.country_code})`, address: partner.address || null,
      email: partner.email || null, phone: partner.phone || null, mobile: partner.mobile || null, fax: partner.fax || null,
      website: partner.website || null, rating: partner.rating, rating_details: partner.rating_details,
      office_type: partner.office_type, has_branches: partner.has_branches, branch_cities: partner.branch_cities,
      is_favorite: partner.is_favorite, is_active: partner.is_active, wca_id: partner.wca_id,
      member_since: partner.member_since, membership_expires: partner.membership_expires,
      has_profile: !!partner.profile_description,
      profile_summary: partner.profile_description
        ? String(partner.profile_description).substring(0, 2000)
        : (partner.raw_profile_markdown ? String(partner.raw_profile_markdown).substring(0, 2000) : null),
      contacts: dedupedContacts,
      contacts_count_total: dedupedContacts.length,
      contacts_breakdown: {
        partner_contacts: partnerContacts.length,
        business_cards: bcaContacts.length,
        imported_contacts: importedContacts.length,
      },
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

  return {
    executeSearchPartners,
    executeCountryOverview,
    executeDirectoryStatus,
    executePartnerDetail,
    executeGlobalSummary,
    executePartnersWithoutContacts,
  };
}
