/**
 * useSendEmail — logica invio email via edge function.
 * Scopo unico: inviare email con tracking (Documento 2 §2.4).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import DOMPurify from "dompurify";
import { createLogger } from "@/lib/log";
import { useEnqueueAction } from "@/hooks/useEnqueueAction";
import type { DraftState } from "@/types/cockpit";

const log = createLogger("useSendEmail");

/**
 * Hard guard: il send singolo accetta UN SOLO destinatario.
 * Per invii multipli usare il flusso bulk → email_campaign_queue (BulkActionMenu).
 */
function assertSingleRecipient(to: unknown): asserts to is string {
  if (Array.isArray(to)) {
    throw new Error("BULK_SEND_FORBIDDEN: useSendEmail accetta un solo destinatario. Usa il flusso bulk (Outreach → In Uscita).");
  }
  if (typeof to !== "string" || !to.trim()) {
    throw new Error("Destinatario email mancante o non valido");
  }
  // Rifiuta liste mascherate da stringa: "a@x.com, b@y.com" o "a@x.com; b@y.com"
  const recipients = to.split(/[,;]/).map(s => s.trim()).filter(Boolean);
  if (recipients.length > 1) {
    throw new Error("BULK_SEND_FORBIDDEN: rilevati più destinatari nella stringa. Usa il flusso bulk (Outreach → In Uscita).");
  }
}

/**
 * v3.9.56+ pipeline: ogni invio email passa da `ai_pending_actions` →
 * approvazione manuale → `useApproveAndDispatch` → edge `send-email`.
 * Niente dispatch diretto qui.
 */
export function useSendEmail(draft: DraftState) {
  const [sending, setSending] = useState(false);
  const { enqueue } = useEnqueueAction();

  const handleSend = async () => {
    if (draft.channel !== "email" || !draft.contactEmail) {
      toast({ title: "Invio disponibile solo per email con indirizzo", variant: "destructive" });
      return;
    }
    try {
      assertSingleRecipient(draft.contactEmail);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("bulk send blocked", { error: msg });
      toast({ title: "Invio singolo non consentito", description: msg, variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const sanitizedHtml = DOMPurify.sanitize(draft.body, {
        ALLOWED_TAGS: ['br', 'p', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
      });
      await enqueue({
        action_type: "send_email",
        partner_id: null,
        contact_id: draft.contactId ?? null,
        email_address: draft.contactEmail,
        payload: {
          to: draft.contactEmail,
          subject: draft.subject,
          html: sanitizedHtml,
          body: sanitizedHtml,
          draft_subject: draft.subject,
          draft_body: sanitizedHtml,
          attachments: (draft.attachments ?? []).map(a => ({ filename: a.name, path: a.path })),
          contact_id: draft.contactId ?? null,
        },
        suggested_content: sanitizedHtml,
        reasoning: `Email manuale dal cockpit verso ${draft.contactEmail}.`,
        source: "cockpit",
        decision_origin: "user_manual",
      });
    } finally {
      setSending(false);
    }
  };

  return { sending, handleSend };
}
