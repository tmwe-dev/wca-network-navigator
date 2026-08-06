/**
 * Pure helpers for the Add Contact form.
 * Extracted verbatim from useAddContactForm.ts (no behavioral change).
 */
import { PERSONAL_EMAIL_DOMAINS, SKIP_SEARCH_DOMAINS } from "./constants";
import type { GoogleSearchResult } from "./reducer";

export function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function extractDomainFromEmail(email: string): string {
  const domain = email.split("@")[1]?.trim().toLowerCase() || "";
  if (!domain || PERSONAL_EMAIL_DOMAINS.has(domain)) return "";
  return domain.replace(/^www\./, "");
}

export function isUsefulCompanyUrl(url: string | null | undefined): boolean {
  const domain = extractDomain(url || "");
  return Boolean(domain) && !SKIP_SEARCH_DOMAINS.some((item) => domain.includes(item));
}

export function getSearchResultDescription(result: GoogleSearchResult): string {
  return result?.description?.trim?.() || "";
}

export function buildGoogleFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
}
