/**
 * baseEnrichment — Pre-fill batch a costo zero per Partner WCA, BCA e Contatti.
 *
 * USA ESATTAMENTE LO STESSO BRIDGE DI EMAIL FORGE / DEEP SEARCH:
 *  - hook `useFireScrapeExtensionBridge` (NON il wrapper `@/v2/io/extensions/bridge`)
 *  - `googleSearch(query, limit, skipCache=false)` action nativa
 *  - `agentAction({ action: "navigate", url, background: true, reuseTab: true })`
 *  - `scrape(skipCache=true)` per leggere il markdown della pagina caricata
 *  - cache `scrape_cache` (TTL 7gg) condivisa
 *
 * Filosofia:
 * - Zero AI calls
 * - Idempotente: skip se il campo è già pieno
 * - Logging dettagliato di ogni step
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
  readonly logs: readonly string[];
}

export interface WebsiteExcerpt {
  readonly description?: string;
  readonly emails: readonly string[];
  readonly phones: readonly string[];
  readonly scraped_at: string;
}

/**
 * Sottoinsieme del bridge usato da Email Forge / DeepSearch
 * (`useFireScrapeExtensionBridge`). Le risposte sono oggetti
 * `{ success: boolean, error?, data?, markdown?, ... }`.
 */
export interface FsBridge {
  readonly isAvailable: boolean;
  googleSearch: (query: string, limit?: number, skipCache?: boolean) => Promise<{
    success: boolean;
    error?: string;
    data?: Array<{ url?: string; title?: string; description?: string }>;
  }>;
  agentAction: (step: { action: string; [k: string]: unknown }) => Promise<{ success: boolean; error?: string }>;
  scrape: (skipCache?: boolean) => Promise<{
    success: boolean;
    error?: string;
    markdown?: string;
    metadata?: { title?: string; description?: string; url?: string };
  }>;
}

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ── Cache helpers (stessa tabella di Sherlock) ───────────────────────────────

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
 * Lettura unificata di un URL — STESSO metodo di Email Forge / DeepSearch:
 *   navigate(background:true, reuseTab:true) → delay → scrape(skipCache:true)
 */
async function readUrlSmart(
  bridge: FsBridge,
  url: string,
  log: (msg: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const cached = await checkCache(url);
  if (cached) {
    log(`📦 cache hit · ${url}`);
    return cached;
  }
  log(`🌐 navigate · ${url}`);
  const nav = await bridge.agentAction({ action: "navigate", url, background: true, reuseTab: true });
  if (!nav.success) {
    log(`✗ navigate fallita: ${nav.error || "errore sconosciuto"}`);
    return "";
  }
  await new Promise<void>((res) => {
    const t = setTimeout(res, 2000);
    signal?.addEventListener("abort", () => { clearTimeout(t); res(); }, { once: true });
  });
  if (signal?.aborted) return "";
  const sc = await bridge.scrape(true);
  if (!sc.success) {
    log(`✗ scrape fallito: ${sc.error || "errore sconosciuto"}`);
    return "";
  }
  const md = sc.markdown || "";
  if (md) {
    log(`✓ scrape ok · ${md.length} chars`);
    persistScrape(url, md).catch(() => null);
  } else {
    log(`⚠ scrape vuoto`);
  }
  return md;
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

// ── Google search via action nativa estensione (stesso metodo Email Forge) ──

async function googleSearch(
  bridge: FsBridge,
  query: string,
  log: (msg: string) => void,
  limit = 5,
): Promise<Array<{ url: string; title: string; snippet: string }>> {
  log(`🔍 google: ${query}`);
  try {
    const res = await bridge.googleSearch(query, limit, false);
    if (res?.success && Array.isArray(res.data)) {
      log(`  → ${res.data.length} risultati`);
      return res.data.map((r) => ({ url: r.url || "", title: r.title || "", snippet: r.description || "" }));
    }
    log(`  → 0 risultati (${res?.error || "no data"})`);
  } catch (e) {
    log(`  ✗ errore: ${(e as Error).message}`);
  }
  return [];
}

// ── Step 1: slug LinkedIn azienda ───────────────────────────────────────────

export async function findCompanyLinkedInSlug(
  bridge: FsBridge,
  companyName: string,
  log: (msg: string) => void,
): Promise<string | null> {
  if (!companyName || companyName.length < 2) return null;
  const q = `site:linkedin.com/company "${companyName}"`;
  const results = await googleSearch(bridge, q, log, 5);
  for (const r of results) {
    if (isLinkedInCompanyUrl(r.url)) {
      const slug = r.url.split("?")[0].replace(/\/$/, "");
      log(`  ✓ slug: ${slug}`);
      return slug;
    }
  }
  return null;
}

// ── Step 2: slug LinkedIn persona ───────────────────────────────────────────

export async function findPersonLinkedInSlug(
  bridge: FsBridge,
  personName: string,
  log: (msg: string) => void,
  companyHint?: string,
): Promise<string | null> {
  if (!personName || personName.length < 3) return null;
  const queries = [
    companyHint ? `"${personName}" "${companyHint}" site:linkedin.com/in` : null,
    `"${personName}" site:linkedin.com/in`,
  ].filter((q): q is string => !!q);

  for (const q of queries) {
    const results = await googleSearch(bridge, q, log, 5);
    for (const r of results) {
      if (isLinkedInPersonUrl(r.url)) {
        const slug = r.url.split("?")[0].replace(/\/$/, "");
        log(`  ✓ slug: ${slug}`);
        return slug;
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

export async function scrapeSiteExcerpt(
  bridge: FsBridge,
  domain: string,
  log: (msg: string) => void,
  signal?: AbortSignal,
): Promise<WebsiteExcerpt | null> {
  if (!domain) return null;
  const d = extractDomain(domain);
  if (!d) return null;

  const pages = [`https://${d}/`, `https://${d}/about`, `https://${d}/contact`];
  let collectedText = "";

  for (const url of pages) {
    if (signal?.aborted) break;
    const md = await readUrlSmart(bridge, url, log, signal);
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

export async function enrichBaseTarget(
  bridge: FsBridge,
  target: BaseEnrichTarget,
  signal?: AbortSignal,
  onLog?: (msg: string) => void,
): Promise<BaseEnrichResult> {
  const errors: string[] = [];
  const logs: string[] = [];
  const log = (m: string): void => {
    logs.push(m);
    if (onLog) onLog(m);
    // Console: utile per debugging dal devtools
    // eslint-disable-next-line no-console
    console.info(`[enrich:${target.source}:${target.name}] ${m}`);
  };

  let slugFound = false;
  let logoFound = false;
  let siteScraped = false;

  const isCompanyLike = target.source === "wca" || target.source === "bca";
  log(`▶ start (linkedin:${target.hasLinkedin?"✓":"✗"} logo:${target.hasLogo?"✓":"✗"} site:${target.hasWebsiteExcerpt?"✓":"✗"} domain:${target.domain || "—"})`);

  // Slug LinkedIn
  if (!target.hasLinkedin) {
    try {
      const company = target.companyName || target.name;
      const slug = isCompanyLike
        ? await findCompanyLinkedInSlug(bridge, company, log)
        : await findPersonLinkedInSlug(bridge, target.name, log, target.companyName);
      if (slug) {
        slugFound = true;
        await persistEnrichmentPatch(target.source, target.id, { linkedin_url: slug });
        log(`💾 saved linkedin_url`);
      } else {
        log(`✗ nessun slug LinkedIn trovato`);
      }
    } catch (e) {
      const msg = `slug: ${(e as Error).message}`;
      errors.push(msg);
      log(`✗ ${msg}`);
    }
  }

  // Logo (solo aziende)
  if (isCompanyLike && !target.hasLogo && target.domain) {
    try {
      const logoUrl = await findCompanyLogo(target.domain);
      if (logoUrl) {
        await persistEnrichmentPatch(target.source, target.id, {}, { logo_url: logoUrl });
        logoFound = true;
        log(`💾 saved logo_url`);
      }
    } catch (e) {
      const msg = `logo: ${(e as Error).message}`;
      errors.push(msg);
      log(`✗ ${msg}`);
    }
  }

  // Mini-scrape sito (solo aziende)
  if (isCompanyLike && !target.hasWebsiteExcerpt && target.domain) {
    try {
      const excerpt = await scrapeSiteExcerpt(bridge, target.domain, log, signal);
      if (excerpt) {
        await persistEnrichmentPatch(target.source, target.id, { website_excerpt: excerpt });
        siteScraped = true;
        log(`💾 saved website_excerpt (${excerpt.emails.length} email, ${excerpt.phones.length} tel)`);
      } else {
        log(`✗ excerpt vuoto`);
      }
    } catch (e) {
      const msg = `site: ${(e as Error).message}`;
      errors.push(msg);
      log(`✗ ${msg}`);
    }
  }

  log(`■ done (slug:${slugFound?"✓":"✗"} logo:${logoFound?"✓":"✗"} site:${siteScraped?"✓":"✗"})`);
  return { id: target.id, slugFound, logoFound, siteScraped, errors, logs };
}
