/**
 * Pure regex-based extraction from contextLoader — no Supabase dependencies.
 * Used to extract email addresses and names from user messages.
 */

/** Result of extracting mentions from a message */
export interface ExtractedMentions {
  mentionedEmails: string[];
  mentionedNames: string[];
}

/**
 * Extracts email addresses and proper names (Capitalized First Last) from a text message.
 * Emails are limited to max 3, names to max 2.
 *
 * @param messageText - The raw text message to scan for mentions
 * @returns An object containing arrays of matched emails and names
 *
 * @example
 * extractMentions("Contact john@acme.com or Jane Doe for details")
 * // { mentionedEmails: ["john@acme.com"], mentionedNames: ["Jane Doe"] }
 *
 * @example
 * extractMentions("no mentions here")
 * // { mentionedEmails: [], mentionedNames: [] }
 */
export function extractMentions(messageText: string): ExtractedMentions {
  const mentionedEmails = (messageText.match(/[\w.-]+@[\w.-]+\.\w+/g) || []).slice(0, 3);
  const mentionedNames = (messageText.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || []).slice(0, 2);
  return { mentionedEmails, mentionedNames };
}

/**
 * Determines the context loading strategy based on extracted mentions.
 * Prioritizes email matches over name matches, falling back to generic context.
 *
 * @param mentions - The result of extractMentions()
 * @returns "email" if emails found, "name" if names found, "fallback" otherwise
 *
 * @example
 * getContextStrategy({ mentionedEmails: ["a@b.com"], mentionedNames: [] }) // "email"
 * getContextStrategy({ mentionedEmails: [], mentionedNames: ["John Doe"] }) // "name"
 * getContextStrategy({ mentionedEmails: [], mentionedNames: [] }) // "fallback"
 */
export function getContextStrategy(mentions: ExtractedMentions): "email" | "name" | "fallback" {
  if (mentions.mentionedEmails.length > 0) return "email";
  if (mentions.mentionedNames.length > 0) return "name";
  return "fallback";
}
