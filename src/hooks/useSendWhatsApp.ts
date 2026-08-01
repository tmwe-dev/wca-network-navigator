/**
 * useSendWhatsApp — logica invio WhatsApp via bridge.
 * Scopo unico: inviare messaggi WhatsApp con tracking (Documento 2 §2.4).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useEnqueueAction } from "@/hooks/useEnqueueAction";
import type { DraftState } from "@/types/cockpit";

/**
 * v3.9.56+ pipeline: ogni invio WhatsApp passa da `ai_pending_actions` →
 * approvazione manuale → `useApproveAndDispatch` → bridge `from-webapp-wa`.
 * Niente dispatch diretto qui.
 */
export function useSendWhatsApp(draft: DraftState) {
  const [sending, setSending] = useState(false);
  const waBridge = useWhatsAppExtensionBridge();
  const { enqueue } = useEnqueueAction();

  const handleSendWhatsApp = async () => {
    const phone = draft.contactPhone?.replace(/[^0-9+]/g, "").replace(/^\+/, "");
    if (!phone) {
      toast({ title: "Numero di telefono mancante", variant: "destructive" });
      return;
    }

    const plainText = draft.body.replace(/<[^>]+>/g, "").trim();
    if (!plainText) {
      toast({ title: "Messaggio vuoto", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      await enqueue({
        action_type: "send_whatsapp",
        partner_id: null,
        contact_id: draft.contactId ?? null,
        payload: {
          recipient: phone,
          message_text: plainText,
          contact_id: draft.contactId ?? null,
          contactName: draft.contactName ?? null,
          companyName: draft.companyName ?? null,
        },
        suggested_content: plainText,
        reasoning: `WhatsApp manuale dal cockpit verso ${draft.contactName || phone}.`,
        source: "cockpit",
        decision_origin: "user_manual",
      });
    } finally {
      setSending(false);
    }
  };

  return { sending, waBridge, handleSendWhatsApp };
}
