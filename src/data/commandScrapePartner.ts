/**
 * DAL — scrapePartner tool (partners + scrape_cache) della Command page.
 */
import { supabase } from "@/integrations/supabase/client";
import { toJsonValue } from "@/lib/jsonGuards";
import type { Database } from "@/integrations/supabase/types";

type PartnerUpdate = Database["public"]["Tables"]["partners"]["Update"];

export interface ScrapePartnerRow {
  id: string;
  company_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
}

export async function getCachedScrapePayload(url: string): Promise<{ payload: Record<string, unknown>; scraped_at: string } | null> {
  const { data } = await supabase
    .from("scrape_cache")
    .select("payload, scraped_at")
    .eq("url", url)
    .maybeSingle();
  if (!data) return null;
  return { payload: (data.payload ?? {}) as Record<string, unknown>, scraped_at: data.scraped_at };
}

export async function setCachedScrapePayload(url: string, payload: Record<string, unknown>): Promise<void> {
  await supabase
    .from("scrape_cache")
    .upsert({ url, payload: toJsonValue(payload), scraped_at: new Date().toISOString() });
}

export async function updatePartnerFields(partnerId: string, updateData: PartnerUpdate): Promise<{ error: { message: string } | null }> {
  return await supabase
    .from("partners")
    .update(updateData)
    .eq("id", partnerId);
}

export async function findPartnerBySearchTerm(searchTerm: string): Promise<ScrapePartnerRow | null> {
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, website, email, phone")
    .or(`company_name.ilike.%${searchTerm}%,company_alias.ilike.%${searchTerm}%`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
}
