/**
 * Scrape cache management — reading and persisting cached scrapes.
 */
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function checkCache(url: string): Promise<{ markdown: string } | null> {
  try {
    const { data } = await supabase.from("scrape_cache")
      .select("payload, scraped_at")
      .eq("url", url)
      .maybeSingle();

    if (!data) return null;

    const scrapedAt = (data as { scraped_at: string }).scraped_at;
    const age = Date.now() - new Date(scrapedAt).getTime();
    if (age > CACHE_TTL_MS) return null;

    const payload = (data as { payload: { markdown?: string } }).payload;
    if (!payload?.markdown) return null;

    return { markdown: payload.markdown };
  } catch {
    return null;
  }
}

export async function persistScrape(url: string, markdown: string, level: number): Promise<void> {
  try {
    // DRIFT: generated `scrape_cache` type has no declared unique key, so the typed
    // `.upsert()` overload cannot be resolved even though all columns are real.
    await untypedFrom("scrape_cache").upsert({
      url,
      mode: "static",
      payload: { markdown, source: "sherlock-agentic", level, captured_at: new Date().toISOString() },
      scraped_at: new Date().toISOString(),
    });
  } catch {
    /* non-blocking */
  }
}
