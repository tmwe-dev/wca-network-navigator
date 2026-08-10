/**
 * Identity resolution — funzione PURA di scoring, nessun I/O.
 *
 * Regola: nessun merge automatico sotto soglia. Sopra `reviewThreshold` e sotto
 * `matchThreshold` il caso va in revisione umana (needsReview).
 */
import type { EntityRef } from "../canonical";
import type { IdentityCandidate, IdentityResolution } from "../sourceAdapter";
import {
  emailDomain,
  normalizeCompanyName,
  normalizeEmail,
  normalizeLinkedinUrl,
  normalizePersonName,
  normalizePhone,
} from "./normalize";

/** Tratti confrontabili estratti da un record (canonico o sorgente). */
export interface IdentityTraits {
  ref?: EntityRef;
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  companyName?: string | null;
  linkedinUrl?: string | null;
}

export interface MatchThresholds {
  /** >= match: candidato accettato. Default 0.9 */
  matchThreshold: number;
  /** >= review e < match: revisione umana. Default 0.6 */
  reviewThreshold: number;
}

export const DEFAULT_THRESHOLDS: MatchThresholds = { matchThreshold: 0.9, reviewThreshold: 0.6 };

interface Signal {
  weight: number;
  matched: boolean;
  label: string;
}

function signals(a: IdentityTraits, b: IdentityTraits): Signal[] {
  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);
  const liA = normalizeLinkedinUrl(a.linkedinUrl);
  const liB = normalizeLinkedinUrl(b.linkedinUrl);
  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);
  const nameA = normalizePersonName(a.fullName);
  const nameB = normalizePersonName(b.fullName);
  const compA = normalizeCompanyName(a.companyName);
  const compB = normalizeCompanyName(b.companyName);

  return [
    { label: "email", weight: 0.6, matched: !!emailA && emailA === emailB },
    { label: "linkedin", weight: 0.5, matched: !!liA && liA === liB },
    { label: "phone", weight: 0.35, matched: !!phoneA && phoneA === phoneB },
    { label: "name", weight: 0.25, matched: !!nameA && nameA === nameB },
    { label: "company", weight: 0.15, matched: !!compA && compA === compB },
    {
      label: "email-domain",
      weight: 0.05,
      matched: !!emailDomain(a.email) && emailDomain(a.email) === emailDomain(b.email),
    },
  ];
}

/** Punteggio 0..1 di somiglianza fra due identità. */
export function scoreIdentity(a: IdentityTraits, b: IdentityTraits): { score: number; reason: string } {
  const list = signals(a, b);
  const hits = list.filter((s) => s.matched);
  if (hits.length === 0) return { score: 0, reason: "nessun segnale in comune" };
  const raw = hits.reduce((sum, s) => sum + s.weight, 0);
  const score = Math.min(1, Number(raw.toFixed(4)));
  return { score, reason: hits.map((s) => s.label).join("+") };
}

/** Confronta un record con i candidati esistenti e decide match / revisione. */
export function resolveIdentity(
  subject: IdentityTraits,
  candidates: ReadonlyArray<IdentityTraits>,
  thresholds: MatchThresholds = DEFAULT_THRESHOLDS,
): IdentityResolution {
  const scored: IdentityCandidate[] = candidates
    .filter((c): c is IdentityTraits & { ref: EntityRef } => Boolean(c.ref))
    .map((c) => {
      const { score, reason } = scoreIdentity(subject, c);
      return { ref: c.ref, score, reason };
    })
    .filter((c) => c.score > 0)
    .sort((x, y) => y.score - x.score);

  const best = scored[0];
  if (best && best.score >= thresholds.matchThreshold) {
    const ambiguous = scored[1] && scored[1].score >= thresholds.matchThreshold;
    return { matched: ambiguous ? undefined : best, candidates: scored, needsReview: Boolean(ambiguous) };
  }
  return { candidates: scored, needsReview: Boolean(best && best.score >= thresholds.reviewThreshold) };
}
