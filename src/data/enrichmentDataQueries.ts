/**
 * DAL — Queries for useEnrichmentData (Enrichment Settings).
 * Centralizes direct supabase.from() access previously in the hook.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PartnersRow = Database["public"]["Tables"]["partners"]["Row"];
type ImportedContactsRow = Database["public"]["Tables"]["imported_contacts"]["Row"];
type BusinessCardsRow = Database["public"]["Tables"]["business_cards"]["Row"];
type ChannelMessagesRow = Database["public"]["Tables"]["channel_messages"]["Row"];
type CockpitQueueRow = Database["public"]["Tables"]["cockpit_queue"]["Row"];

export type EnrichPartnerRow = Pick<PartnersRow, "id" | "company_name" | "email" | "website" | "country_code" | "logo_url" | "enrichment_data">;
export type EnrichContactRow = Pick<ImportedContactsRow, "id" | "name" | "company_name" | "email" | "enrichment_data" | "country">;
export type EnrichBcaRow = Pick<BusinessCardsRow, "id" | "company_name" | "contact_name" | "email" | "phone" | "mobile" | "location" | "matched_partner_id">;
export type EnrichEmailSenderRow = Pick<ChannelMessagesRow, "from_address">;
export type EnrichCockpitQueueRow = Pick<CockpitQueueRow, "id" | "source_id" | "source_type" | "partner_id" | "status">;
export type EnrichPartnerLookupRow = Pick<PartnersRow, "id" | "company_name" | "email" | "website">;

const PARTNER_SELECT = "id, company_name, email, website, country_code, logo_url, enrichment_data";
const CONTACT_SELECT = "id, name, company_name, email, enrichment_data, country";
const BCA_SELECT = "id, company_name, contact_name, email, phone, mobile, location, matched_partner_id";
const COCKPIT_SELECT = "id, source_id, source_type, partner_id, status";

/**
 * Iterative batch loader — fetches ALL rows from a table (Supabase 1000-row cap
 * workaround). Comportamento identico all'originale in useEnrichmentData.ts.
 */
async function loadAllPartners(batchSize = 1000): Promise<EnrichPartnerRow[]> {
  const all: EnrichPartnerRow[] = [];
  let page = 0;
  while (page < 200) {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await supabase.from("partners").select(PARTNER_SELECT).range(from, to).limit(batchSize);
    if (error) throw error;
    if (data && data.length) all.push(...data);
    if (!data || data.length < batchSize) break;
    page++;
  }
  return all;
}

async function loadAllContacts(batchSize = 1000): Promise<EnrichContactRow[]> {
  const all: EnrichContactRow[] = [];
  let page = 0;
  while (page < 200) {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from("imported_contacts")
      .select(CONTACT_SELECT)
      .or("name.not.is.null,company_name.not.is.null,email.not.is.null")
      .range(from, to)
      .limit(batchSize);
    if (error) throw error;
    if (data && data.length) all.push(...data);
    if (!data || data.length < batchSize) break;
    page++;
  }
  return all;
}

async function loadAllBusinessCards(batchSize = 1000): Promise<EnrichBcaRow[]> {
  const all: EnrichBcaRow[] = [];
  let page = 0;
  while (page < 200) {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await supabase.from("business_cards").select(BCA_SELECT).range(from, to).limit(batchSize);
    if (error) throw error;
    if (data && data.length) all.push(...data);
    if (!data || data.length < batchSize) break;
    page++;
  }
  return all;
}

async function loadAllEmailSenders(batchSize = 1000): Promise<EnrichEmailSenderRow[]> {
  const all: EnrichEmailSenderRow[] = [];
  let page = 0;
  while (page < 200) {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await supabase
      .from("channel_messages")
      .select("from_address")
      .not("from_address", "is", null)
      .range(from, to)
      .limit(batchSize);
    if (error) throw error;
    if (data && data.length) all.push(...data);
    if (!data || data.length < batchSize) break;
    page++;
  }
  return all;
}

async function loadAllCockpitQueue(batchSize = 1000): Promise<EnrichCockpitQueueRow[]> {
  const all: EnrichCockpitQueueRow[] = [];
  let page = 0;
  while (page < 200) {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    const { data, error } = await supabase.from("cockpit_queue").select(COCKPIT_SELECT).range(from, to).limit(batchSize);
    if (error) throw error;
    if (data && data.length) all.push(...data);
    if (!data || data.length < batchSize) break;
    page++;
  }
  return all;
}

export async function getEnrichmentPartners(): Promise<EnrichPartnerRow[]> {
  return loadAllPartners();
}

export async function getEnrichmentContacts(): Promise<EnrichContactRow[]> {
  return loadAllContacts();
}

export async function getEnrichmentBusinessCards(): Promise<EnrichBcaRow[]> {
  return loadAllBusinessCards();
}

export async function getEnrichmentEmailSenders(): Promise<EnrichEmailSenderRow[]> {
  return loadAllEmailSenders();
}

export async function getEnrichmentCockpitQueue(): Promise<EnrichCockpitQueueRow[]> {
  return loadAllCockpitQueue();
}

/** Batch lookup di partner (country_code, website, logo_url) per un set di ID, chunked a 200. */
export async function getPartnersLookupByIds(
  ids: string[],
): Promise<Map<string, { country_code: string | null; website: string | null; logo_url: string | null }>> {
  const pMap = new Map<string, { country_code: string | null; website: string | null; logo_url: string | null }>();
  for (let i = 0; i < ids.length; i += 200) {
    const slice = ids.slice(i, i + 200);
    const { data, error } = await supabase.from("partners").select("id, country_code, website, logo_url").in("id", slice);
    if (error) throw error;
    (data || []).forEach((p) => pMap.set(p.id, { country_code: p.country_code, website: p.website, logo_url: p.logo_url }));
  }
  return pMap;
}
