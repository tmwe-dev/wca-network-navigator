/**
 * useSendEmail — logica invio email via edge function.
 * Scopo unico: inviare email con tracking (Documento 2 §2.4).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { invokeEdge } from "@/lib/api/invokeEdge";
import DOMPurify from "dompurify";
import { useTrackActivity } from "@/hooks/useTrackActivity";
import { createLogger } from "@/lib/log";
import type { DraftState } from "@/pages/Cockpit";

const log = createLogger("useSendEmail");

export function useSendEmail(draft: DraftState) {
  const [sending, setSending] = useState(false);
  const trackActivity = useTrackActivity();

  const handleSend = async () => {
    if (draft.channel !== "email" || !draft.contactEmail) {
      toast({ title: "Invio disponibile solo per email con indirizzo", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const sanitizedHtml = DOMPurify.sanitize(draft.body, {
        ALLOWED_TAGS: ['br', 'p', 'b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'span', 'div'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'style'],
      });
      const data = await invokeEdge<{ error?: string }>("send-email", {
        body: { to: draft.contactEmail, subject: draft.subject, html: sanitizedHtml },
        context: "useSendEmail",
      });
      if (data?.error) throw new Error(data.error);
      toast({ title: "Email inviata!", description: `A: ${draft.contactEmail}` });
      trackActivity.mutate({
        activityType: "send_email",
        title: `${draft.companyName || "—"} — ${draft.contactName || draft.contactEmail}`,
        sourceId: draft.contactId || crypto.randomUUID(),
        sourceType: "imported_contact",
        emailSubject: draft.subject,
        description: `Email inviata a ${draft.contactEmail}`,
      });
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
