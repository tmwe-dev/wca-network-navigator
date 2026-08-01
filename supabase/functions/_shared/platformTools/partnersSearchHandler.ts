/**
 * partnersSearchHandler.ts - Partner search and detail tool handlers
 * Handles: search, detail, country overview.
 *
 * REWRITE 2026-04-29: handleGetPartnerDetail aggrega ora contatti
 * multi-fonte (partner_contacts + business_cards matched + imported_contacts
 * matched), deals, activities, channel_messages, outreach_queue, calendar_events,
 * blacklist, social_links. Fix anti-pattern: has_profile/profile_summary usano
 * profile_description (vedi mem://tech/wca-data-availability).
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

interface CountryStatRow {
  country_code: string;
  total_partners: number;
  with_profile: number;
  without_profile: number;
  with_email: number;
  with_phone: number;
}

interface ServiceRow {
  service_category: string;
}

interface PartnerSummary {
  id: string;
  company_name: string;
  city: string | null;
  country_code: string | null;
  country_name: string | null;
  address: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  fax: string | null;
  emergency_phone: string | null;
  website: string | null;
  rating: number | null;
  lead_status: string | null;
  office_type: string | null;
  partner_type: string | null;
  member_since: string | null;
  membership_expires: string | null;
  company_alias: string | null;
  logo_url: string | null;
  is_favorite: boolean | null;
  is_active: boolean | null;
  has_branches: boolean | null;
  branch_cities: unknown;
  enrichment_data: Record<string, unknown> | null;
  profile_description: string | null;
  interaction_count: number | null;
  last_interaction_at: string | null;
  created_at: string | null;
}

export async function handleSearchPartners(
  args: Record<string, unknown>
): Promise<unknown> {
  const isCount = !!args.count_only;
  const selectCols = isCount
    ? "id"
    : "*";
  let query = isCount
    ? supabase.from("partners").select(selectCols, { count: "exact", head: true })
    : supabase.from("partners").select(selectCols);
  if (args.country_code)
    query = query.eq("country_code", String(args.country_code).toUpperCase());
  if (Array.isArray(args.country_codes) && (args.country_codes as string[]).length) {
    query = query.in(
      "country_code",
      (args.country_codes as string[]).map((c) => String(c).toUpperCase()),
    );
  }
  if (args.city) query = query.ilike("city", `%${escapeLike(String(args.city))}%`);
  if (args.search_name)
    query = query.ilike("company_name", `%${escapeLike(String(args.search_name))}%`);
  if (args.has_email === true) query = query.not("email", "is", null);
  if (args.has_profile === true) query = query.not("profile_description", "is", null);
  if (args.has_profile === false) query = query.is("profile_description", null);
  if (args.has_alias === true) query = query.not("company_alias", "is", null);
  if (args.has_alias === false) query = query.is("company_alias", null);
  if (args.min_rating) query = query.gte("rating", Number(args.min_rating));
  if (args.office_type) query = query.eq("office_type", args.office_type);
  if (args.is_favorite === true) query = query.eq("is_favorite", true);
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  if (Array.isArray(args.lead_statuses) && (args.lead_statuses as string[]).length) {
    query = query.in("lead_status", args.lead_statuses as string[]);
  }
  if (typeof args.member_expiring_within_days === "number") {
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() + Number(args.member_expiring_within_days));
    query = query.lte("membership_expires", limitDate.toISOString().slice(0, 10));
  }

  const sortBy = String(args.sort_by || "rating");
  const sortMap: Record<string, { col: string; asc: boolean }> = {
    rating: { col: "rating", asc: false },
    name: { col: "company_name", asc: true },
    recent: { col: "created_at", asc: false },
    interaction_count: { col: "interaction_count", asc: false },
    last_interaction_at: { col: "last_interaction_at", asc: false },
  };
  const sort = sortMap[sortBy] ?? sortMap.rating;
  query = query
    .order(sort.col, { ascending: sort.asc, nullsFirst: false })
    .limit(Math.min(Number(args.limit) || 20, 50));
  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };
  type PartnerRow = {
    id: string;
    company_name: string;
    city: string;
    country_code: string;
    country_name: string;
    email: string | null;
    rating: number | null;
    profile_description: string | null;
    lead_status: string | null;
    company_alias: string | null;
    interaction_count: number | null;
    last_interaction_at: string | null;
    membership_expires: string | null;
  };
  const rows = (data ?? []) as unknown as PartnerRow[];
  return {
    count: rows.length,
    partners: rows.map((p) => ({
        id: p.id,
        company_name: p.company_name,
        city: p.city,
        country_code: p.country_code,
        country_name: p.country_name,
        email: p.email,
        rating: p.rating,
        has_profile: !!p.profile_description,
        lead_status: p.lead_status,
        company_alias: p.company_alias,
        interaction_count: p.interaction_count,
        last_interaction_at: p.last_interaction_at,
        membership_expires: p.membership_expires,
    })),
  };
}

export async function handleGetPartnerDetail(
  args: Record<string, unknown>
): Promise<unknown> {
  let partner: PartnerSummary | null = null;
  if (args.partner_id) {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .eq("id", args.partner_id as string)
      .maybeSingle();
    partner = data as PartnerSummary | null;
  } else if (args.company_name) {
    const { data } = await supabase
      .from("partners")
      .select("*")
      .ilike("company_name", `%${escapeLike(String(args.company_name))}%`)
      .limit(1)
      .maybeSingle();
    partner = data as PartnerSummary | null;
  }
  if (!partner) return { error: "Partner non trovato" };
  const partnerEmail = (partner.email || "").toLowerCase();

  const [
    pcRes,
    netRes,
    svcRes,
    bcaRes,
    impRes,
    socialRes,
    activitiesRes,
    dealsRes,
    msgRes,
    queueRes,
    eventsRes,
    blacklistRes,
  ] = await Promise.all([
    supabase
      .from("partner_contacts")
      .select("id, name, email, title, direct_phone, mobile, is_primary, contact_alias")
      .eq("partner_id", partner.id),
    supabase
      .from("partner_networks")
      .select("network_name, network_id, expires")
      .eq("partner_id", partner.id),
    supabase
      .from("partner_services")
      .select("service_category")
      .eq("partner_id", partner.id),
    supabase
      .from("business_cards")
      .select("id, contact_name, email, phone, position, event_name, met_at, match_confidence, match_status")
      .eq("matched_partner_id", partner.id)
      .is("deleted_at", null)
      .order("met_at", { ascending: false })
      .limit(20),
    supabase
      .from("imported_contacts")
      .select("id, name, email, phone, position, lead_status, lead_score, note, origin, last_interaction_at")
      .eq("transferred_to_partner_id", partner.id)
      .is("deleted_at", null)
      .limit(50),
    supabase
      .from("partner_social_links")
      .select("platform, url, contact_id")
      .eq("partner_id", partner.id),
    supabase
      .from("activities")
      .select("id, activity_type, title, status, due_date, completed_at, created_at")
      .eq("partner_id", partner.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("deals")
      .select("id, title, stage, amount, currency, probability, expected_close_date, created_at")
      .eq("partner_id", partner.id)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("channel_messages")
      .select("id, channel, direction, subject, from_address, to_address, email_date, category")
      .eq("partner_id", partner.id)
      .is("deleted_at", null)
      .order("email_date", { ascending: false })
      .limit(8),
    supabase
      .from("outreach_queue")
      .select("id, channel, status, subject, recipient_email, created_at, processed_at")
      .eq("partner_id", partner.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("calendar_events")
      .select("id, title, event_type, start_at, end_at, status")
      .eq("partner_id", partner.id)
      .gte("start_at", new Date().toISOString())
      .order("start_at", { ascending: true })
      .limit(10),
    partnerEmail
      ? supabase.from("blacklist").select("email, domain, reason").or(`email.eq.${partnerEmail},domain.eq.${partnerEmail.split("@")[1] || ""}`)
      : Promise.resolve({ data: [] }),
  ]);

  // Multi-source contact aggregation deduplicated by email
  const seen = new Set<string>();
  type UnifiedContact = {
    source: "partner_contact" | "business_card" | "imported_contact";
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    title: string | null;
    is_primary?: boolean;
    note?: string | null;
    origin?: string | null;
  };
  const unified: UnifiedContact[] = [];

  for (const c of (pcRes.data || []) as Record<string, unknown>[]) {
    const email = String(c.email || "").toLowerCase().trim();
    const key = email || `pc:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unified.push({
      source: "partner_contact",
      id: String(c.id),
      name: (c.name as string) || null,
      email: (c.email as string) || null,
      phone: (c.direct_phone as string) || (c.mobile as string) || null,
      title: (c.title as string) || null,
      is_primary: !!c.is_primary,
    });
  }
  for (const c of (bcaRes.data || []) as Record<string, unknown>[]) {
    const email = String(c.email || "").toLowerCase().trim();
    const key = email || `bca:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unified.push({
      source: "business_card",
      id: String(c.id),
      name: (c.contact_name as string) || null,
      email: (c.email as string) || null,
      phone: (c.phone as string) || null,
      title: (c.position as string) || null,
    });
  }
  for (const c of (impRes.data || []) as Record<string, unknown>[]) {
    const email = String(c.email || "").toLowerCase().trim();
    const key = email || `ic:${c.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unified.push({
      source: "imported_contact",
      id: String(c.id),
      name: (c.name as string) || null,
      email: (c.email as string) || null,
      phone: (c.phone as string) || null,
      title: (c.position as string) || null,
      note: (c.note as string) || null,
      origin: (c.origin as string) || null,
    });
  }

  return {
    id: partner.id,
    company_name: partner.company_name,
    company_alias: partner.company_alias,
    city: partner.city,
    country_code: partner.country_code,
    country_name: partner.country_name,
    address: partner.address,
    email: partner.email,
    phone: partner.phone,
    mobile: partner.mobile,
    fax: partner.fax,
    emergency_phone: partner.emergency_phone,
    website: partner.website,
    rating: partner.rating,
    lead_status: partner.lead_status,
    office_type: partner.office_type,
    partner_type: partner.partner_type,
    member_since: partner.member_since,
    membership_expires: partner.membership_expires,
    has_branches: partner.has_branches,
    branch_cities: partner.branch_cities,
    logo_url: partner.logo_url,
    is_favorite: partner.is_favorite,
    is_active: partner.is_active,
    interaction_count: partner.interaction_count,
    last_interaction_at: partner.last_interaction_at,
    has_profile: !!partner.profile_description,
    profile_summary: partner.profile_description?.substring(0, 1500) || null,
    enrichment_data: partner.enrichment_data || null,

    // Aggregations
    contacts_count_total: unified.length,
    contacts_breakdown: {
      partner_contacts: (pcRes.data || []).length,
      business_cards_matched: (bcaRes.data || []).length,
      imported_contacts_matched: (impRes.data || []).length,
    },
    contacts: unified,

    networks: netRes.data || [],
    services: ((svcRes.data || []) as ServiceRow[]).map((s) => s.service_category),
    social_links: socialRes.data || [],

    recent_activities: activitiesRes.data || [],
    deals: dealsRes.data || [],
    deals_count: (dealsRes.data || []).length,
    recent_messages: msgRes.data || [],
    outreach_queue: queueRes.data || [],
    upcoming_events: eventsRes.data || [],

    blacklist_hit: (blacklistRes.data || []).length > 0,
    blacklist_entries: blacklistRes.data || [],
  };
}

export async function handleGetCountryOverview(
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase.rpc("get_country_stats");
  if (error) return { error: error.message };
  let stats = (data || []) as CountryStatRow[];
  if (args.country_code)
    stats = stats.filter((s) => s.country_code === String(args.country_code).toUpperCase());
  stats.sort((a, b) => (b.total_partners || 0) - (a.total_partners || 0));
  return {
    total_countries: stats.length,
    countries: stats.slice(0, Number(args.limit) || 30).map((s) => ({
      country_code: s.country_code,
      total_partners: s.total_partners,
      with_profile: s.with_profile,
      without_profile: s.without_profile,
      with_email: s.with_email,
      with_phone: s.with_phone,
    })),
  };
}
