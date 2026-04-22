import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { escapeLike, resolvePartnerId } from "../shared.ts";
import { getPartnerDeepSearchScore, formatScoreForPrompt } from "../../_shared/deepSearchScore.ts";

interface _PartnerRow { id: string; company_name: string; city: string; country_code: string; country_name: string; email: string | null; phone: string | null; rating: number | null; wca_id: number | null; website: string | null; raw_profile_html: string | null; raw_profile_markdown?: string | null; is_favorite: boolean; office_type: string | null; lead_status: string | null; [key: string]: unknown; }

export async function handleSearchPartners(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const isCount = !!args.count_only;
  let query = supabase.from("partners").select(
    isCount ? "id" : "id, company_name, city, country_code, country_name, email, phone, rating, wca_id, website, raw_profile_html, is_favorite, office_type, lead_status",
    isCount ? { count: "exact", head: true } : undefined
  );
  if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
  if (args.city) query = query.ilike("city", `%${escapeLike(args.city as string)}%`);
  if (args.search_name) query = query.ilike("company_name", `%${escapeLike(args.search_name as string)}%`);
  if (args.has_email === true) query = query.not("email", "is", null);
  if (args.has_profile === true) query = query.not("raw_profile_html", "is", null);
  if (args.has_profile === false) query = query.is("raw_profile_html", null);
  if (args.is_favorite === true) query = query.eq("is_favorite", true);
  query = query.order("company_name").limit(Math.min(Number(args.limit) || 20, 50));
  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };
  return { count: data?.length || 0, partners: (data || []) as _PartnerRow[] };
}

export async function handleGetPartnerDetail(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  let partner: Record<string, unknown> | null = null;
  if (args.partner_id) {
    const { data } = await supabase.from("partners").select("*").eq("id", args.partner_id).single();
    partner = data;
  } else if (args.company_name) {
    const { data } = await supabase.from("partners").select("*").ilike("company_name", `%${escapeLike(args.company_name as string)}%`).limit(1).single();
    partner = data;
  }
  if (!partner) return { error: "Partner non trovato" };
  return partner;
}

export async function handleSearchContacts(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const isCount = !!args.count_only;
  let query = supabase.from("imported_contacts").select(isCount ? "id" : "id, name, company_name, email, phone, country, lead_status, created_at", isCount ? { count: "exact", head: true } : undefined);
  if (args.search_name) query = query.ilike("name", `%${escapeLike(args.search_name as string)}%`);
  if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name as string)}%`);
  if (args.country) query = query.ilike("country", `%${escapeLike(args.country as string)}%`);
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  if (args.has_email === true) query = query.not("email", "is", null);
  query = query.or("company_name.not.is.null,name.not.is.null,email.not.is.null");
  query = query.order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
  const { data, error, count } = await query;
  if (error) return { error: error.message };
  if (isCount) return { count };
  return { count: data?.length || 0, contacts: data || [] };
}

export async function handleGetContactDetail(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  let contact: Record<string, unknown> | null = null;
  if (args.contact_id) {
    const { data } = await supabase.from("imported_contacts").select("*").eq("id", args.contact_id).single();
    contact = data;
  } else if (args.contact_name) {
    const { data } = await supabase.from("imported_contacts").select("*").ilike("name", `%${escapeLike(args.contact_name as string)}%`).limit(1).single();
    contact = data;
  }
  if (!contact) return { error: "Contatto non trovato" };
  return contact;
}

export async function handleSearchProspects(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase.from("prospects").select("id, company_name, city, province, codice_ateco, fatturato, email, lead_status");
  if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name as string)}%`);
  if (args.city) query = query.ilike("city", `%${escapeLike(args.city as string)}%`);
  if (args.province) query = query.ilike("province", `%${escapeLike(args.province as string)}%`);
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  if (args.min_fatturato) query = query.gte("fatturato", Number(args.min_fatturato));
  query = query.limit(Math.min(Number(args.limit) || 20, 50));
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, prospects: data || [] };
}

export async function handleSearchMemory(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase.from("ai_memory").select("content, memory_type, tags, importance, created_at").eq("user_id", userId).order("importance", { ascending: false }).limit(Number(args.limit) || 10);
  if (args.tags && (args.tags as string[]).length > 0) query = query.overlaps("tags", args.tags as string[]);
  if (args.search_text) query = query.ilike("content", `%${escapeLike(args.search_text as string)}%`);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, memories: data || [] };
}

export async function handleSearchBusinessCards(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase.from("business_cards").select("id, company_name, contact_name, email, event_name, match_status, created_at").order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
  if (args.company_name) query = query.ilike("company_name", `%${escapeLike(args.company_name as string)}%`);
  if (args.event_name) query = query.ilike("event_name", `%${escapeLike(args.event_name as string)}%`);
  const { data, error } = await query;
  return error ? { error: error.message } : { count: data?.length || 0, cards: data || [] };
}

export async function handleDeepSearchPartner(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
  authHeader: string
): Promise<unknown> {
  let pid = args.partner_id as string;
  if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
  if (!pid) return { error: "Partner non trovato" };

  // LOVABLE-75: read-only — niente più chiamate edge live, leggi cosa c'è già.
  const { data: p } = await supabase
    .from("partners")
    .select("company_name, enrichment_data")
    .eq("id", pid)
    .maybeSingle();
  const ed = (p?.enrichment_data as Record<string, unknown>) || {};
  const websiteExcerpt = ed.website_excerpt as { description?: string } | undefined;
  const contactProfiles = ed.contact_profiles;
  const hasBase = !!(ed.linkedin_url || ed.logo_url || websiteExcerpt?.description);
  const hasDeep = !!(contactProfiles || ed.reputation || ed.google_maps || ed.website_quality_score);
  let suggestion: string;
  if (hasBase && hasDeep) {
    suggestion = `${p?.company_name ?? "Partner"} ha già dati Base + Deep Search completi. L'AI li vede automaticamente in Email Forge.`;
  } else if (!hasBase) {
    suggestion = `${p?.company_name ?? "Partner"} non ha l'arricchimento base. Esegui da Settings → Arricchimento (gratis, usa Google).`;
  } else {
    suggestion = `${p?.company_name ?? "Partner"} ha solo il base. Apri Email Forge e attiva "Deep Search aggiuntiva" — cercherà solo i dati mancanti.`;
  }

  // LOVABLE-88: calcola e restituisci lo score di qualità
  let scoreResult = null;
  let scoreFormatted = "";
  try {
    scoreResult = await getPartnerDeepSearchScore(supabase, pid, userId);
    scoreFormatted = formatScoreForPrompt(scoreResult);
  } catch (scoreErr) {
    console.warn("[deep_search_partner] score calc failed:", scoreErr);
  }

  return {
    success: true,
    partner_id: pid,
    company_name: p?.company_name ?? null,
    has_base: hasBase,
    has_deep_search: hasDeep,
    deep_search_at: ed.deep_search_at ?? null,
    base_enriched_at: ed.base_enriched_at ?? null,
    quality_score: scoreResult?.score ?? null,
    quality_level: scoreResult?.level ?? null,
    auto_enrich_suggested: scoreResult?.auto_enrich_suggested ?? false,
    missing_areas: scoreResult?.missing_areas ?? [],
    score_details: scoreFormatted,
    suggestion,
  };
}

export async function handleDeepSearchContact(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  let cid = args.contact_id as string;
  if (!cid && args.contact_name) {
    const { data } = await supabase.from("imported_contacts").select("id").ilike("name", `%${escapeLike(args.contact_name as string)}%`).limit(1).single();
    if (data) cid = data.id;
  }
  if (!cid) return { error: "Contatto non trovato" };

  // LOVABLE-75: la edge deep-search-contact è deprecata. Leggi snapshot.
  const { data: c } = await supabase
    .from("imported_contacts")
    .select("id, name, email, deep_search_at, wca_partner_id")
    .eq("id", cid)
    .maybeSingle();

  return {
    success: true,
    contact_id: cid,
    name: c?.name ?? null,
    deep_search_at: c?.deep_search_at ?? null,
    suggestion: c?.deep_search_at
      ? `${c?.name ?? "Contatto"} ha già un Deep Search registrato. Apri il record per consultarlo.`
      : `${c?.name ?? "Contatto"} non ha Deep Search. Esegui da Partner Connect (extension) — la funzione edge è deprecata.`,
  };
}
