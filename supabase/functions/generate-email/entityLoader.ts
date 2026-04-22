/**
 * entityLoader.ts — Load partner and contact data from various sources.
 *
 * Handles loading from activities, imported contacts, prospects, and standalone partners.
 * Normalizes data to PartnerData and ContactData shape.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import type { PartnerData, ContactData } from "./promptBuilder.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface BusinessCardRow {
  contact_name: string | null;
  event_name: string | null;
  met_at: string | null;
  location: string | null;
}

export interface LoadedEntity {
  partner: PartnerData | null;
  contact: ContactData | null;
  contactEmail: string | null;
  sourceType: string;
  activityPartnerId?: string | null;
}

export async function loadEntityFromActivity(
  supabase: SupabaseClient,
  activityId: string,
): Promise<LoadedEntity> {
  const { data: actData, error: actErr } = await supabase
    .from("activities")
    .select(
      `*, partners(id, company_name, company_alias, country_code, country_name, city, email, phone, website, profile_description, rating, raw_profile_markdown), selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, direct_phone, mobile, title, contact_alias)`,
    )
    .eq("id", activityId)
    .single();

  if (actErr || !actData) throw new Error("Activity not found");
  const activity = actData as Record<string, unknown>;
  let partner: PartnerData | null = activity.partners;
  let contact: ContactData | null = activity.selected_contact;
  let contactEmail: string | null = null;
  const sourceType = activity.source_type || "partner";

  if (sourceType === "contact" && activity.source_id) {
    const { data: ic } = await supabase
      .from("imported_contacts")
      .select("id, company_name, company_alias, name, contact_alias, email, phone, mobile, country, city, position, origin, note")
      .eq("id", activity.source_id)
      .single();
    if (ic) {
      partner = {
        id: ic.id,
        company_name: ic.company_name || "Azienda sconosciuta",
        company_alias: ic.company_alias,
        country_code: ic.country || "??",
        country_name: ic.country || "Sconosciuto",
        city: ic.city || "",
        email: ic.email,
        phone: ic.phone,
        website: null,
        profile_description: ic.note,
        rating: null,
        raw_profile_markdown: null,
      };
      contact = {
        id: ic.id,
        name: ic.name || ic.company_name || "",
        email: ic.email,
        direct_phone: ic.phone,
        mobile: ic.mobile,
        title: ic.position,
        contact_alias: ic.contact_alias,
      };
      contactEmail = ic.email;
    }
  }

  if (sourceType === "prospect" && activity.source_id) {
    const { data: prospect } = await supabase
      .from("prospects")
      .select(
        "id, company_name, city, province, region, email, phone, website, codice_ateco, descrizione_ateco, fatturato, dipendenti",
      )
      .eq("id", activity.source_id)
      .single();
    if (prospect) {
      partner = {
        id: prospect.id,
        company_name: prospect.company_name,
        company_alias: null,
        country_code: "IT",
        country_name: "Italia",
        city: [prospect.city, prospect.province].filter(Boolean).join(", "),
        email: prospect.email,
        phone: prospect.phone,
        website: prospect.website,
        profile_description: [
          prospect.descrizione_ateco,
          prospect.fatturato ? `Fatturato: €${(prospect.fatturato / 1_000_000).toFixed(1)}M` : null,
          prospect.dipendenti ? `Dipendenti: ${prospect.dipendenti}` : null,
        ]
          .filter(Boolean)
          .join(" · "),
        rating: null,
        raw_profile_markdown: null,
      };
      contact = null;
      contactEmail = prospect.email;
      const { data: pContacts } = await supabase
        .from("prospect_contacts")
        .select("name, email, phone, role")
        .eq("prospect_id", prospect.id)
        .limit(1);
      if (pContacts?.[0]) {
        const pc = pContacts[0];
        contact = {
          id: prospect.id,
          name: pc.name,
          email: pc.email,
          direct_phone: pc.phone,
          mobile: null,
          title: pc.role,
          contact_alias: null,
        };
        contactEmail = pc.email || prospect.email;
      }
    }
  }

  if (sourceType === "partner" || !contactEmail) {
    contactEmail = contact?.email || partner?.email || null;
  }

  return { partner, contact, contactEmail, sourceType, activityPartnerId: activity.partner_id };
}

export async function loadStandalonePartner(
  supabase: SupabaseClient,
  partnerId: string,
  recipientName?: string,
): Promise<LoadedEntity> {
  const { data: realPartner } = await supabase
    .from("partners")
    .select(
      "id, company_name, company_alias, country_code, country_name, city, email, phone, website, profile_description, rating, raw_profile_markdown, enrichment_data, office_type, lead_status",
    )
    .eq("id", partnerId)
    .single();

  if (!realPartner) {
    return { partner: null, contact: null, contactEmail: null, sourceType: "standalone" };
  }

  const partner = realPartner as PartnerData;
  let contact: ContactData | null = null;
  let contactEmail = partner.email;

  const { data: contacts } = await supabase
    .from("partner_contacts")
    .select("id, name, email, direct_phone, mobile, title, contact_alias")
    .eq("partner_id", partnerId)
    .limit(5);

  if (contacts?.length) {
    const matched = recipientName
      ? contacts.find(
          (c: Record<string, unknown>) =>
            c.name?.toLowerCase().includes(recipientName.toLowerCase()) ||
            c.contact_alias?.toLowerCase().includes(recipientName.toLowerCase()),
        ) || contacts[0]
      : contacts[0];
    contact = matched as ContactData;
    contactEmail = contact.email || partner.email;
  }

  return { partner, contact, contactEmail, sourceType: "partner" };
}

export async function loadMetInPerson(
  supabase: SupabaseClient,
  partnerId: string | null,
): Promise<string> {
  if (!partnerId) return "";
  const { data: bcaRows } = await supabase
    .from("business_cards")
    .select("contact_name, event_name, met_at, location")
    .eq("matched_partner_id", partnerId)
    .limit(3);
  if (!bcaRows?.length) return "";
  const encounters = (bcaRows as BusinessCardRow[])
    .map((bc) => {
      const parts: string[] = [];
      if (bc.event_name) parts.push(`Evento: ${bc.event_name}`);
      if (bc.contact_name) parts.push(`Contatto: ${bc.contact_name}`);
      if (bc.met_at) parts.push(`Data: ${bc.met_at}`);
      if (bc.location) parts.push(`Luogo: ${bc.location}`);
      return parts.join(", ");
    })
    .join("\n");
  return `\nINCONTRO DI PERSONA:\nIncontri registrati con questa azienda:\n${encounters}\n`;
}
