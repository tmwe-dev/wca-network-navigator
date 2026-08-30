/**
 * emailLayout — formattazione finale del corpo email.
 *
 * Scopo unico: garantire che il messaggio inviato abbia paragrafi leggibili e
 * un wrapper tipografico coerente, anche quando l'AI (o l'editor) restituisce
 * testo piatto senza markup. Nessuna logica di business: pura presentazione.
 */
import { escapeHtml } from "./htmlSanitizer.ts";

const BLOCK_TAG_RE = /<\s*(p|br|div|ul|ol|li|table|h[1-6]|blockquote)\b/i;

/** Il contenuto ha già markup di blocco? */
export function hasBlockMarkup(html: string): boolean {
  return BLOCK_TAG_RE.test(html ?? "");
}

/**
 * Converte testo piatto in paragrafi HTML. Doppio a-capo = nuovo paragrafo,
 * singolo a-capo = <br/>. Se il testo è un blocco unico senza a-capo, spezza
 * sui saluti/chiusure tipiche per evitare il "muro di testo".
 */
export function plainTextToHtml(text: string): string {
  const normalized = (text ?? "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return "";

  let source = normalized;
  if (!source.includes("\n")) {
    source = source
      // saluto iniziale su riga propria
      .replace(/^(Gentile[^,]{0,60},|Buongiorno[^,]{0,60},|Salve[^,]{0,60},|Ciao[^,]{0,60},)\s*/i, "$1\n\n")
      // chiusure di cortesia a capo
      .replace(/\s(Cordiali saluti,|Distinti saluti,|Un cordiale saluto,|A presto,|Grazie e a presto,)\s*/i, "\n\n$1\n");
  }

  const paragraphs = source
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return paragraphs
    .map((p) => `<p style="margin:0 0 16px 0;">${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

/** Normalizza il corpo: se non ha markup di blocco lo trasforma in paragrafi. */
export function ensureHtmlBody(html: string): string {
  if (!html) return "";
  if (hasBlockMarkup(html)) return html;
  return plainTextToHtml(html);
}

/**
 * Avvolge il corpo in un shell tipografico email-safe (table + inline styles,
 * compatibile con Outlook/Gmail). Idempotente: se il contenuto è già un
 * documento completo lo restituisce invariato.
 */
export function wrapEmailShell(bodyHtml: string): string {
  if (/<\s*(html|body)\b/i.test(bodyHtml)) return bodyHtml;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;margin:0;padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;border:1px solid #e5e7eb;">
        <tr>
          <td style="padding:32px 32px 24px 32px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:#1f2937;">
${bodyHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}
