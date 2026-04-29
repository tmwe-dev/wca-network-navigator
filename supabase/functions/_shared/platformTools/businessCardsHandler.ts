/**
 * businessCardsHandler.ts - Business card-related tool handlers
 * Handles: search, detail.
 *
 * REWRITE 2026-04-29: handleSearchBusinessCards esteso con filtri match,
 * date evento. NUOVO handleGetBusinessCardDetail con OCR completo, partner
 * matchato e contact matchato joinati, channel_messages collegati.
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

export async function handleSearchBusinessCards(
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("business_cards")
    .select(
      "id, company_name, contact_name, email, phone, position, event_name, location, met_at, match_status, match_confidence, matched_partner_id, matched_contact_id, manually_corrected, lead_status, created_at",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(Math.min(Number(args.limit) || 20, 100));
  if (args.company_name)
    query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
  if (args.contact_name)
    query = query.ilike("contact_name", `%${escapeLike(String(args.contact_name))}%`);
  if (args.email) query = query.ilike("email", `%${escapeLike(String(args.email))}%`);
  if (args.event_name)
    query = query.ilike("event_name", `%${escapeLike(String(args.event_name))}%`);
  if (args.match_status) query = query.eq("match_status", args.match_status);
  if (args.has_partner_match === true) query = query.not("matched_partner_id", "is", null);
  if (args.has_partner_match === false) query = query.is("matched_partner_id", null);
  if (args.has_contact_match === true) query = query.not("matched_contact_id", "is", null);
  if (args.has_contact_match === false) query = query.is("matched_contact_id", null);
  if (args.met_after) query = query.gte("met_at", args.met_after);
  if (args.met_before) query = query.lte("met_at", args.met_before);
  if (args.lead_status) query = query.eq("lead_status", args.lead_status);
  const { data, error } = await query;
  return error ? { error: error.message } : { count: data?.length || 0, cards: data || [] };
}

export async function handleGetBusinessCardDetail(
  args: Record<string, unknown>
): Promise<unknown> {
  let card: Record<string, unknown> | null = null;
  if (args.card_id) {
    const { data } = await supabase
      .from("business_cards")
      .select("*")
      .eq("id", args.card_id as string)
      .maybeSingle();
    card = data as Record<string, unknown> | null;
  } else if (args.email) {
    const { data } = await supabase
      .from("business_cards")
      .select("*")
      .ilike("email", `%${escapeLike(String(args.email))}%`)
      .is("deleted_at", null)
      .order("met_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    card = data as Record<string, unknown> | null;
  } else if (args.contact_name) {
    const { data } = await supabase
      .from("business_cards")
      .select("*")
      .ilike("contact_name", `%${escapeLike(String(args.contact_name))}%`)
      .is("deleted_at", null)
      .order("met_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    card = data as Record<string, unknown> | null;
  }
  if (!card) return { error: "Business card non trovato" };

  const cardEmail = String(card.email || "").toLowerCase().trim();
  const matchedPartnerId = (card.matched_partner_id as string) || null;
  const matchedContactId = (card.matched_contact_id as string) || null;

  const [partnerRes, contactRes, messagesRes, eventsRes] = await Promise.all([
    matchedPartnerId
      ? supabase
          .from("partners")
          .select("id, company_name, country_code, city, rating, lead_status, member_since, membership_expires, email, phone, website")
          .eq("id", matchedPartnerId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    matchedContactId
      ? supabase
          .from("imported_contacts")
          .select("id, name, company_name, email, phone, lead_status, lead_score, origin, note")
          .eq("id", matchedContactId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    cardEmail
      ? supabase
          .from("channel_messages")
          .select("id, channel, direction, subject, from_address, to_address, email_date")
          .or(`from_address.ilike.%${cardEmail}%,to_address.ilike.%${cardEmail}%`)
          .is("deleted_at", null)
          .order("email_date", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    matchedPartnerId
      ? supabase
          .from("calendar_events")
          .select("id, title, event_type, start_at, status")
          .eq("partner_id", matchedPartnerId)
          .gte("start_at", new Date().toISOString())
          .order("start_at", { ascending: true })
          .limit(5)
      : Promise.resolve({ data: [] }),
  ]);

  return {
    id: card.id,
    contact_name: card.contact_name,
    company_name: card.company_name,
    email: card.email,
    phone: card.phone,
    mobile: card.mobile,
    position: card.position,
    event_name: card.event_name,
    met_at: card.met_at,
    location: card.location,
    notes: card.notes,
    correction_notes: card.correction_notes,
    manually_corrected: card.manually_corrected,
    photo_url: card.photo_url,
    raw_data: card.raw_data,
    ocr_confidence: card.ocr_confidence,
    tags: card.tags,
    lead_status: card.lead_status,

    match_status: card.match_status,
    match_confidence: card.match_confidence,
    matched_partner_id: matchedPartnerId,
    matched_contact_id: matchedContactId,
    matched_partner: partnerRes.data || null,
    matched_contact: contactRes.data || null,

    recent_messages: messagesRes.data || [],
    upcoming_events: eventsRes.data || [],

    created_at: card.created_at,
  };
}
