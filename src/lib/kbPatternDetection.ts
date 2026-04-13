/**
 * Pure KB pattern detection logic — extracted from classify-email-response Edge Function.
 * No Deno/Supabase dependencies. Fully testable with Vitest.
 */

/** Sender pattern: ≥5 classifications with confidence ≥0.75 from same sender+category */
export function shouldCreateSenderPattern(count: number, minConfidence: number): boolean {
  return count >= 5 && minConfidence >= 0.75;
}

/** Domain pattern: ≥3 unique addresses from same domain classified as same category */
export function shouldCreateDomainPattern(uniqueAddressCount: number): boolean {
  return uniqueAddressCount >= 3;
}

/** Build tag for sender-level pattern */
export function buildPatternTag(domain: string, category: string): string {
  return `email_pattern_${domain}_${category}`;
}

/** Build tag for domain-level pattern */
export function buildDomainPatternTag(domain: string, category: string): string {
  return `domain_pattern_${domain}_${category}`;
}
