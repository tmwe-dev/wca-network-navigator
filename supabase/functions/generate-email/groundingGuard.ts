export interface GroundingGuardWarning {
  term: string;
  location: "subject" | "body";
  reason: "known_hallucinated_brand" | "unverified_named_product";
  replacement: string;
}

export interface GroundingGuardResult {
  subject: string;
  body: string;
  changed: boolean;
  warnings: GroundingGuardWarning[];
}

interface GuardInput {
  subject: string;
  body: string;
  sourceText: string;
}

const KNOWN_HALLUCINATED_TERMS = ["SkyBus"];
const PRODUCT_CONTEXT_WORDS = [
  "piattaforma",
  "platform",
  "programma",
  "program",
  "servizio",
  "service",
  "soluzione",
  "solution",
  "software",
  "tool",
  "sistema",
  "system",
  "prodotto",
  "product",
];

const SAFE_ACRONYMS = new Set(["AI", "API", "B2B", "CRM", "ERP", "EU", "UE", "IT", "WCA", "RA"]);

function normalizeForEvidence(value: string): string {
  return value.toLowerCase().normalize("NFKC").replace(/\s+/g, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isEvidenceBacked(term: string, normalizedSource: string): boolean {
  const cleanTerm = term.replace(/[“”"'.,;:!?()\[\]{}]/g, "").trim();
  if (!cleanTerm || cleanTerm.length < 3) return true;
  if (SAFE_ACRONYMS.has(cleanTerm.toUpperCase())) return true;
  return normalizedSource.includes(normalizeForEvidence(cleanTerm));
}

function replaceUnbackedTerm(
  text: string,
  term: string,
  replacement: string,
): { text: string; changed: boolean } {
  const pattern = new RegExp(`\\b${escapeRegExp(term)}\\b`, "g");
  const next = text.replace(pattern, replacement);
  return { text: next, changed: next !== text };
}

function guardKnownHallucinations(
  text: string,
  location: "subject" | "body",
  normalizedSource: string,
): { text: string; warnings: GroundingGuardWarning[] } {
  let guarded = text;
  const warnings: GroundingGuardWarning[] = [];
  for (const term of KNOWN_HALLUCINATED_TERMS) {
    if (isEvidenceBacked(term, normalizedSource)) continue;
    const replacement = location === "subject" ? "collaborazione operativa" : "la nostra operatività";
    const result = replaceUnbackedTerm(guarded, term, replacement);
    if (result.changed) {
      guarded = result.text;
      warnings.push({ term, location, reason: "known_hallucinated_brand", replacement });
    }
  }
  return { text: guarded, warnings };
}

function guardUnverifiedNamedProducts(
  text: string,
  location: "subject" | "body",
  normalizedSource: string,
): { text: string; warnings: GroundingGuardWarning[] } {
  let guarded = text;
  const warnings: GroundingGuardWarning[] = [];
  const contextPattern = PRODUCT_CONTEXT_WORDS.map(escapeRegExp).join("|");
  const pattern = new RegExp(`\\b(?:${contextPattern})\\s+(?:di\\s+)?[“\"']?([A-Z][A-Za-z0-9&.-]{2,})[”\"']?`, "g");
  const matches = Array.from(text.matchAll(pattern));
  for (const match of matches) {
    const term = match[1];
    if (!term || isEvidenceBacked(term, normalizedSource)) continue;
    const replacement = location === "subject" ? "operativa" : "dedicata";
    const result = replaceUnbackedTerm(guarded, term, replacement);
    if (result.changed) {
      guarded = result.text;
      warnings.push({ term, location, reason: "unverified_named_product", replacement });
    }
  }
  return { text: guarded, warnings };
}

export function guardGeneratedEmailGrounding(input: GuardInput): GroundingGuardResult {
  const normalizedSource = normalizeForEvidence(input.sourceText);
  const warnings: GroundingGuardWarning[] = [];

  const subjectKnown = guardKnownHallucinations(input.subject, "subject", normalizedSource);
  const bodyKnown = guardKnownHallucinations(input.body, "body", normalizedSource);
  const subjectProducts = guardUnverifiedNamedProducts(subjectKnown.text, "subject", normalizedSource);
  const bodyProducts = guardUnverifiedNamedProducts(bodyKnown.text, "body", normalizedSource);

  warnings.push(...subjectKnown.warnings, ...bodyKnown.warnings, ...subjectProducts.warnings, ...bodyProducts.warnings);

  return {
    subject: subjectProducts.text,
    body: bodyProducts.text,
    changed: subjectProducts.text !== input.subject || bodyProducts.text !== input.body,
    warnings,
  };
}