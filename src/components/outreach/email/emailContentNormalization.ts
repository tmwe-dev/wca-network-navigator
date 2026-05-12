import { createLogger } from "@/lib/log";

const log = createLogger("emailContentNormalization");
const BASE64_PATTERN = /^[A-Za-z0-9+/=\s]+$/;
const BASE64_CHAR_PATTERN = /[A-Za-z0-9+/=]/g;
const HTML_TAG_PATTERN = /<\/?(?:html|body|div|table|tbody|thead|tr|td|th|p|span|img|a|meta|style|section|article|header|footer)\b/i;
const HTML_ENTITY_PATTERN = /&(?:quot|amp|lt|gt|nbsp|#\d+|#x[0-9a-f]+);/i;
const MIME_HEADER_PATTERN = /^(?:content-type|content-transfer-encoding|content-disposition):/im;

/**
 * HTML "corrotto": contiene troppi caratteri di replacement Unicode (�, \uFFFD)
 * o byte di controllo non stampabili. Tipico caso: Outlook che incolla immagini
 * inline come blob binari direttamente nel body HTML, oppure HTML letto con la
 * codifica sbagliata. In questi casi è preferibile mostrare il `body_text`
 * (che IMAP/parser ha estratto pulito) anziché renderizzare gibberish.
 */
function htmlLooksCorrupted(value: string): boolean {
  if (!value) return false;
  // Campiona i primi ~100KB per evitare scan O(n) su HTML enormi.
  const sample = value.length > 100_000 ? value.slice(0, 100_000) : value;
  const total = sample.length;
  if (total < 200) return false;
  // Conta replacement chars + control chars (esclusi \t \n \r).
  let bad = 0;
  for (let i = 0; i < total; i++) {
    const code = sample.charCodeAt(i);
    if (code === 0xfffd) { bad++; continue; }
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) { bad++; continue; }
  }
  const ratio = bad / total;
  // Soglia: ≥3% caratteri "sporchi" → HTML corrotto.
  return ratio >= 0.03;
}

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

/**
 * Estrae solo i caratteri ammessi in base64 (A-Z, a-z, 0-9, +, /, =) e
 * normalizza la lunghezza a un multiplo di 4 con padding `=`. In input
 * accettiamo body che contengono qualche carattere "sporco" (es. una `)`
 * di chiusura o un carattere di terminatore aggiunto dal server di posta)
 * — finché la stragrande maggioranza dei caratteri sono base64-leciti.
 */
function extractBase64Payload(value: string): string {
  const matches = value.match(BASE64_CHAR_PATTERN);
  let cleaned = matches ? matches.join("") : "";
  // Rimuovi padding `=` interno errato (può capitare dopo lo strip).
  cleaned = cleaned.replace(/=+(?=[A-Za-z0-9+/])/g, "");
  // Aggiungi padding `=` se manca per arrivare a multipli di 4.
  const remainder = cleaned.length % 4;
  if (remainder === 2) cleaned += "==";
  else if (remainder === 3) cleaned += "=";
  else if (remainder === 1) cleaned = cleaned.slice(0, -1); // payload corrotto in coda
  return cleaned;
}

function safeDecodeBase64(value: string): string | null {
  const cleaned = extractBase64Payload(value);
  if (cleaned.length < 48) return null;

  try {
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch (e) {
    log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

/**
 * Restituisce true se il valore "sembra" un blocco base64. Tollerante:
 * accetta valori in cui ≥97% dei caratteri (esclusi gli spazi) sono
 * base64-leciti — l'IMAP a volte aggiunge una parentesi o un carattere
 * di terminatore alla fine.
 */
function looksLikeBase64(value: string): boolean {
  const stripped = value.replace(/\s+/g, "");
  if (stripped.length < 48) return false;
  if (BASE64_PATTERN.test(stripped) && stripped.length % 4 === 0) return true;
  const matches = stripped.match(BASE64_CHAR_PATTERN);
  const ratio = matches ? matches.length / stripped.length : 0;
  // Tolleranza: almeno 97% caratteri base64.
  return ratio >= 0.97;
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

    // Non trattare come base64 un blob che è già HTML valido: alcune email
    // (Outlook, web client) annegano immagini inline base64 dentro l'HTML;
    // il body complessivo ha un'altissima percentuale di char base64-leciti
    // ma è in realtà markup. Decodificarlo produce binario illeggibile.
    if (!HTML_TAG_PATTERN.test(current) && looksLikeBase64(current)) {
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

  // Se l'HTML è corrotto (replacement chars / control bytes da immagini inline
  // mal-encoded di Outlook) e abbiamo un body_text leggibile, scartiamo l'HTML.
  if (normalizedHtml && htmlLooksCorrupted(normalizedHtml)) {
    if (normalizedText && !looksLikeBase64(normalizedText) && !htmlLooksCorrupted(normalizedText)) {
      normalizedHtml = null;
    }
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
