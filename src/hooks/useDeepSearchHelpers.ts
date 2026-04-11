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
