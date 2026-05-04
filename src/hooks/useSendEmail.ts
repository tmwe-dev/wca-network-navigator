/**
 * useSendEmail — logica invio email via edge function.
 * Scopo unico: inviare email con tracking (Documento 2 §2.4).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { invokeEdge } from "@/lib/api/invokeEdge";
import DOMPurify from "dompurify";
import { createLogger } from "@/lib/log";
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

export function useSendEmail(draft: DraftState) {
  const [sending, setSending] = useState(false);
  // LOVABLE-93: Non serve useTrackActivity/useLogAction qui.
  // La send-email edge function esegue postSendPipeline internamente.

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
      const data = await invokeEdge<{ error?: string }>("send-email", {
        body: {
          to: draft.contactEmail,
          subject: draft.subject,
          html: sanitizedHtml,
          attachments: (draft.attachments ?? []).map(a => ({ filename: a.name, path: a.path })),
        },
        context: "useSendEmail",
      });
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email inviata!", description: `A: ${draft.contactEmail}` });
      // LOVABLE-93: Tracking è gestito da postSendPipeline dentro send-email edge function.
      // Non duplicare con useTrackActivity/useLogAction.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("email send failed", { error: msg, to: draft.contactEmail });
      toast({ title: "Errore invio", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return { sending, handleSend };
}
