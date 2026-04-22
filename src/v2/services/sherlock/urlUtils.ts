/**
 * URL extraction and normalization utilities.
 */

const AGGREGATOR_DOMAINS = [
  "linkedin.com",
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "youtube.com",
  "wikipedia.org",
  "wikiwand.com",
  "yelp.com",
  "tripadvisor.",
  "pagine",
  "europages.",
  "kompass.",
  "yellowpages.",
  "bing.com",
  "duckduckgo.",
  "amazon.",
  "ebay.",
  "indeed.",
  "glassdoor.",
  "google.com/maps",
];

export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/^https?:$/.test(u.protocol)) return null;
    // remove fragment and trailing slash
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s;
  } catch {
    return null;
  }
}

export function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function isAggregator(url: string): boolean {
  const host = safeHost(url);
  if (!host) return true;
  return AGGREGATOR_DOMAINS.some((d) => host.includes(d));
}

/**
 * Extract internal links from markdown, deduplicates, normalizes.
 * Excludes aggregators and filters by base domain if provided.
 */
export function extractInternalLinks(markdown: string, baseHost: string | null): string[] {
  if (!markdown) return [];
  const out = new Set<string>();

  // markdown links [text](url)
  const reMd = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  // bare urls
  const reBare = /https?:\/\/[^\s)<>"'\]]+/g;

  const matches: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = reMd.exec(markdown)) !== null) matches.push(m[2]);
  while ((m = reBare.exec(markdown)) !== null) matches.push(m[0]);

  for (const raw of matches) {
    const cleaned = raw.replace(/[)\].,;:!?]+$/, "");
    const norm = normalizeUrl(cleaned);
    if (!norm) continue;
    if (isAggregator(norm)) continue;

    if (baseHost) {
      try {
        const h = new URL(norm).hostname.toLowerCase();
        // keep only same-host or subdomains of the same registrable
        if (!h.endsWith(baseHost) && !baseHost.endsWith(h)) continue;
      } catch {
        continue;
      }
    }

    out.add(norm);
  }

  return Array.from(out).slice(0, 80);
}

/**
 * Extract results from a scraped Google SERP.
 */
export function extractGoogleResults(markdown: string): { url: string; title: string; snippet: string }[] {
  if (!markdown) return [];
  const out: { url: string; title: string; snippet: string }[] = [];
  const reMd = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let m: RegExpExecArray | null;
  const seen = new Set<string>();

  while ((m = reMd.exec(markdown)) !== null) {
    const title = m[1].trim();
    const url = m[2].replace(/[)\].,;:!?]+$/, "");
    if (!url.startsWith("http")) continue;
    if (/google\.com\/(?:search|sorry|preferences)/i.test(url)) continue;
    if (/webcache\.googleusercontent/.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    if (title.length < 4 || title.length > 200) continue;
    out.push({ url, title, snippet: "" });
    if (out.length >= 20) break;
  }

  return out;
}

/**
 * Detect LinkedIn company URL from markdown.
 */
export function detectLinkedinCompanyUrl(markdown: string): string | null {
  if (!markdown) return null;
  const re = /https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[^\s)<>"'\]]+/i;
  const m = markdown.match(re);
  return m ? m[0].replace(/[)\].,;:!?]+$/, "") : null;
}
