/**
 * useSendWhatsApp — logica invio WhatsApp via bridge.
 * Scopo unico: inviare messaggi WhatsApp con tracking (Documento 2 §2.4).
 */
import { useState } from "react";
import { toast } from "@/hooks/use-toast";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useTrackActivity } from "@/hooks/useTrackActivity";
import { createLogger } from "@/lib/log";
import type { DraftState } from "@/pages/Cockpit";

const log = createLogger("useSendWhatsApp");

export function useSendWhatsApp(draft: DraftState) {
  const [sending, setSending] = useState(false);
  const waBridge = useWhatsAppExtensionBridge();
  const trackActivity = useTrackActivity();

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
    setSending(true);
    try {
      const res = await waBridge.sendWhatsApp(phone, plainText);
      if (res.success) {
        toast({ title: "✅ WhatsApp inviato!", description: `A: ${phone}` });
        trackActivity.mutate({
          activityType: "whatsapp_message",
          title: `${draft.companyName || "—"} — ${draft.contactName || phone}`,
          sourceId: draft.contactId || crypto.randomUUID(),
          sourceType: "imported_contact",
          description: `Messaggio WhatsApp inviato a ${draft.contactName || phone}`,
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
