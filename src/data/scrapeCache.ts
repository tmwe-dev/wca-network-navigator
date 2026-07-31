/**
 * DAL — scrape_cache reads (shared cache lookup by url).
 */
import { supabase } from "@/integrations/supabase/client";

export interface ScrapeCacheEntry {
  payload: Record<string, unknown>;
  scraped_at: string;
}

export async function getScrapeCacheEntry(url: string): Promise<ScrapeCacheEntry | null> {
  const { data } = await supabase.from("scrape_cache")
    .select("payload, scraped_at")
    .eq("url", url)
    .maybeSingle();
  if (!data) return null;
  return data as ScrapeCacheEntry;
}
