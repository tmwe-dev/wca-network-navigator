/**
 * Scrape cache management — reading and persisting cached scrapes.
 */
import { getScrapeCacheEntry, upsertScrapeCacheEntry } from "@/data/scrapeCache";

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
    await upsertScrapeCacheEntry({
      url,
      mode: "static",
      payload: { markdown, source: "sherlock-agentic", level, captured_at: new Date().toISOString() },
    });
  } catch {
    /* non-blocking */
  }
}
