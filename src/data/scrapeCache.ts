/**
 * DAL — scrape_cache reads (shared cache lookup by url).
 */
import { supabase } from "@/integrations/supabase/client";
import { asJsonObject, toJsonValue } from "@/lib/typedJson";

export interface ScrapeCacheEntry {
  payload: Record<string, unknown>;
  scraped_at: string;
}

export async function getScrapeCacheEntry(url: string): Promise<ScrapeCacheEntry | null> {
  const { data } = await supabase.from("scrape_cache").select("payload, scraped_at").eq("url", url).maybeSingle();
  if (!data) return null;
  return { payload: asJsonObject(data.payload), scraped_at: data.scraped_at };
}

/**
 * Upsert su `scrape_cache` (PK = url, verificata sullo schema live).
 * Non solleva: la cache è best-effort e non deve mai bloccare il chiamante.
 */
export async function upsertScrapeCacheEntry(input: {
  url: string;
  payload: Record<string, unknown>;
  mode?: string;
  scrapedAt?: string;
}): Promise<void> {
  await supabase.from("scrape_cache").upsert({
    url: input.url,
    mode: input.mode ?? "static",
    payload: toJsonValue(input.payload),
    scraped_at: input.scrapedAt ?? new Date().toISOString(),
  });
}
