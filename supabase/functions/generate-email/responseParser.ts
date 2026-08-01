/**
 * responseParser.ts — Parse AI response for generate-email.
 * Extracts subject/body, normalises HTML, appends signature.
 * Wrapped by responseParserFactory.safeParseEmailResponse for resilience.
 */
import { safeParseEmailResponse } from "../_shared/responseParserFactory.ts";
import { appendEmailSignature, normalizeEmailHtml } from "../_shared/emailHtmlFormatter.ts";

export interface ParsedEmailResponse {
  subject: string;
  body: string;
}

function _parseInternal(rawContent: string): ParsedEmailResponse {
  let subject = "";
  let body = rawContent;

  // Extract subject line
  const subjectMatch = rawContent.match(/^Subject:\s*(.+)/i);
  if (subjectMatch) {
    subject = subjectMatch[1].trim();
    body = rawContent.substring(subjectMatch[0].length).trim();
  }

  body = normalizeEmailHtml(body);

  return { subject, body };
}

export function parseEmailResponse(rawContent: string, signatureBlock: string, model = "unknown"): ParsedEmailResponse {
  const parsed = safeParseEmailResponse(
    rawContent,
    "generate-email",
    model,
    _parseInternal,
    { fallbackSubject: "Follow-up" },
  );
  const body = appendEmailSignature(parsed.body, signatureBlock);
  return { subject: parsed.subject, body };
}
