/**
 * responseParser.ts — Parse AI response for generate-email.
 * Extracts subject/body, normalises HTML, appends signature.
 */

export interface ParsedEmailResponse {
  subject: string;
  body: string;
}

export function parseEmailResponse(rawContent: string, signatureBlock: string): ParsedEmailResponse {
  let subject = "";
  let body = rawContent;

  // Extract subject line
  const subjectMatch = rawContent.match(/^Subject:\s*(.+)/i);
  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    body = rawContent.substring(subjectMatch[0].length).trim();
  }

  // Convert plain text to HTML if AI didn't use HTML tags
  if (!/<(p|br|div|ul|ol|h[1-6])\b/i.test(body)) {
    body = body
      .split(/\n\n+/)
      .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
      .join("\n");
  }

  // Clean up excessive whitespace/formatting
  body = body
    .replace(/<p>\s*(<br\s*\/?>|\s|&nbsp;)*\s*<\/p>/gi, "")
    .replace(/(<br\s*\/?\s*>[\s\n]*){3,}/gi, "<br><br>")
    .replace(/<p>\s*(<br\s*\/?\s*>)+/gi, "<p>")
    .replace(/(<br\s*\/?\s*>)+\s*<\/p>/gi, "</p>")
    .replace(/>\s{2,}</g, "> <")
    .trim();

  // Append signature
  if (signatureBlock.trim()) {
    const sigHtml = signatureBlock.replace(/\n/g, "<br>");
    body = body + `<br><br>${sigHtml}`;
  }

  return { subject, body };
}
