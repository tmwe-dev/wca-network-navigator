/**
 * emailHtmlFormatter.ts — canonical HTML layout cleanup for generated emails.
 * Scope: rendering/formatting only. No tone, content, strategy or CTA decisions.
 */

const ALLOWED_ESCAPED_TAG = /^(\/?)(p|br|strong|em|ul|ol|li|a)\b/i;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function stripFences(value: string): string {
  return value
    .replace(/^```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

function decodeAllowedEscapedTags(value: string): string {
  return value.replace(/&lt;([^<>]+)&gt;/gi, (match, inner: string) => {
    const trimmed = inner.trim();
    if (!ALLOWED_ESCAPED_TAG.test(trimmed)) return match;
    const decoded = trimmed
      .replace(/&quot;/g, '"')
      .replace(/&#x27;|&#39;/g, "'")
      .replace(/&amp;/g, "&");
    return `<${decoded}>`;
  });
}

function plainTextToHtml(value: string): string {
  return value
    .split(/\n\s*\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

function hasEmailHtml(value: string): boolean {
  return /<(p|br|div|ul|ol|li|strong|em|a)\b/i.test(value);
}

export function normalizeEmailHtml(raw: string): string {
  let html = decodeAllowedEscapedTags(stripFences(raw || "").replace(/\r\n?/g, "\n"));
  if (!html.trim()) return "";

  if (!hasEmailHtml(html)) return plainTextToHtml(html);

  html = html
    .replace(/<\/?(?:html|body|head)[^>]*>/gi, "")
    .replace(/<div\b[^>]*>/gi, "<p>")
    .replace(/<\/div>/gi, "</p>")
    .replace(/<span\b[^>]*>/gi, "")
    .replace(/<\/span>/gi, "")
    .replace(/<p\b[^>]*>/gi, "<p>")
    .replace(/<br\s*\/?\s*>/gi, "<br>")
    .replace(/<strong\b[^>]*>/gi, "<strong>")
    .replace(/<em\b[^>]*>/gi, "<em>")
    .replace(/<ul\b[^>]*>/gi, "<ul>")
    .replace(/<ol\b[^>]*>/gi, "<ol>")
    .replace(/<li\b[^>]*>/gi, "<li>")
    .replace(/<p>\s+/gi, "<p>")
    .replace(/\s+<\/p>/gi, "</p>")
    .replace(/<p>(?:\s|&nbsp;|<br>)*<\/p>/gi, "")
    .replace(/(?:<br>\s*){2,}/gi, "<br>")
    .replace(/<\/p>\s*,/gi, ",</p>")
    .replace(/<\/p>\s*\./gi, ".</p>")
    .replace(/<p>\s*[,.;:]\s*/gi, "<p>")
    .replace(/\s{2,}/g, " ")
    .replace(/<\/p>\s*<p>/gi, "</p>\n<p>")
    .replace(/<\/li>\s*<li>/gi, "</li>\n<li>")
    .trim();

  return html;
}

export function appendEmailSignature(body: string, signatureBlock: string): string {
  const normalizedBody = normalizeEmailHtml(body);
  const source = stripFences(signatureBlock || "").trim();
  if (!source) return normalizedBody;

  const signatureText = decodeAllowedEscapedTags(source)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (signatureText.length === 0) return normalizedBody;
  const signatureHtml = `<p>${signatureText.map(escapeHtml).join("<br>")}</p>`;
  return [normalizedBody, signatureHtml].filter(Boolean).join("\n");
}