/**
 * baseEnrichment — Pre-fill batch a costo zero per Partner WCA, BCA e Contatti.
 *
 * Usa lo STESSO sistema di scraping di Email Forge / Sherlock:
 *  - `extFs.readUrl()` (navigateBackground → settle → scrape) dal bridge unificato
 *  - cache `scrape_cache` (TTL 7gg) condivisa
 *  - `prettifyScrapedMarkdown` per pulizia output
 *  - `throttle` per rate limiting per-host / per-channel
 *  - `extFs.googleSearch` (action nativa dell'estensione) invece di scraping della SERP
 *
 * Filosofia:
 * - Zero AI calls
 * - Zero hit a LinkedIn (solo Google search per scoprire lo slug)
 * - Idempotente: skip se il campo è già pieno
 *
 * Salva su:
 * - partners.enrichment_data.linkedin_url + partners.logo_url + website_excerpt
 * - business_cards.raw_data.enrichment.{linkedin_url, logo_url, website_excerpt}
 * - imported_contacts.enrichment_data.linkedin_url
 */
import { updatePartner } from "@/data/partners";
import { updateContactEnrichment } from "@/data/contacts";
import { updateBusinessCard } from "@/data/businessCards";
import { supabase } from "@/integrations/supabase/client";
import { untypedFrom } from "@/lib/supabaseUntyped";
import { fs as extFs } from "@/v2/io/extensions/bridge";
import { throttle } from "@/v2/services/sherlock/rateLimiter";
import { prettifyScrapedMarkdown } from "@/v2/services/sherlock/markdownPrettify";

// ── Types ───────────────────────────────────────────────────────────────────

export type BaseEnrichSource = "wca" | "contacts" | "bca";

export interface BaseEnrichTarget {
  readonly id: string;
  readonly source: BaseEnrichSource;
  readonly name: string;
  readonly companyName?: string;
  readonly domain?: string | null;
  readonly email?: string;
  readonly hasLogo: boolean;
  readonly hasLinkedin: boolean;
  readonly hasWebsiteExcerpt?: boolean;
}

export interface BaseEnrichResult {
  readonly id: string;
  readonly slugFound: boolean;
  readonly logoFound: boolean;
  readonly siteScraped: boolean;
  readonly errors: readonly string[];
}

export interface WebsiteExcerpt {
  readonly description?: string;
  readonly emails: readonly string[];
  readonly phones: readonly string[];
  readonly scraped_at: string;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Cache helpers (stessa tabella di Sherlock) ───────────────────────────────

function extractMarkdown(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const d = data as Record<string, unknown>;
  if (typeof d.markdown === "string") return d.markdown;
  if (typeof d.content === "string") return d.content;
  if (d.result && typeof d.result === "object") {
    const r = d.result as Record<string, unknown>;
    if (typeof r.markdown === "string") return r.markdown;
  }
  return "";
}

async function checkCache(url: string): Promise<string | null> {
  try {
    const { data } = await untypedFrom("scrape_cache")
      .select("payload, scraped_at")
      .eq("url", url)
      .maybeSingle();
    if (!data) return null;
    const scrapedAt = (data as { scraped_at: string }).scraped_at;
    const age = Date.now() - new Date(scrapedAt).getTime();
    if (age > CACHE_TTL_MS) return null;
    const payload = (data as { payload: { markdown?: string } }).payload;
    return payload?.markdown ?? null;
  } catch {
    return null;
  }
}

async function persistScrape(url: string, markdown: string): Promise<void> {
  try {
    await untypedFrom("scrape_cache").upsert({
      url,
      mode: "static",
      payload: { markdown, source: "base-enrichment", captured_at: new Date().toISOString() },
      scraped_at: new Date().toISOString(),
    });
  } catch { /* non-blocking */ }
}

/**
 * Lettura unificata di un URL — STESSO metodo di Sherlock/Email Forge.
 * - Pre-check cache
 * - Throttle per canale/host
 * - extFs.readUrl (navigateBackground + scrape)
 * - prettifyScrapedMarkdown
 * - persistenza in scrape_cache
 */
async function readUrlSmart(url: string, channel: "google" | "generic" = "generic", signal?: AbortSignal): Promise<string> {
  const cached = await checkCache(url);
  if (cached) return cached;

  try { await throttle(channel, url, signal ?? new AbortController().signal); } catch { /* aborted */ }

  const res = await extFs.readUrl(url, { settleMs: 2000, skipCache: true, signal });
  if (!res.ok) return "";
  const raw = extractMarkdown(res.data);
  if (!raw) return "";
  const pretty = prettifyScrapedMarkdown(raw);
  if (pretty) persistScrape(url, pretty).catch(() => null);
  return pretty;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const EMAIL_RX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RX = /(?:\+|00)[\d][\d\s().-]{7,18}\d/g;

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.map((v) => v.trim().toLowerCase()))).filter(Boolean);
}

function extractDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "");
  return v || null;
}

function isLinkedInCompanyUrl(url: string): boolean {
  return /linkedin\.com\/(company|school)\//i.test(url);
}

function isLinkedInPersonUrl(url: string): boolean {
  return /linkedin\.com\/in\//i.test(url);
}

// ── Google search via action nativa estensione (stesso metodo Sherlock) ────

async function googleSearchNative(query: string, limit = 5): Promise<Array<{ url: string; title: string; snippet: string }>> {
  try {
    const res = await extFs.googleSearch(query, limit);
    if (res.ok) {
      const data = (res.data as { data?: Array<{ url?: string; title?: string; description?: string }> }).data;
      if (Array.isArray(data)) {
        return data.map((r) => ({ url: r.url || "", title: r.title || "", snippet: r.description || "" }));
      }
    }
  } catch { /* fallthrough */ }
  return [];
}

// ── Step 1: slug LinkedIn azienda ───────────────────────────────────────────

export async function findCompanyLinkedInSlug(companyName: string): Promise<string | null> {
  if (!companyName || companyName.length < 2) return null;
  const q = `site:linkedin.com/company "${companyName}"`;
  const results = await googleSearchNative(q, 5);
  for (const r of results) {
    if (isLinkedInCompanyUrl(r.url)) {
      return r.url.split("?")[0].replace(/\/$/, "");
    }
  }
  return null;
}

// ── Step 2: slug LinkedIn persona ───────────────────────────────────────────

export async function findPersonLinkedInSlug(personName: string, companyHint?: string): Promise<string | null> {
  if (!personName || personName.length < 3) return null;
  const queries = [
    companyHint ? `"${personName}" "${companyHint}" site:linkedin.com/in` : null,
    `"${personName}" site:linkedin.com/in`,
  ].filter((q): q is string => !!q);

  for (const q of queries) {
    const results = await googleSearchNative(q, 5);
    for (const r of results) {
      if (isLinkedInPersonUrl(r.url)) {
        return r.url.split("?")[0].replace(/\/$/, "");
      }
    }
  }
  return null;
}

// ── Step 3: logo (Clearbit con fallback Google Favicon) ─────────────────────

export async function findCompanyLogo(domain: string): Promise<string | null> {
  if (!domain) return null;
  const d = extractDomain(domain);
  if (!d) return null;
  const clearbitUrl = `https://logo.clearbit.com/${d}`;
  try {
    const res = await fetch(clearbitUrl, { method: "HEAD", mode: "no-cors" });
    if (res.type === "opaque" || res.ok) return clearbitUrl;
  } catch { /* ignore */ }
  return `https://www.google.com/s2/favicons?domain=${d}&sz=128`;
}

// ── Step 4: mini-scrape sito (homepage + /about + /contact) ─────────────────

export async function scrapeSiteExcerpt(domain: string, signal?: AbortSignal): Promise<WebsiteExcerpt | null> {
  if (!domain) return null;
  const d = extractDomain(domain);
  if (!d) return null;

  const pages = [`https://${d}/`, `https://${d}/about`, `https://${d}/contact`];
  let collectedText = "";

  for (const url of pages) {
    if (signal?.aborted) break;
    const md = await readUrlSmart(url, "generic", signal);
    if (md) {
      collectedText += "\n" + md;
      if (collectedText.length > 8000) break;
    }
  }

  if (!collectedText.trim()) return null;

  const emails = dedupe([...collectedText.matchAll(EMAIL_RX)].map((m) => m[0]))
    .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg"))
    .slice(0, 10);
  const phones = dedupe([...collectedText.matchAll(PHONE_RX)].map((m) => m[0])).slice(0, 5);

  const cleanText = collectedText
    .replace(/^#{1,6}\s.*$/gm, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const description = cleanText.slice(0, 400) || undefined;

  return { description, emails, phones, scraped_at: new Date().toISOString() };
}

// ── Persist patch generico per le tre sorgenti ──────────────────────────────

async function persistEnrichmentPatch(
  source: BaseEnrichSource,
  id: string,
  patch: Record<string, unknown>,
  topLevel: { logo_url?: string } = {},
): Promise<void> {
  if (source === "wca") {
    const { data } = await supabase.from("partners").select("enrichment_data").eq("id", id).single();
    const existing = (data?.enrichment_data as Record<string, unknown>) || {};
    const merged = { ...existing, ...patch };
    await updatePartner(id, { enrichment_data: merged as never, ...(topLevel.logo_url ? { logo_url: topLevel.logo_url } : {}) });
    return;
  }
  if (source === "bca") {
    const { data } = await supabase.from("business_cards").select("raw_data").eq("id", id).single();
    const raw = (data?.raw_data as Record<string, unknown>) || {};
    const enr = (raw.enrichment as Record<string, unknown>) || {};
    const mergedEnr = { ...enr, ...patch, ...(topLevel.logo_url ? { logo_url: topLevel.logo_url } : {}) };
    const mergedRaw = { ...raw, enrichment: mergedEnr };
    await updateBusinessCard(id, { raw_data: mergedRaw as never });
    return;
  }
  // contacts
  await updateContactEnrichment(id, patch);
}

// ── Orchestrazione per singolo target ───────────────────────────────────────

export async function enrichBaseTarget(target: BaseEnrichTarget, signal?: AbortSignal): Promise<BaseEnrichResult> {
  const errors: string[] = [];
  let slugFound = false;
  let logoFound = false;
  let siteScraped = false;

  const isCompanyLike = target.source === "wca" || target.source === "bca";

  // Slug LinkedIn
  if (!target.hasLinkedin) {
    try {
      const company = target.companyName || target.name;
      const slug = isCompanyLike
        ? await findCompanyLinkedInSlug(company)
        : await findPersonLinkedInSlug(target.name, target.companyName);
      if (slug) {
        slugFound = true;
        await persistEnrichmentPatch(target.source, target.id, { linkedin_url: slug });
      }
    } catch (e) {
      errors.push(`slug: ${(e as Error).message}`);
    }
  }

  // Logo (solo aziende)
  if (isCompanyLike && !target.hasLogo && target.domain) {
    try {
      const logoUrl = await findCompanyLogo(target.domain);
      if (logoUrl) {
        await persistEnrichmentPatch(target.source, target.id, {}, { logo_url: logoUrl });
        logoFound = true;
      }
    } catch (e) {
      errors.push(`logo: ${(e as Error).message}`);
    }
  }

  // Mini-scrape sito (solo aziende)
  if (isCompanyLike && !target.hasWebsiteExcerpt && target.domain) {
    try {
      const excerpt = await scrapeSiteExcerpt(target.domain, signal);
      if (excerpt) {
        await persistEnrichmentPatch(target.source, target.id, { website_excerpt: excerpt });
        siteScraped = true;
      }
    } catch (e) {
      errors.push(`site: ${(e as Error).message}`);
    }
  }

  return { id: target.id, slugFound, logoFound, siteScraped, errors };
}
