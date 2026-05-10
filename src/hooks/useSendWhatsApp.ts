/**
 * useSendWhatsApp — logica invio WhatsApp via bridge.
 * Scopo unico: inviare messaggi WhatsApp con tracking (Documento 2 §2.4).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useLogAction } from "@/hooks/useLogAction";
import { createLogger } from "@/lib/log";
import { reviewMessage } from "@/lib/messaging/reviewMessage";
import type { DraftState } from "@/types/cockpit";

const log = createLogger("useSendWhatsApp");

export function useSendWhatsApp(draft: DraftState) {
  const [sending, setSending] = useState(false);
  const waBridge = useWhatsAppExtensionBridge();
  const logAction = useLogAction();

  const handleSendWhatsApp = async () => {
    const phone = draft.contactPhone?.replace(/[^0-9+]/g, "").replace(/^\+/, "");
    if (!phone) {
      toast({ title: "Numero di telefono mancante", variant: "destructive" });
      return;
    }

    if (!waBridge.isAvailable) {
      navigator.clipboard.writeText(draft.body.replace(/<[^>]+>/g, "").trim());
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(draft.body.replace(/<[^>]+>/g, "").trim())}`;
      toast({ title: "📋 Messaggio copiato!", description: "Estensione WA non rilevata." });
      window.open(waUrl, "_blank");
      return;
    }

    if (!waBridge.isAuthenticated) {
      toast({ title: "⚠️ WhatsApp Web non autenticato", description: "Apri WhatsApp Web e scansiona il QR code.", variant: "destructive" });
      return;
    }

    const plainText = draft.body.replace(/<[^>]+>/g, "").trim();

    // ── EDITORIAL GATE HARD (memoria editorial-review-layer-mandatory) ──
    let finalText = plainText;
    try {
      const review = await reviewMessage({
        channel: "whatsapp",
        draft: plainText,
        partnerId: null,
        contactId: draft.contactId ?? null,
      });
      if (review.verdict === "block") {
        toast({
          title: "🛑 Invio bloccato dalla review editoriale",
          description: review.reasoning_summary || "Messaggio non conforme alla doctrine.",
          variant: "destructive",
        });
        return;
      }
      if (review.verdict === "pass_with_edits" && review.edited_text) {
        finalText = review.edited_text;
        toast({
          title: "✏️ Messaggio corretto dalla review",
          description: "Inviata la versione editata dal giornalista AI.",
        });
      }
    } catch (err) {
      log.error("WA review failed → fail-closed", { error: err instanceof Error ? err.message : String(err) });
      toast({ title: "Review WA non disponibile", description: "Invio annullato per sicurezza.", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      const res = await waBridge.sendWhatsApp(phone, finalText);
      if (res.success) {
        toast({ title: "✅ WhatsApp inviato!", description: `A: ${phone}` });
        logAction.mutate({
          channel: "whatsapp",
          sourceType: "imported_contact",
          sourceId: draft.contactId || crypto.randomUUID(),
          to: phone,
          title: `${draft.companyName || "—"} — ${draft.contactName || phone}`,
          subject: `WhatsApp a ${draft.contactName || phone}`,
          body: finalText,
          source: "manual",
        });
      } else {
        toast({ title: "Errore WhatsApp", description: res.error, variant: "destructive" });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error("WhatsApp send failed", { error: msg, phone });
      toast({ title: "Errore invio WhatsApp", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return { sending, waBridge, handleSendWhatsApp };
}
