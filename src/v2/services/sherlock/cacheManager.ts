/**
 * Scrape cache management — reading and persisting cached scrapes.
 */
import { untypedFrom } from "@/lib/supabaseUntyped";
import { getScrapeCacheEntry } from "@/data/scrapeCache";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function checkCache(url: string): Promise<{ markdown: string } | null> {
  try {
    const data = await getScrapeCacheEntry(url);

    if (!data) return null;

    const scrapedAt = data.scraped_at;
    const age = Date.now() - new Date(scrapedAt).getTime();
    if (age > CACHE_TTL_MS) return null;

    const payload = data.payload as { markdown?: string };
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
