/**
 * Deep Search — Pure helper functions extracted from useDeepSearchLocal.
 * Zero React dependencies. ~200 LOC reduction from main hook.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import { findPartnerServices, findPartnerNetworks } from "@/data/partnerRelations";
import { createLogger } from "@/lib/log";

const log = createLogger("useDeepSearchHelpers");
const AI_MODEL = "google/gemini-2.5-flash-lite";

export function toWhatsAppNumber(phone: string): string {
  return phone.replace(/[\s\-\(\)\.]/g, "").replace(/^\+/, "");
}

/**
 * Rimuove prefissi onorifici (Mr., Mrs., Dr., Dott., Ing., Eng., Sig., Sig.ra)
 * per rendere le query Google meno restrittive.
 */
export function cleanPersonName(raw: string): string {
  if (!raw) return raw;
  let s = raw.trim();
  // prefissi onorifici (con o senza punto)
  s = s.replace(/^(mr|mrs|ms|miss|mx|dr|dott(?:oressa|or)?|ing|eng|sig(?:nor|nora|\.ra)?|prof|avv|arch)\.?\s+/i, "");
  // suffissi titoli
  s = s.replace(/\s+(jr|sr|phd|md|mba|esq)\.?$/i, "");
  return s.replace(/\s+/g, " ").trim();
}

/**
 * Rimuove suffissi legali e sigle societarie per ottenere un nome ricercabile.
 */
export function cleanCompanyName(raw: string): string {
  if (!raw) return raw;
  let s = raw.trim();
  // suffissi legali in coda
  const legal = /\s*[,.\-]?\s*\b(s\.?\s?r\.?\s?l\.?(?:\s?s)?|s\.?\s?p\.?\s?a\.?|s\.?\s?n\.?\s?c\.?|s\.?\s?a\.?\s?s\.?|ltd\.?|limited|llc\.?|inc\.?|corp\.?|corporation|gmbh|ag|kg|ohg|bv|nv|sa|sl|oy|ab|as|aps|pvt\.?|pty\.?|co\.?|company|holding|group|grp|international|int\.?l)\b\.?$/i;
  // applica fino a 3 volte (es. "X Ltd. Co.")
  for (let i = 0; i < 3; i++) {
    const next = s.replace(legal, "").trim();
    if (next === s) break;
    s = next;
  }
  return s.replace(/\s+/g, " ").trim();
}

/* ---------- Cascade event bus (per cascade visibility nel Lab Forge) ---------- */
export type CascadeEvent =
  | { type: "query-start"; subjectId: string; query: string; index: number; total: number }
  | { type: "query-result"; subjectId: string; query: string; index: number; total: number; results: number }
  | { type: "subject-done"; subjectId: string; matched: boolean };

type CascadeListener = (e: CascadeEvent) => void;
const cascadeListeners = new Set<CascadeListener>();

export const cascadeBus = {
  subscribe(fn: CascadeListener): () => void {
    cascadeListeners.add(fn);
    return () => { cascadeListeners.delete(fn); };
  },
  emit(e: CascadeEvent): void {
    cascadeListeners.forEach((fn) => { try { fn(e); } catch { /* noop */ } });
  },
};

export function extractSeniority(title: string | undefined): { seniority: string; linkedin_title: string } | null {
  if (!title) return null;
  const parts = title.split(" - ");
  if (parts.length < 2) return null;
  const role = parts[1].split(" | ")[0]?.trim();
  if (!role) return null;
  const senior = ["CEO", "Director", "VP", "President", "Owner", "Founder", "Managing", "General Manager", "Head", "Chief", "Partner", "Principal"];
  const mid = ["Manager", "Supervisor", "Lead", "Senior", "Coordinator", "Team Lead"];
  let seniority = "junior";
  if (senior.some((k) => role.includes(k))) seniority = "senior";
  else if (mid.some((k) => role.includes(k))) seniority = "mid";
  return { seniority, linkedin_title: role };
}

export function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1];
}

export function extractDomainKeyword(email: string | null | undefined): string | null {
  if (!email) return null;
  const genericDomains = /^(gmail|yahoo|hotmail|outlook|live|msn|aol|icloud|me|mac|libero|alice|tin|virgilio|tiscali|fastwebnet|aruba|pec|legalmail|mail|protonmail|zoho|yandex|gmx|web|email|inbox)\b/i;
  const parts = email.split("@");
  if (parts.length !== 2) return null;
  const domain = parts[1].split(".")[0];
  if (!domain || domain.length < 2 || genericDomains.test(domain)) return null;
  return domain;
}

export async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function aiCall(prompt: string): Promise<string | null> {
  try {
    const result = await invokeEdge<{ content: string | null }>(
      "ai-deep-search-helper",
      {
        body: { prompt, model: AI_MODEL },
        context: "useDeepSearchLocal.aiCall",
      }
    );
    return result?.content ?? null;
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export interface GoogleSearchResult {
  url: string;
  title: string;
  snippet: string;
}

/** Calculate partner rating based on multiple signals */
export async function calculateRating(
  partnerId: string,
  websiteQualityScore: number,
  website: string | null,
  memberSince: string | null,
  branchCities: unknown,
): Promise<number> {
  const services = await findPartnerServices(partnerId);
  const networks = await findPartnerNetworks(partnerId);

  const websiteScore = websiteQualityScore || (website ? 2 : 1);
  const svcSet = new Set(services.map((s) => (s as Record<string, string>).service_category));
  let serviceMix = 1;
  if (svcSet.has("air_freight")) serviceMix += 1.5;
  if (svcSet.has("road_freight")) serviceMix += 1;
  if (svcSet.has("warehousing")) serviceMix += 1;
  serviceMix = Math.min(5, Math.max(1, serviceMix));

  let networkScore = 1;
  if (networks.length >= 5) networkScore = 5;
  else if (networks.length >= 3) networkScore = 3;
  else if (networks.length >= 1) networkScore = 1.5;

  let seniorityScore = 1;
  if (memberSince) {
    const years = (Date.now() - new Date(memberSince).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (years >= 20) seniorityScore = 5;
    else if (years >= 10) seniorityScore = 3;
    else if (years >= 5) seniorityScore = 2;
  }

  const bc = Array.isArray(branchCities) ? branchCities : [];
  let internationalScore = 1;
  if (bc.length >= 10) internationalScore = 5;
  else if (bc.length >= 3) internationalScore = 3;
  else if (bc.length >= 1) internationalScore = 2;

  const rawRating = websiteScore * 0.2 + serviceMix * 0.2 + networkScore * 0.15 + seniorityScore * 0.15 + internationalScore * 0.1 + 1 * 0.1 + 1 * 0.1;
  return Math.min(5, Math.max(1, Math.round(rawRating * 2) / 2));
}
