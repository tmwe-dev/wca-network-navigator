/**
 * emailHtmlFormatter.ts — canonical PLAIN TEXT layout cleanup for generated emails.
 * Scope: visual layout only (paragraphs, blank lines, signature). No tone, content,
 * strategy or CTA decisions. Output is ALWAYS plain text per the "calligrafia" KB.
 *
 * Le funzioni mantengono i nomi storici (normalizeEmailHtml, appendEmailSignature)
 * per compatibilità con i call site, ma producono SEMPRE plain text.
 */

function stripFences(value: string): string {
  return value
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&#39;/gi, "'");
}

function htmlToPlainText(value: string): string {
  return value
    // line breaks
    .replace(/<br\s*\/?\s*>/gi, "\n")
    // paragraph & block boundaries → blank line
    .replace(/<\/(?:p|div|li|h[1-6]|blockquote)>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    // strip every remaining tag
    .replace(/<[^>]+>/g, "");
}

/**
 * Normalizes any AI output (HTML, Markdown, mixed) into clean PLAIN TEXT
 * compliant with the "calligrafia" KB:
 *   - paragraphs separated by EXACTLY one blank line (\n\n)
 *   - no HTML tags, no Markdown markers, no escaped entities
 *   - no leading/trailing whitespace, no double spaces
 */
export function normalizeEmailHtml(raw: string): string {
  if (!raw) return "";
  let text = stripFences(String(raw)).replace(/\r\n?/g, "\n");
  text = htmlToPlainText(text);
  text = decodeBasicEntities(text);

  // strip common markdown markers
  text = text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")            // headings
    .replace(/\*\*(.+?)\*\*/g, "$1")               // bold
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$)/g, "$1$2") // italic _x_
    .replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, "$1$2") // italic *x*
    .replace(/`([^`]+)`/g, "$1")                   // inline code
    .replace(/^\s{0,3}[-*+]\s+/gm, "- ");          // unify bullets

  // collapse paragraphs
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) =>
      p
        .split("\n")
        .map((line) => line.replace(/[ \t]+/g, " ").trim())
        .filter(Boolean)
        .join("\n"),
    )
    .filter(Boolean);

  return paragraphs.join("\n\n").trim();
}

/** Appends a signature block to the plain-text body, with a blank line in between. */
export function appendEmailSignature(body: string, signatureBlock: string): string {
  const bodyText = normalizeEmailHtml(body);
  const sigText = normalizeEmailHtml(signatureBlock || "");
  if (!sigText) return bodyText;
  if (!bodyText) return sigText;
  return `${bodyText}\n\n${sigText}`;
}