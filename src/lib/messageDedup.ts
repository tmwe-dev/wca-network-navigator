/**
 * Deterministic message external ID generator.
 * Produces the same ID for the same message content, preventing duplicates.
 * Handles all Unicode scripts (Thai, Arabic, CJK, Cyrillic, etc.).
 */

/**
 * Simple deterministic hash (djb2) that handles full Unicode.
 */
function djb2Hash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    const char = str.codePointAt(i) || 0;
    hash = ((hash << 5) + hash + char) >>> 0;
    // Skip surrogate pair second code unit
    if (char > 0xFFFF) i++;
  }
  return hash.toString(36);
}

/**
 * Normalize text for comparison: trim, collapse whitespace, lowercase.
 * Preserves all Unicode characters (Thai, Arabic, CJK, etc.).
 */
function normalizeText(text: string): string {
  return (text || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .slice(0, 200); // Cap length for ID stability
}

/**
 * Build a deterministic external ID for a channel message.
 * Same input always produces the same ID → DB unique constraint catches duplicates.
 * 
 * @param prefix - Channel prefix: "wa", "li", "wa_out", "li_out"
 * @param contact - Contact name/address
 * @param text - Message body text
 * @param timestamp - Message timestamp (from extension or ISO string)
 */
export function buildDeterministicId(
  prefix: string,
  contact: string,
  text: string,
  timestamp?: string
): string {
  const safeContact = normalizeText(contact).slice(0, 50).replace(/[|]/g, "_");
  const safeText = normalizeText(text);
  const ts = timestamp || "";
  
  const payload = `${safeContact}|${ts}|${safeText}`;
  const hash = djb2Hash(payload);
  
  return `${prefix}_${safeContact}_${hash}`;
}
