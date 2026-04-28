import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const USER_AGENT = "WCA-NetworkNavigator/1.0";
const FETCH_TIMEOUT_MS = 25_000;
const MAX_RAW_TEXT = 8_000;
const CACHE_TTL_DAYS = 7;

/* ── in-memory rate limit: 1 req/sec per domain ── */
const lastFetchByDomain = new Map<string, number>();

function rateLimitDomain(hostname: string): boolean {
  const now = Date.now();
  const last = lastFetchByDomain.get(hostname) ?? 0;
  if (now - last < 1_000) return false;
  lastFetchByDomain.set(hostname, now);
  return true;
}

/* ── robots.txt check ── */
async function isAllowedByRobots(parsed: URL): Promise<boolean> {
  try {
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`;
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return true; // no robots.txt → allowed
    const txt = await res.text();
    const lines = txt.split("\n");
    let inWildcard = false;
    for (const raw of lines) {
      const line = raw.trim().toLowerCase();
      if (line.startsWith("user-agent:")) {
        const ua = line.slice(11).trim();
        inWildcard = ua === "*" || ua === "wca-networknavigator";
      }
      if (inWildcard && line.startsWith("disallow:")) {
        const path = line.slice(9).trim();
        if (path === "/" || (path && parsed.pathname.startsWith(path))) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return true; // can't fetch robots → allow
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Per-user rate limit: 60 req/min
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  let userId = "anonymous";
  if (token) {
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY") ?? "");
      const { data: { user } } = await sb.auth.getUser(token);
      if (user) userId = user.id;
    } catch { /* ignore */ }
  }
  const rl = checkRateLimit(`scrape-website:${userId}`, { maxTokens: 60, refillRate: 1 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const startMs = Date.now();
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const body = await req.json();
    const url = body.url as string | undefined;
    const mode = (body.mode as string) ?? "static";
    const selectors = Array.isArray(body.selectors) ? body.selectors as string[] : [];

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "url required" }), { status: 400, headers });
    }

    let parsed: URL;
    try { parsed = new URL(url); } catch {
      return new Response(JSON.stringify({ error: "Invalid URL" }), { status: 400, headers });
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response(JSON.stringify({ error: "Only http/https URLs" }), { status: 400, headers });
    }

    /* ── rate limit ── */
    if (!rateLimitDomain(parsed.hostname)) {
      return new Response(JSON.stringify({ error: "Rate limit: 1 req/sec per dominio" }), { status: 429, headers });
    }

    /* ── cache lookup ── */
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cached } = await supabaseAdmin
      .from("scrape_cache")
      .select("payload, scraped_at")
      .eq("url", url)
      .maybeSingle();

    if (cached) {
      const age = Date.now() - new Date(cached.scraped_at).getTime();
      if (age < CACHE_TTL_DAYS * 86_400_000) {
        
        return new Response(JSON.stringify({ ...cached.payload, fromCache: true }), { headers });
      }
    }

    /* ── robots.txt ── */
    const allowed = await isAllowedByRobots(parsed);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Scraping non consentito da robots.txt" }), { status: 403, headers });
    }

    /* ── fetch HTML (static mode or render fallback) ── */
    let html: string;

    if (mode === "render") {
      const browserlessUrl = Deno.env.get("BROWSERLESS_URL");
      const browserlessToken = Deno.env.get("BROWSERLESS_TOKEN");
      if (browserlessUrl && browserlessToken) {
        try {
          const contentRes = await fetch(`${browserlessUrl}/content?token=${browserlessToken}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, waitFor: 3000 }),
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          });
          html = await contentRes.text();
        } catch {
          // fallback to static
          const res = await fetch(url, {
            headers: { "User-Agent": USER_AGENT },
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            redirect: "follow",
          });
          html = await res.text();
        }
      } else {
        // no browserless env → static fallback with warning
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT },
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
          redirect: "follow",
        });
        html = await res.text();
      }
    } else {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      html = await res.text();
    }

    /* ── parse with cheerio ── */
    const $ = cheerio.load(html);

    const title = $("title").first().text().trim();
    const description = $('meta[name="description"]').attr("content")?.trim() ?? "";
    const ogTitle = $('meta[property="og:title"]').attr("content")?.trim() ?? "";
    const ogDescription = $('meta[property="og:description"]').attr("content")?.trim() ?? "";

    // headings
    const headings: string[] = [];
    $("h1, h2, h3").each((_i: number, el: cheerio.Element) => {
      const t = $(el).text().trim();
      if (t) headings.push(t);
    });

    // links
    const links: string[] = [];
    $("a[href]").each((_i: number, el: cheerio.Element) => {
      const href = $(el).attr("href");
      if (href && (href.startsWith("http") || href.startsWith("/"))) {
        links.push(href);
      }
    });

    // emails
    const emails = Array.from(
      new Set(
        (html.match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z]{2,}/g) ?? [])
          .filter((e: string) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.endsWith(".gif")),
      ),
    );

    // phones
    const phones = Array.from(
      new Set(
        (html.match(/(\+?\d[\d\s().-]{7,}\d)/g) ?? []).map((p: string) => p.trim()),
      ),
    );

    // custom selectors
    const selectorResults: Record<string, string[]> = {};
    for (const sel of selectors) {
      const found: string[] = [];
      $(sel).each((_i: number, el: cheerio.Element) => {
        found.push($(el).text().trim());
      });
      selectorResults[sel] = found;
    }

    // raw text (capped)
    const rawText = $("body").text().replace(/\s+/g, " ").trim().slice(0, MAX_RAW_TEXT);

    const payload = {
      url,
      mode,
      title,
      description,
      ogTitle,
      ogDescription,
      emails,
      phones,
      headings: headings.slice(0, 50),
      links: links.slice(0, 100),
      rawText,
      selectorResults,
      length: html.length,
      durationMs: Date.now() - startMs,
      timestamp: new Date().toISOString(),
    };

    /* ── upsert cache ── */
    await supabaseAdmin
      .from("scrape_cache")
      .upsert({ url, mode, payload, scraped_at: new Date().toISOString() }, { onConflict: "url" });

    

    return new Response(JSON.stringify(payload), { headers });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "scrape failed";
    console.error(JSON.stringify({ fn: "scrape-website", error: msg }));
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers });
  }
});
