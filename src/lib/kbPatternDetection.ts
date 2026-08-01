/**
 * Pure KB pattern detection logic — extracted from classify-email-response Edge Function.
 * No Deno/Supabase dependencies. Fully testable with Vitest.
 */

/**
 * Determines whether a sender-level KB pattern should be auto-created.
 * Requires at least 5 classifications with minimum confidence of 0.75 from the same sender+category.
 *
 * @param count - Number of classifications from this sender in this category
 * @param minConfidence - Minimum confidence across those classifications
 * @returns true if a sender pattern should be created
 *
 * @example
 * shouldCreateSenderPattern(5, 0.80) // true
 * shouldCreateSenderPattern(4, 0.80) // false (not enough classifications)
 * shouldCreateSenderPattern(5, 0.70) // false (confidence too low)
 */
export function shouldCreateSenderPattern(count: number, minConfidence: number): boolean {
  return count >= 5 && minConfidence >= 0.75;
}

/**
 * Determines whether a domain-level KB pattern should be auto-created.
 * Requires at least 3 unique email addresses from the same domain classified as the same category.
 *
 * @param uniqueAddressCount - Number of unique email addresses from this domain
 * @returns true if a domain pattern should be created
 *
 * @example
 * shouldCreateDomainPattern(3) // true
 * shouldCreateDomainPattern(2) // false
 */
export function shouldCreateDomainPattern(uniqueAddressCount: number): boolean {
  return uniqueAddressCount >= 3;
}

/**
 * Builds a tag string for a sender-level pattern entry.
 *
 * @param domain - The email domain (e.g., "acme.com")
 * @param category - The classification category (e.g., "spam")
 * @returns A formatted tag string like "email_pattern_acme.com_spam"
 *
 * @example
 * buildPatternTag("acme.com", "spam") // "email_pattern_acme.com_spam"
 */
export function buildPatternTag(domain: string, category: string): string {
  return `email_pattern_${domain}_${category}`;
}

/**
 * Builds a tag string for a domain-level pattern entry.
 *
 * @param domain - The email domain (e.g., "acme.com")
 * @param category - The classification category (e.g., "auto_reply")
 * @returns A formatted tag string like "domain_pattern_acme.com_auto_reply"
 *
 * @example
 * buildDomainPatternTag("acme.com", "auto_reply") // "domain_pattern_acme.com_auto_reply"
 */
export function buildDomainPatternTag(domain: string, category: string): string {
  return `domain_pattern_${domain}_${category}`;
}
