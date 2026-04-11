import { createLogger } from "@/lib/log";

const log = createLogger("linkedinSearch");
export type GoogleSearchResultLike = {
  url?: string | null;
  title?: string | null;
  description?: string | null;
  snippet?: string | null;
};

export interface LinkedInProfileCandidate {
  name?: string;
  headline?: string;
  profileUrl: string;
}

const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "aol.com",
  "mail.com",
  "protonmail.com",
  "libero.it",
  "virgilio.it",
  "alice.it",
  "tin.it",
  "fastwebnet.it",
  "tiscali.it",
  "email.it",
  "pec.it",
];

const LINKEDIN_PROFILE_PATH_RE = /^\/(in|pub)\//i;

const isGoogleRedirectHost = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "google.com" ||
    normalized.startsWith("google.") ||
    normalized.startsWith("www.google.") ||
    normalized.endsWith(".google.com")
  );
};

export const getEmailDomain = (email?: string | null): string | null => {
  if (!email) return null;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || GENERIC_EMAIL_DOMAINS.includes(domain)) return null;
  return domain;
};

export const unwrapGoogleResultUrl = (url?: string | null): string | null => {
  if (!url) return null;

  try {
    const parsed = new URL(url);
    if (isGoogleRedirectHost(parsed.hostname) && (parsed.pathname === "/url" || parsed.pathname === "/imgres")) {
      return (
        parsed.searchParams.get("url") ||
        parsed.searchParams.get("q") ||
        parsed.searchParams.get("imgurl") ||
        url
      );
    }
    return parsed.href;
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return url;
  }
};

export const isLinkedInProfileUrl = (url?: string | null): boolean => {
  const unwrapped = unwrapGoogleResultUrl(url);
  if (!unwrapped) return false;

  try {
    const parsed = new URL(unwrapped);
    const hostname = parsed.hostname.toLowerCase();
    const isLinkedInHost =
      hostname === "linkedin.com" ||
      hostname === "www.linkedin.com" ||
      hostname.endsWith(".linkedin.com");

    return isLinkedInHost && LINKEDIN_PROFILE_PATH_RE.test(parsed.pathname);
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return false;
  }
};

export const normalizeLinkedInProfileUrl = (url?: string | null): string | null => {
  const unwrapped = unwrapGoogleResultUrl(url);
  if (!isLinkedInProfileUrl(unwrapped)) return null;

  try {
    const parsed = new URL(unwrapped!);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "");
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
};

export const cleanGoogleLinkedInTitle = (title?: string | null): string => {
  if (!title) return "";

  return title
    .replace(/\s+[|·•]\s+LinkedIn.*$/i, "")
    .replace(/\s+-\s+LinkedIn.*$/i, "")
    .trim();
};

export const extractLinkedInCandidateFromGoogleResult = (
  item: GoogleSearchResultLike
): LinkedInProfileCandidate | null => {
  const profileUrl = normalizeLinkedInProfileUrl(item.url);
  if (!profileUrl) return null;

  const cleanedTitle = cleanGoogleLinkedInTitle(item.title);
  const name = cleanedTitle.split(/\s+[|–—-]\s+/)[0]?.trim() || cleanedTitle;
  const description = item.description?.trim() || item.snippet?.trim() || "";
  const headlineParts = [
    cleanedTitle && cleanedTitle !== name ? cleanedTitle : "",
    description,
  ].filter(Boolean);

  return {
    name: name || undefined,
    headline: headlineParts.join(" — ") || description || undefined,
    profileUrl,
  };
};

export const scoreLinkedInCandidate = (
  found: { name?: string | null; headline?: string | null; profileUrl?: string | null },
  expected: { name: string; company?: string | null; role?: string | null }
): number => {
  if (!found.profileUrl) return 0;

  let score = 0.3;
  const foundName = (found.name || "").toLowerCase();
  const expectedName = expected.name.toLowerCase();
  const expectedParts = expectedName.split(/\s+/).filter((part) => part.length > 2);

  if (foundName.includes(expectedName) || expectedName.includes(foundName)) {
    score += 0.4;
  } else if (expectedParts.some((part) => foundName.includes(part))) {
    score += 0.2;
  }

  const headline = (found.headline || "").toLowerCase();
  if (expected.company && expected.company !== "—") {
    const companyLower = expected.company.toLowerCase();
    const companyWords = companyLower.split(/\s+/).filter((word) => word.length > 3);
    if (headline.includes(companyLower) || companyWords.some((word) => headline.includes(word))) {
      score += 0.25;
    }
  }

  if (expected.role) {
    const roleLower = expected.role.toLowerCase();
    if (headline.includes(roleLower)) score += 0.05;
  }

  return Math.min(score, 1);
};

export const pickBestLinkedInCandidate = (
  items: GoogleSearchResultLike[],
  expected: { name: string; company?: string | null; role?: string | null }
): { candidate: LinkedInProfileCandidate | null; confidence: number; candidates: LinkedInProfileCandidate[] } => {
  const candidates = items
    .map(extractLinkedInCandidateFromGoogleResult)
    .filter((candidate): candidate is LinkedInProfileCandidate => Boolean(candidate?.profileUrl));

  const scored = candidates
    .map((candidate) => ({ candidate, confidence: scoreLinkedInCandidate(candidate, expected) }))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    candidate: scored[0]?.candidate ?? null,
    confidence: scored[0]?.confidence ?? 0,
    candidates,
  };
};

export const buildLinkedInGoogleQueries = (
  name: string,
  company?: string | null,
  email?: string | null,
  role?: string | null
): string[] => {
  const queries: string[] = [];
  const emailDomain = getEmailDomain(email);

  if (company && company !== "—") {
    queries.push(`site:linkedin.com/in "${name}" "${company}"`);
  }
  if (role && company && company !== "—") {
    queries.push(`site:linkedin.com/in "${name}" "${role}" "${company}"`);
  }
  if (emailDomain) {
    queries.push(`site:linkedin.com/in "${name}" "${emailDomain}"`);
  }
  queries.push(`site:linkedin.com/in "${name}"`);

  return Array.from(new Set(queries.map((query) => query.replace(/\s+/g, " ").trim()).filter(Boolean)));
};
