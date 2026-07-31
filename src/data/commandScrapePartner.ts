/**
 * DAL — scrapePartner tool (partners + scrape_cache) della Command page.
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";

export interface ScrapePartnerRow {
  id: string;
  company_name: string;
  website: string | null;
  email: string | null;
  phone: string | null;
}

export async function getCachedScrapePayload(url: string): Promise<{ payload: Record<string, unknown>; scraped_at: string } | null> {
  const { data } = await untypedFrom("scrape_cache")
    .select("payload, scraped_at")
    .eq("url", url)
    .maybeSingle();
  return data as { payload: Record<string, unknown>; scraped_at: string } | null;
}

export async function setCachedScrapePayload(url: string, payload: Record<string, unknown>): Promise<void> {
  await untypedFrom("scrape_cache")
    .upsert({ url, payload, scraped_at: new Date().toISOString() });
}

export async function updatePartnerFields(partnerId: string, updateData: Record<string, string>): Promise<{ error: { message: string } | null }> {
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
