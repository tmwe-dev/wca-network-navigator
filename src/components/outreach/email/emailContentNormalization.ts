import { createLogger } from "@/lib/log";

const log = createLogger("emailContentNormalization");
const BASE64_PATTERN = /^[A-Za-z0-9+/=\s]+$/;
const HTML_TAG_PATTERN = /<\/?(?:html|body|div|table|tbody|thead|tr|td|th|p|span|img|a|meta|style|section|article|header|footer)\b/i;
const HTML_ENTITY_PATTERN = /&(?:quot|amp|lt|gt|nbsp|#\d+|#x[0-9a-f]+);/i;
const MIME_HEADER_PATTERN = /^(?:content-type|content-transfer-encoding|content-disposition):/im;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeHtmlEntities(value: string): string {
  if (!value || !HTML_ENTITY_PATTERN.test(value)) return value;

  if (typeof document !== "undefined") {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value;
    return textarea.value;
  }

  return value
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function decodeQuotedPrintableText(value: string): string {
  if (!value) return value;
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function safeDecodeBase64(value: string): string | null {
  const normalized = value.replace(/\s+/g, "").trim();
  if (normalized.length < 48 || normalized.length % 4 !== 0 || !BASE64_PATTERN.test(normalized)) {
    return null;
  }

  try {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

function looksLikeBase64(value: string): boolean {
  const normalized = value.replace(/\s+/g, "").trim();
  return normalized.length >= 48 && normalized.length % 4 === 0 && BASE64_PATTERN.test(normalized);
}

function looksLikeQuotedPrintable(value: string): boolean {
  return /=\r?\n/.test(value) || /=([0-9A-Fa-f]{2})/.test(value);
}

function stripMimeHeaders(value: string): string {
  if (!MIME_HEADER_PATTERN.test(value)) return value;
  const splitMatch = value.match(/\r?\n\r?\n/);
  if (!splitMatch || splitMatch.index == null) return value;
  return value.slice(splitMatch.index + splitMatch[0].length);
}

function htmlToText(value: string): string {
  if (!value) return "";

  if (typeof document !== "undefined") {
    const container = document.createElement("div");
    container.innerHTML = value;
    return (container.textContent || "")
      .replace(/\u00a0/g, " ")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }

  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeScalar(value: string, preferHtml: boolean): string {
  let current = (value || "").trim();
  if (!current) return "";

  for (let pass = 0; pass < 2; pass++) {
    const previous = current;

    if (MIME_HEADER_PATTERN.test(current)) {
      current = stripMimeHeaders(current).trim();
    }

    if (looksLikeBase64(current)) {
      const decoded = safeDecodeBase64(current);
      if (decoded && (HTML_TAG_PATTERN.test(decoded) || decoded.length > current.length * 0.35)) {
        current = decoded.trim();
      }
    }

    if (looksLikeQuotedPrintable(current)) {
      current = decodeQuotedPrintableText(current).trim();
    }

    if (HTML_ENTITY_PATTERN.test(current)) {
      current = decodeHtmlEntities(current).trim();
    }

    if (preferHtml && !HTML_TAG_PATTERN.test(current)) {
      const maybeDecoded = safeDecodeBase64(current);
      if (maybeDecoded && HTML_TAG_PATTERN.test(maybeDecoded)) {
        current = maybeDecoded.trim();
      }
    }

    if (current === previous) break;
  }

  return current;
}

export function normalizeEmailHtml(value?: string | null): string | null {
  const normalized = normalizeScalar(value || "", true);
  if (!normalized) return null;
  if (HTML_TAG_PATTERN.test(normalized)) return normalized;
  return null;
}

export function normalizeEmailText(value?: string | null): string | null {
  const normalized = normalizeScalar(value || "", false);
  return normalized || null;
}

export function normalizeEmailContent({
  bodyHtml,
  bodyText,
}: {
  bodyHtml?: string | null;
  bodyText?: string | null;
}) {
  let normalizedHtml = normalizeEmailHtml(bodyHtml);
  let normalizedText = normalizeEmailText(bodyText);

  if (!normalizedHtml && normalizedText && HTML_TAG_PATTERN.test(normalizedText)) {
    normalizedHtml = normalizedText;
  }

  if (normalizedHtml && (!normalizedText || looksLikeBase64(normalizedText) || looksLikeQuotedPrintable(normalizedText))) {
    normalizedText = htmlToText(normalizedHtml);
  }

  if (!normalizedHtml && !normalizedText) {
    normalizedText = "";
  }

  const previewText = (normalizedText || (normalizedHtml ? htmlToText(normalizedHtml) : ""))
    .replace(/\s+/g, " ")
    .trim();

  return {
    bodyHtml: normalizedHtml,
    bodyText: normalizedText,
    previewText,
  };
}

export function renderEmailTextAsHtml(value?: string | null): string {
  const content = (value || "(nessun contenuto)").trim() || "(nessun contenuto)";
  return `<pre style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;white-space:pre-wrap;padding:20px;margin:0;color:#334155;">${escapeHtml(content)}</pre>`;
}
