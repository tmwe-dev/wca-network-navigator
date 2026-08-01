/**
 * _shared/contentNormalizer.ts — Content Normalization Layer
 *
 * Fase 2.b roadmap audit AI (vedi `docs/audit/ai-architecture-2026-04.md`).
 *
 * SCOPO
 *  Pulire e normalizzare contenuti grezzi (email, web scrape, OCR card,
 *  WhatsApp/LinkedIn inbound) PRIMA che vengano passati a:
 *    1. promptSanitizer.sanitizeForPrompt (anti-injection)
 *    2. wrapUntrusted (fence)
 *    3. il modello LLM
 *
 *  Riduce token sprecati, rumore OCR, HTML noise, firme/disclaimer ripetuti,
 *  quoted-reply chains. Migliora la qualità delle classificazioni e abbassa
 *  il costo gateway.
 *
 * DESIGN
 *  - Pure functions, no I/O.
 *  - Idempotenti: normalize(normalize(x)) === normalize(x).
 *  - Non rimuovono mai info "semantiche" critiche per il business
 *    (numeri, indirizzi email, URL, importi). Solo rumore strutturale.
 *  - Logging via NormalizeReport: il caller può inoltrare a structuredLogger.
 */

// ---------- Tipi ----------

export type ContentSource =
  | "email-inbound"
  | "email-history"
  | "email-html"
  | "web-scrape"
  | "ocr-business-card"
  | "ocr-document"
  | "linkedin-message"
  | "whatsapp-message"
  | "user-chat"
  | "unknown";

export interface NormalizeOptions {
  source: ContentSource;
  /** Se true, rimuove la quoted-reply chain (default: per email* sì, altrimenti no). */
  stripQuotedReplies?: boolean;
  /** Se true, rimuove signature/disclaimer comuni (default: per email* sì). */
  stripSignatures?: boolean;
  /** Se true, applica fix OCR (default: per ocr-* sì). */
  fixOcr?: boolean;
  /** Se true, applica HTML→text (default: per email-html / web-scrape sì). */
  htmlToText?: boolean;
  /** Hard cap caratteri prima del prompt sanitizer. Default 12000. */
  maxChars?: number;
  /** Se true, normalizza unicode NFKC (default true). */
  unicodeNormalize?: boolean;
}

export interface NormalizeReport {
  source: ContentSource;
  originalLength: number;
  finalLength: number;
  steps: string[];
  truncated: boolean;
}

export interface NormalizeResult {
  text: string;
  report: NormalizeReport;
}

// ---------- Costanti ----------

const DEFAULT_MAX_CHARS = 12_000;

/** Marcatori comuni di quoted-reply (IT/EN/DE/FR/ES). */
const QUOTED_REPLY_MARKERS: RegExp[] = [
  /^[ \t]*>.*$/gm, // citazioni standard "> ..."
  /^-{2,}\s*Original Message\s*-{2,}[\s\S]*$/im,
  /^-{2,}\s*Forwarded Message\s*-{2,}[\s\S]*$/im,
  /^On .{1,80} wrote:\s*$[\s\S]*/im,
  /^Il giorno .{1,80} ha scritto:\s*$[\s\S]*/im,
  /^Le .{1,80} a écrit\s*:\s*$[\s\S]*/im,
  /^Am .{1,80} schrieb .{1,80}:\s*$[\s\S]*/im,
  /^El .{1,80} escribió:\s*$[\s\S]*/im,
  /^From:.*\nSent:.*\nTo:.*\nSubject:.*$[\s\S]*/im,
  /^Da:.*\nInviato:.*\nA:.*\nOggetto:.*$[\s\S]*/im,
];

/** Marcatori di signature/disclaimer da troncare. */
const SIGNATURE_MARKERS: RegExp[] = [
  /^-- ?\r?$\n[\s\S]*/m, // standard "-- " separator
  /\n+(Sent from my (iPhone|iPad|Android|mobile|Samsung)[^\n]*)/i,
  /\n+(Inviato da[l]? mio (iPhone|iPad|Android|smartphone)[^\n]*)/i,
  /\n+(Get Outlook for (iOS|Android)[^\n]*)/i,
  /\n+(CONFIDENTIALITY NOTICE|DISCLAIMER|AVVISO DI RISERVATEZZA|INFORMATIVA[^\n]{0,40}PRIVACY)[\s\S]*/i,
  /\n+(This (e-?mail|message) (and any attachments )?(is|are) (confidential|intended)[^\n]*)[\s\S]*/i,
];

/** Tag HTML che vanno completamente eliminati con il loro contenuto. */
const HTML_DROP_BLOCKS = /<(script|style|head|noscript|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1>/gi;

/** Fix OCR comuni (ambiguità di lettura). Applicati solo a sequenze "rumore". */
const OCR_FIXES: Array<[RegExp, string]> = [
  // 0/O confusion in parole alfabetiche (mai dentro numeri puri)
  [/(?<=[A-Za-z])0(?=[A-Za-z])/g, "O"],
  // l/1 confusion: "1" isolato fra lettere → "l"
  [/(?<=[A-Za-z])1(?=[A-Za-z])/g, "l"],
  // Spazi spuri prima di punteggiatura
  [/\s+([,.;:!?])/g, "$1"],
  // Trattini di a-capo OCR: "exam-\nple" → "example"
  [/([A-Za-z])-\n([a-z])/g, "$1$2"],
  // Caratteri ripetuti tipici (rumore): "aaaaa", "----", "===="
  [/([^a-zA-Z0-9\s])\1{4,}/g, "$1$1$1"],
];

// ---------- Helpers interni ----------

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => {
      const code = parseInt(h, 16);
      return code > 0 && code < 0x10ffff ? String.fromCodePoint(code) : "";
    });
}

function htmlToPlainText(html: string): string {
  let s = html;
  s = s.replace(HTML_DROP_BLOCKS, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  // <br>, <p>, </div>, </tr>, </li>, headings → newline
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "• ");
  // Conserva URL del link: <a href="X">Y</a> → "Y (X)"
  s = s.replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const cleanText = text.replace(/<[^>]+>/g, "").trim();
    if (!cleanText) return href;
    if (cleanText === href) return href;
    return `${cleanText} (${href})`;
  });
  // Strip tutti i restanti tag
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s;
}

function stripQuotedReplies(text: string): string {
  let s = text;
  for (const re of QUOTED_REPLY_MARKERS) {
    s = s.replace(re, "");
  }
  return s;
}

function stripSignatures(text: string): string {
  let s = text;
  for (const re of SIGNATURE_MARKERS) {
    s = s.replace(re, "");
  }
  return s;
}

function applyOcrFixes(text: string): string {
  let s = text;
  for (const [re, repl] of OCR_FIXES) {
    s = s.replace(re, repl);
  }
  return s;
}

function collapseWhitespace(text: string): string {
  return text
    // CRLF → LF
    .replace(/\r\n?/g, "\n")
    // tab → spazio
    .replace(/\t/g, " ")
    // spazi multipli su stessa riga
    .replace(/[ \u00A0]{2,}/g, " ")
    // più di 2 newline → 2
    .replace(/\n{3,}/g, "\n\n")
    // trailing spaces per riga
    .replace(/[ \u00A0]+$/gm, "")
    .trim();
}

function unicodeNormalize(text: string): string {
  try {
    return text.normalize("NFKC");
  } catch {
    return text;
  }
}

function defaultFor(source: ContentSource): Required<Omit<NormalizeOptions, "source">> {
  const isEmail = source === "email-inbound" || source === "email-history" || source === "email-html";
  const isOcr = source === "ocr-business-card" || source === "ocr-document";
  const isHtml = source === "email-html" || source === "web-scrape";
  return {
    stripQuotedReplies: isEmail,
    stripSignatures: isEmail,
    fixOcr: isOcr,
    htmlToText: isHtml,
    maxChars: DEFAULT_MAX_CHARS,
    unicodeNormalize: true,
  };
}

// ---------- API pubblica ----------

/**
 * Normalizza un contenuto grezzo. Da chiamare PRIMA di `sanitizeForPrompt`.
 *
 * Pipeline:
 *   1. unicode NFKC
 *   2. (HTML) drop script/style + tag→text
 *   3. (OCR) fix ambiguità
 *   4. strip quoted-reply chains
 *   5. strip signatures/disclaimers
 *   6. collapse whitespace
 *   7. truncate a maxChars
 */
export function normalizeContent(
  input: string | null | undefined,
  options: NormalizeOptions,
): NormalizeResult {
  const defaults = defaultFor(options.source);
  const opts = { ...defaults, ...options };
  const steps: string[] = [];
  const originalLength = input ? input.length : 0;

  if (!input || typeof input !== "string") {
    return {
      text: "",
      report: { source: opts.source, originalLength, finalLength: 0, steps, truncated: false },
    };
  }

  let text = input;

  if (opts.unicodeNormalize) {
    const next = unicodeNormalize(text);
    if (next !== text) steps.push("unicode-nfkc");
    text = next;
  }

  if (opts.htmlToText && /<[a-zA-Z!/][^>]*>/.test(text)) {
    text = htmlToPlainText(text);
    steps.push("html-to-text");
  }

  if (opts.fixOcr) {
    const next = applyOcrFixes(text);
    if (next !== text) steps.push("ocr-fixes");
    text = next;
  }

  if (opts.stripQuotedReplies) {
    const next = stripQuotedReplies(text);
    if (next !== text) steps.push("strip-quoted");
    text = next;
  }

  if (opts.stripSignatures) {
    const next = stripSignatures(text);
    if (next !== text) steps.push("strip-signature");
    text = next;
  }

  const collapsed = collapseWhitespace(text);
  if (collapsed !== text) steps.push("collapse-ws");
  text = collapsed;

  let truncated = false;
  if (text.length > opts.maxChars) {
    text = text.slice(0, opts.maxChars) + `\n…[TRUNCATED ${text.length - opts.maxChars} chars]`;
    truncated = true;
    steps.push("truncate");
  }

  return {
    text,
    report: {
      source: opts.source,
      originalLength,
      finalLength: text.length,
      steps,
      truncated,
    },
  };
}

/**
 * Pipeline completa: normalize → sanitize → wrap.
 * Da preferire a chiamate manuali ai tre step quando possibile.
 */
export async function normalizeSanitizeAndWrap(
  rawInput: string | null | undefined,
  label: string,
  source: ContentSource,
  opts?: { maxChars?: number; policy?: "redact" | "block" | "log" },
): Promise<{ block: string; normalized: NormalizeResult; sanitized: import("./promptSanitizer.ts").SanitizeResult }> {
  const { sanitizeForPrompt, wrapUntrusted } = await import("./promptSanitizer.ts");

  const normalized = normalizeContent(rawInput, {
    source,
    maxChars: opts?.maxChars,
  });

  // Mappa ContentSource → UntrustedSource del prompt sanitizer
  const untrustedSource = mapToUntrustedSource(source);

  const sanitized = sanitizeForPrompt(normalized.text, {
    source: untrustedSource,
    policy: opts?.policy ?? "redact",
  });

  if (sanitized.blocked) {
    return {
      block: wrapUntrusted(
        `[BLOCKED: contenuto rifiutato — pattern: ${sanitized.findings.map((f) => f.patternId).join(", ")}]`,
        label,
        untrustedSource,
      ),
      normalized,
      sanitized,
    };
  }

  return {
    block: wrapUntrusted(sanitized.text, label, untrustedSource),
    normalized,
    sanitized,
  };
}

function mapToUntrustedSource(source: ContentSource): import("./promptSanitizer.ts").UntrustedSource {
  switch (source) {
    case "email-inbound": return "email-inbound";
    case "email-history": return "email-history";
    case "email-html": return "email-inbound";
    case "web-scrape": return "web-scrape";
    case "ocr-business-card":
    case "ocr-document": return "business-card-ocr";
    case "linkedin-message": return "linkedin-message";
    case "whatsapp-message": return "whatsapp-message";
    case "user-chat": return "user-chat";
    default: return "unknown";
  }
}
