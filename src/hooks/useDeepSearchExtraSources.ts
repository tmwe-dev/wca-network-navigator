/**
 * useDeepSearchExtraSources — Funzioni di scraping aggiuntive per il Deep Search V2.
 * Tutte usano l'estensione Partner Connect (background tab nascosto, riusato).
 *
 * Fonti coperte:
 *  - googleGeneral: ricerca Google senza site:linkedin per menzioni varie
 *  - googleMaps: pannello laterale di Google Maps per indirizzo/tel/orari/rating
 *  - websiteMultiPage: scrape /about /team /contacts /chi-siamo + AI extract team
 *  - reputation: Trustpilot search + Wikipedia search
 *
 * Output: oggetto JSON che verrà fuso dentro `partners.enrichment_data`.
 */
import type { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { aiCall, delay, cleanCompanyName, type GoogleSearchResult } from "./useDeepSearchHelpers";

type FsBridge = ReturnType<typeof useFireScrapeExtensionBridge>;

export interface ContactMention { url: string; title: string; snippet: string; }

export interface GoogleMapsData {
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  rating: number | null;
  reviewsCount: number | null;
  category: string | null;
  placeUrl: string | null;
}

export interface WebsiteTeamMember { name: string; role: string; email?: string; }

export interface WebsiteMultiPageData {
  pagesScraped: string[];
  team: WebsiteTeamMember[];
  contactsExtra: { phones: string[]; emails: string[]; addresses: string[]; };
  about: string | null;
}

export interface ReputationData {
  trustpilot: { url: string; rating: number | null; reviewsCount: number | null; } | null;
  wikipedia: { url: string; summary: string | null; } | null;
  news: Array<{ title: string; url: string; date?: string }>;
}

/* ============================================================
 *  GOOGLE GENERALE — senza site:linkedin, per menzioni varie
 * ============================================================ */
export async function searchGoogleGeneral(
  fs: FsBridge,
  contactName: string,
  companyName: string,
  googleSearch: (q: string, limit?: number) => Promise<GoogleSearchResult[]>,
): Promise<ContactMention[]> {
  const cleanCo = cleanCompanyName(companyName);
  const q = `"${contactName}" "${cleanCo}" -site:linkedin.com`;
  const results = await googleSearch(q, 5);
  return results.slice(0, 5).map((r) => ({ url: r.url, title: r.title, snippet: r.snippet }));
}

/* ============================================================
 *  GOOGLE MAPS — pannello laterale Place
 * ============================================================ */
export async function scrapeGoogleMaps(
  fs: FsBridge,
  companyName: string,
  city: string,
  country: string,
): Promise<GoogleMapsData | null> {
  const cleanCo = cleanCompanyName(companyName);
  const query = encodeURIComponent(`${cleanCo} ${city} ${country}`.trim());
  const mapsUrl = `https://www.google.com/maps/search/${query}`;
  const navResult = await fs.agentAction({ action: "navigate", url: mapsUrl, background: true, reuseTab: true });
  if (!navResult.success) return null;
  await delay(3500); // Maps è lento a renderizzare il pannello

  const result = await fs.scrape(true);
  if (!result.success || !result.markdown) return null;

  // AI estrae i dati strutturati dal markdown
  const prompt = `Estrai i dati di Google Maps Place dal seguente markdown. Rispondi SOLO con JSON valido (no markdown wrapping), schema:
{"address":string|null,"phone":string|null,"website":string|null,"hours":string|null,"rating":number|null,"reviewsCount":number|null,"category":string|null}
Se il pannello non è visibile o l'azienda non è trovata, rispondi {"address":null,"phone":null,"website":null,"hours":null,"rating":null,"reviewsCount":null,"category":null}.

Markdown (primi 3000 char):
${result.markdown.slice(0, 3000)}`;

  const ai = await aiCall(prompt);
  if (!ai) return null;
  try {
    const cleaned = ai.replace(/```json\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      address: parsed.address || null,
      phone: parsed.phone || null,
      website: parsed.website || null,
      hours: parsed.hours || null,
      rating: typeof parsed.rating === "number" ? parsed.rating : null,
      reviewsCount: typeof parsed.reviewsCount === "number" ? parsed.reviewsCount : null,
      category: parsed.category || null,
      placeUrl: result.metadata?.url || mapsUrl,
    };
  } catch {
    return null;
  }
}

/* ============================================================
 *  SITO MULTI-PAGINA — homepage + about + team + contacts
 * ============================================================ */
const SUBPAGE_PATHS = [
  "/about", "/about-us", "/chi-siamo", "/azienda",
  "/team", "/our-team", "/il-team", "/staff",
  "/contact", "/contacts", "/contatti",
  "/people", "/management",
];

export async function scrapeWebsiteSubpages(
  fs: FsBridge,
  baseWebsite: string,
): Promise<WebsiteMultiPageData> {
  const result: WebsiteMultiPageData = {
    pagesScraped: [],
    team: [],
    contactsExtra: { phones: [], emails: [], addresses: [] },
    about: null,
  };
  const base = baseWebsite.startsWith("http") ? baseWebsite : `https://${baseWebsite}`;
  const baseUrl = base.replace(/\/$/, "");

  // Strategia: prova fino a 5 sottopagine, ferma alle prime 3 che ritornano contenuto utile
  let combined = "";
  let foundCount = 0;
  for (const path of SUBPAGE_PATHS) {
    if (foundCount >= 3) break;
    const url = `${baseUrl}${path}`;
    const navResult = await fs.agentAction({ action: "navigate", url, background: true, reuseTab: true });
    if (!navResult.success) continue;
    await delay(1500);
    const scraped = await fs.scrape(true);
    if (!scraped.success || !scraped.markdown || scraped.markdown.length < 200) continue;
    // Filtra pagine che sono in realtà 404 (alcuni siti restituiscono 200 con pagina vuota)
    if (/page not found|404|non trovata/i.test(scraped.markdown.slice(0, 500))) continue;
    result.pagesScraped.push(path);
    combined += `\n\n===== ${path} =====\n${scraped.markdown.slice(0, 4000)}`;
    foundCount++;
    await delay(800);
  }

  if (combined.length < 200) return result;

  // AI: estrai team, contatti, about in un'unica chiamata
  const prompt = `Analizza i seguenti contenuti delle pagine "About/Team/Contatti" di un'azienda di logistica e estrai dati strutturati. Rispondi SOLO con JSON valido (no markdown wrapping):
{
  "team": [{"name":"Mario Rossi","role":"CEO","email":"opzionale@..."}],
  "contactsExtra": {"phones":["+39 02 ..."],"emails":["info@..."],"addresses":["Via ..., 00100 Roma"]},
  "about": "breve sintesi value-prop in 2 frasi (italiano se IT, inglese se EN)"
}
Se non trovi nulla per una sezione, ritorna array vuoto o null. Limita team a max 10 persone e contattiExtra a max 5 elementi per lista.

Contenuto:
${combined.slice(0, 12000)}`;

  const ai = await aiCall(prompt);
  if (!ai) return result;
  try {
    const cleaned = ai.replace(/```json\s*|\s*```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed.team)) {
      result.team = parsed.team.slice(0, 10).filter((t: WebsiteTeamMember) => t?.name && t?.role);
    }
    if (parsed.contactsExtra) {
      result.contactsExtra = {
        phones: Array.isArray(parsed.contactsExtra.phones) ? parsed.contactsExtra.phones.slice(0, 5) : [],
        emails: Array.isArray(parsed.contactsExtra.emails) ? parsed.contactsExtra.emails.slice(0, 5) : [],
        addresses: Array.isArray(parsed.contactsExtra.addresses) ? parsed.contactsExtra.addresses.slice(0, 5) : [],
      };
    }
    if (typeof parsed.about === "string") result.about = parsed.about.slice(0, 500);
  } catch { /* AI risposta non valida, ritorno dati grezzi */ }

  return result;
}

/* ============================================================
 *  REPUTATION — Trustpilot + Wikipedia
 * ============================================================ */
export async function scrapeReputation(
  fs: FsBridge,
  companyName: string,
  website: string | null,
  googleSearch: (q: string, limit?: number) => Promise<GoogleSearchResult[]>,
): Promise<ReputationData> {
  const result: ReputationData = { trustpilot: null, wikipedia: null, news: [] };
  const cleanCo = cleanCompanyName(companyName);

  // 1) Trustpilot via Google
  try {
    const tpQuery = website
      ? `${cleanCo} site:trustpilot.com`
      : `"${cleanCo}" site:trustpilot.com`;
    const tpResults = await googleSearch(tpQuery, 3);
    const tpHit = tpResults.find((r) => /trustpilot\.com\/review\//i.test(r.url));
    if (tpHit) {
      // Scrape la pagina Trustpilot per rating
      const navResult = await fs.agentAction({ action: "navigate", url: tpHit.url, background: true, reuseTab: true });
      if (navResult.success) {
        await delay(2000);
        const scraped = await fs.scrape(true);
        if (scraped.success && scraped.markdown) {
          // Regex semplice per rating "X.Y" e "Z reviews"
          const ratingMatch = scraped.markdown.match(/(\d\.\d)\s*(?:out of|\/)\s*5|TrustScore\s+(\d\.\d)/i);
          const reviewsMatch = scraped.markdown.match(/(\d[\d,.]*)\s*(?:total\s+)?(?:reviews|recensioni)/i);
          result.trustpilot = {
            url: tpHit.url,
            rating: ratingMatch ? parseFloat(ratingMatch[1] || ratingMatch[2]) : null,
            reviewsCount: reviewsMatch ? parseInt(reviewsMatch[1].replace(/[,.]/g, ""), 10) : null,
          };
        } else {
          result.trustpilot = { url: tpHit.url, rating: null, reviewsCount: null };
        }
      }
    }
  } catch { /* best-effort */ }

  // 2) Wikipedia (it + en)
  try {
    const wkQuery = `"${cleanCo}" (site:it.wikipedia.org OR site:en.wikipedia.org)`;
    const wkResults = await googleSearch(wkQuery, 3);
    const wkHit = wkResults.find((r) => /wikipedia\.org\/wiki\//i.test(r.url));
    if (wkHit) {
      const navResult = await fs.agentAction({ action: "navigate", url: wkHit.url, background: true, reuseTab: true });
      if (navResult.success) {
        await delay(1500);
        const scraped = await fs.scrape(true);
        const summary = scraped.success && scraped.markdown
          ? scraped.markdown.split("\n").slice(0, 30).join(" ").slice(0, 600)
          : null;
        result.wikipedia = { url: wkHit.url, summary };
      } else {
        result.wikipedia = { url: wkHit.url, summary: null };
      }
    }
  } catch { /* best-effort */ }

  // 3) News tab — Google News
  try {
    const newsResults = await googleSearch(`"${cleanCo}" news`, 5);
    result.news = newsResults.slice(0, 5).map((r) => ({ title: r.title, url: r.url }));
  } catch { /* best-effort */ }

  return result;
}
