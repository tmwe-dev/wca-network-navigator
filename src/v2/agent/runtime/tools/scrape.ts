/**
 * Scrape tool for agent loop — calls scrape-website edge function with cache.
 */
import { supabase } from "@/integrations/supabase/client";
import type { AgentTool, AgentToolResult } from "./index";

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** In-memory rate limit: 1 req/sec per domain */
const lastCallByDomain = new Map<string, number>();

function getDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

async function getCachedScrape(url: string): Promise<Record<string, unknown> | null> {
  const { data } = await supabase
    .from("scrape_cache")
    .select("payload, scraped_at")
    .eq("url", url)
    .maybeSingle();

  if (!data) return null;
  const rec = data as { payload: Record<string, unknown>; scraped_at: string };
  const age = Date.now() - new Date(rec.scraped_at).getTime();
  if (age > CACHE_TTL_MS) return null;
  return rec.payload;
}

async function setCachedScrape(url: string, payload: Record<string, unknown>): Promise<void> {
  await supabase
    .from("scrape_cache")
    .upsert({ url, payload, scraped_at: new Date().toISOString() } as never);
}

export const scrapeUrlTool: AgentTool = {
  name: "scrape_url",
  description: "Scrape a website URL to extract title, headings, emails, phones, and text content. Results are cached for 7 days.",
  parameters: {
    url: { type: "string", description: "Full URL to scrape (https://...)", required: true },
    mode: { type: "string", description: "'static' or 'render' (default: static)", required: false },
  },
  requiresApproval: true,
  execute: async (args): Promise<AgentToolResult> => {
    const url = String(args.url ?? "");
    const mode = String(args.mode ?? "static");

    if (!url.startsWith("http")) {
      return { success: false, error: "URL deve iniziare con http:// o https://" };
    }

    // Cache lookup
    const cached = await getCachedScrape(url);
    if (cached) {
      return {
        success: true,
        data: {
          url,
          cached: true,
          title: cached.title,
          description: cached.description,
          emails: cached.emails,
          phones: cached.phones,
          headings: (cached.headings as string[] | undefined)?.slice(0, 20),
          rawText: (cached.rawText as string | undefined)?.slice(0, 3000),
        },
      };
    }

    // Rate limit per domain
    const domain = getDomain(url);
    const lastCall = lastCallByDomain.get(domain) ?? 0;
    const elapsed = Date.now() - lastCall;
    if (elapsed < 1000) {
      await new Promise((r) => setTimeout(r, 1000 - elapsed));
    }
    lastCallByDomain.set(domain, Date.now());

    try {
      const { data, error } = await supabase.functions.invoke("scrape-website", {
        body: { url, mode },
      });

      if (error) return { success: false, error: error.message };

      const payload = data as Record<string, unknown>;
      // Store in cache
      await setCachedScrape(url, payload);

      return {
        success: true,
        data: {
          url,
          cached: false,
          title: payload.title,
          description: payload.description,
          emails: payload.emails,
          phones: payload.phones,
          headings: (payload.headings as string[] | undefined)?.slice(0, 20),
          rawText: (payload.rawText as string | undefined)?.slice(0, 3000),
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
