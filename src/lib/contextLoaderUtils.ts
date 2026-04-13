/**
 * Pure regex-based extraction from contextLoader — no Supabase dependencies.
 * Used to extract email addresses and names from user messages.
 */

export interface ExtractedMentions {
  mentionedEmails: string[];
  mentionedNames: string[];
}

/**
 * Extract email addresses and proper names from a text message.
 * Emails are sliced to max 3, names to max 2.
 */
export function extractMentions(messageText: string): ExtractedMentions {
  const mentionedEmails = (messageText.match(/[\w.-]+@[\w.-]+\.\w+/g) || []).slice(0, 3);
  const mentionedNames = (messageText.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g) || []).slice(0, 2);
  return { mentionedEmails, mentionedNames };
}

/**
 * Determines which context loading strategy to use.
 */
export function getContextStrategy(mentions: ExtractedMentions): "email" | "name" | "fallback" {
  if (mentions.mentionedEmails.length > 0) return "email";
  if (mentions.mentionedNames.length > 0) return "name";
  return "fallback";
}
