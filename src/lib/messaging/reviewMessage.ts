/**
 * reviewMessage — gate editoriale client per WhatsApp e LinkedIn.
 *
 * Doctrine: ogni messaggio WA/LI prodotto o inviato passa OBBLIGATORIAMENTE
 * dal `journalistReview` (memoria editorial-review-layer-mandatory).
 *
 * Per i send manuali dal cockpit l'invio è client-side via estensione, quindi
 * la review viene chiamata via edge `review-message` PRIMA del postMessage al
 * bridge. `verdict === 'block'` → invio annullato. `pass_with_edits` → torna
 * `edited_text` da usare al posto del draft.
 */
import { invokeEdge } from "@/lib/api/invokeEdge";
import { createLogger } from "@/lib/log";

const log = createLogger("reviewMessage");

export type ReviewVerdict = "pass" | "pass_with_edits" | "warn" | "block";

export interface ReviewMessageArgs {
  channel: "whatsapp" | "linkedin";
  draft: string;
  partnerId?: string | null;
  contactId?: string | null;
}

export interface ReviewMessageResult {
  verdict: ReviewVerdict;
  edited_text: string;
  warnings: Array<{ description: string; severity?: string; type?: string }>;
  reasoning_summary: string;
  quality_score?: number;
}

export async function reviewMessage(args: ReviewMessageArgs): Promise<ReviewMessageResult> {
  try {
    const out = await invokeEdge<ReviewMessageResult>("review-message", {
      body: {
        channel: args.channel,
        draft: args.draft,
        partner_id: args.partnerId ?? null,
        contact_id: args.contactId ?? null,
      },
      context: `reviewMessage.${args.channel}`,
    });
    return out ?? {
      verdict: "warn",
      edited_text: args.draft,
      warnings: [{ description: "Review non disponibile (risposta vuota)", severity: "warning" }],
      reasoning_summary: "Review skipped: empty response",
    };
  } catch (err) {
    log.error("review.failed", { channel: args.channel, error: err instanceof Error ? err.message : String(err) });
    // Fail-closed: blocca l'invio se la review fallisce (doctrine intoccabile)
    return {
      verdict: "block",
      edited_text: args.draft,
      warnings: [{ description: `Review fallita: ${err instanceof Error ? err.message : String(err)}`, severity: "blocking" }],
      reasoning_summary: "Review error → fail-closed",
    };
  }
}