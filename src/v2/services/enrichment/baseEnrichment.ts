/**
 * baseEnrichment — Pre-fill batch a costo zero per Partner WCA e Contatti.
 *
 * Filosofia:
 * - Zero AI calls (niente prompt, niente token)
 * - Zero hit a LinkedIn (solo Google search per scoprire lo slug)
 * - Solo fetch HTTP pubbliche (Google search via estensione, sito ufficiale, Clearbit)
 * - Idempotente: skip se il campo è già pieno
 * - Throttle 1 req/sec globale per Google, 1 req/sec per dominio per i siti
 *
 * Salva su:
 * - partners.enrichment_data.linkedin_url (slug azienda)
 * - partners.logo_url (Clearbit)
 * - partners.enrichment_data.website_excerpt { description, emails[], phones[] }
 * - imported_contacts.enrichment_data.linkedin_url (slug persona)
 */
import { updatePartner } from "@/data/partners";
import { updateContactEnrichment } from "@/data/contacts";
import { updateBusinessCard } from "@/data/businessCards";
import { supabase } from "@/integrations/supabase/client";

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

interface FsBridge {
  googleSearch: (query: string, limit: number, visible: boolean) => Promise<{ success: boolean; data?: Array<{ url: string; title: string; description: string }> }>;
  scrapeUrl: (url: string) => Promise<{ success: boolean; markdown?: string; metadata?: { title?: string; description?: string } }>;
}

// ── Throttle globale Google + per-domain ────────────────────────────────────

let lastGoogleAt = 0;
const GOOGLE_INTERVAL_MS = 1100;
const domainLastAt = new Map<string, number>();
const DOMAIN_INTERVAL_MS = 1100;

async function throttleGoogle(): Promise<void> {
  const now = Date.now();
  const wait = Math.max(0, GOOGLE_INTERVAL_MS - (now - lastGoogleAt));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGoogleAt = Date.now();
}

async function throttleDomain(domain: string): Promise<void> {
  const now = Date.now();
  const last = domainLastAt.get(domain) ?? 0;
  const wait = Math.max(0, DOMAIN_INTERVAL_MS - (now - last));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  domainLastAt.set(domain, Date.now());
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

function isLinkedInCompanyUrl(url: string, companyHint: string): boolean {
  if (!/linkedin\.com\/(company|school)\//i.test(url)) return false;
  // Permissivo: accetta tutto ciò che è sotto /company/, l'hint è solo per ranking
  return true;
}

function isLinkedInPersonUrl(url: string): boolean {
  return /linkedin\.com\/in\//i.test(url);
}

// ── Google search via estensione (no AI) ────────────────────────────────────

async function googleSearch(fs: FsBridge, query: string, limit = 5): Promise<Array<{ url: string; title: string; snippet: string }>> {
  await throttleGoogle();
  try {
    const res = await fs.googleSearch(query, limit, false);
    if (res?.success && Array.isArray(res.data)) {
      return res.data.map((r) => ({ url: r.url || "", title: r.title || "", snippet: r.description || "" }));
    }
  } catch { /* fallthrough */ }
  return [];
}

// ── Step 1: slug LinkedIn azienda (no LinkedIn login) ───────────────────────

export async function findCompanyLinkedInSlug(fs: FsBridge, companyName: string): Promise<string | null> {
  if (!companyName || companyName.length < 2) return null;
  const q = `site:linkedin.com/company "${companyName}"`;
  const results = await googleSearch(fs, q, 5);
  for (const r of results) {
    if (isLinkedInCompanyUrl(r.url, companyName)) {
      return r.url.split("?")[0].replace(/\/$/, "");
    }
  }
  return null;
}

// ── Step 2: slug LinkedIn persona ───────────────────────────────────────────

export async function findPersonLinkedInSlug(
  fs: FsBridge,
  personName: string,
  companyHint?: string,
): Promise<string | null> {
  if (!personName || personName.length < 3) return null;
  const queries = [
    companyHint ? `"${personName}" "${companyHint}" site:linkedin.com/in` : null,
    `"${personName}" site:linkedin.com/in`,
  ].filter((q): q is string => !!q);

  for (const q of queries) {
    const results = await googleSearch(fs, q, 5);
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
  // Prima Clearbit (HEAD): se 200, usalo. Se 404, fallback favicon.
  const clearbitUrl = `https://logo.clearbit.com/${d}`;
  try {
    const res = await fetch(clearbitUrl, { method: "HEAD", mode: "no-cors" });
    // mode no-cors: opaque response, status non leggibile → assumiamo OK e proviamo
    if (res.type === "opaque" || res.ok) return clearbitUrl;
  } catch { /* ignore */ }
  return `https://www.google.com/s2/favicons?domain=${d}&sz=128`;
}

// ── Step 4: mini-scrape sito (homepage + /about + /contact) ─────────────────

export async function scrapeSiteExcerpt(fs: FsBridge, domain: string): Promise<WebsiteExcerpt | null> {
  if (!domain) return null;
  const d = extractDomain(domain);
  if (!d) return null;

  const pages = [`https://${d}/`, `https://${d}/about`, `https://${d}/contact`];
  let collectedText = "";
  let title = "";

  for (const url of pages) {
    await throttleDomain(d);
    try {
      const sc = await fs.scrapeUrl(url);
      if (sc.success) {
        if (!title && sc.metadata?.title) title = sc.metadata.title;
        collectedText += "\n" + (sc.markdown || "");
        if (collectedText.length > 8000) break;
      }
    } catch { /* skip page */ }
  }

  if (!collectedText.trim()) return null;

  const emails = dedupe([...collectedText.matchAll(EMAIL_RX)].map((m) => m[0]))
    .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg"))
    .slice(0, 10);
  const phones = dedupe([...collectedText.matchAll(PHONE_RX)].map((m) => m[0])).slice(0, 5);

  // Description: prima frase utile dal markdown (non heading vuoti)
  const cleanText = collectedText
    .replace(/^#{1,6}\s.*$/gm, "")
    .replace(/!\[.*?\]\(.*?\)/g, "")
    .replace(/\[.*?\]\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const description = cleanText.slice(0, 400) || title || undefined;

  return { description, emails, phones, scraped_at: new Date().toISOString() };
}

// ── Orchestrazione per singolo target ───────────────────────────────────────

export async function enrichBaseTarget(
  fs: FsBridge,
  target: BaseEnrichTarget,
): Promise<BaseEnrichResult> {
  const errors: string[] = [];
  let slugFound = false;
  let logoFound = false;
  let siteScraped = false;

  // ── Slug LinkedIn (skip se già presente) ──
  if (!target.hasLinkedin) {
    try {
      const company = target.companyName || target.name;
      const slug = target.source === "wca"
        ? await findCompanyLinkedInSlug(fs, company)
        : await findPersonLinkedInSlug(fs, target.name, target.companyName);
      if (slug) {
        slugFound = true;
        if (target.source === "wca") {
          await updatePartnerEnrichment(target.id, { linkedin_url: slug });
        } else {
          await updateContactEnrichment(target.id, { linkedin_url: slug });
        }
      }
    } catch (e) {
      errors.push(`slug: ${(e as Error).message}`);
    }
  }

  // ── Logo (solo per WCA/aziende, skip se presente) ──
  if (target.source === "wca" && !target.hasLogo && target.domain) {
    try {
      const logoUrl = await findCompanyLogo(target.domain);
      if (logoUrl) {
        await updatePartner(target.id, { logo_url: logoUrl });
        logoFound = true;
      }
    } catch (e) {
      errors.push(`logo: ${(e as Error).message}`);
    }
  }

  // ── Mini-scrape sito (solo WCA, solo se non già fatto e c'è un dominio) ──
  if (target.source === "wca" && !target.hasWebsiteExcerpt && target.domain) {
    try {
      const excerpt = await scrapeSiteExcerpt(fs, target.domain);
      if (excerpt) {
        await updatePartnerEnrichment(target.id, { website_excerpt: excerpt });
        siteScraped = true;
      }
    } catch (e) {
      errors.push(`site: ${(e as Error).message}`);
    }
  }

  return { id: target.id, slugFound, logoFound, siteScraped, errors };
}

// ── Helper: merge enrichment_data per partner (read-modify-write) ───────────

async function updatePartnerEnrichment(partnerId: string, patch: Record<string, unknown>): Promise<void> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase
    .from("partners")
    .select("enrichment_data")
    .eq("id", partnerId)
    .single();
  const existing = (data?.enrichment_data as Record<string, unknown>) || {};
  const merged = { ...existing, ...patch };
  await updatePartner(partnerId, { enrichment_data: merged as never });
}
