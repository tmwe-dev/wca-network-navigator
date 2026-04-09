import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useTrackActivity } from "@/hooks/useTrackActivity";
import { toast } from "sonner";

/**
 * Shared hook for direct contact communication actions (email composer, WhatsApp bridge).
 * Uses trackActivity for full tracking: activities, contact_interactions, lead_status escalation.
 * Used across Network, BCA, Contacts, Prospects, and Drawer.
 */
export function useDirectContactActions() {
  const navigate = useNavigate();
  const { sendWhatsApp, isAvailable: waAvailable, isAuthenticated: waAuthenticated } = useWhatsAppExtensionBridge();
  const [waSending, setWaSending] = useState<string | null>(null);
  const trackActivity = useTrackActivity();

  const handleSendEmail = useCallback(
    (opts: {
      email: string;
      name?: string;
      company?: string;
      partnerId?: string;
      contactId?: string;
    }) => {
      navigate("/email-composer", {
        state: {
          ...(opts.partnerId ? { partnerIds: [opts.partnerId] } : {}),
          prefilledRecipient: {
            email: opts.email,
            name: opts.name,
            company: opts.company,
            partnerId: opts.partnerId,
            contactId: opts.contactId,
          },
        },
      });
    },
    [navigate]
  );

  const handleSendWhatsApp = useCallback(
    async (opts: {
      phone: string;
      contactName?: string;
      companyName?: string;
      contactId?: string;
      partnerId?: string;
      sourceType?: "partner" | "prospect" | "contact";
      sourceId?: string;
      onSuccess?: () => void;
    }) => {
      if (!waAvailable) {
        toast.error("Estensione WhatsApp non connessa. Apri WhatsApp Web e ricarica.");
        return false;
      }

      if (!waAuthenticated) {
        toast.error("⚠️ WhatsApp Web non autenticato. Scansiona il QR code.");
        return false;
      }

      const key = opts.contactId || opts.phone;
      setWaSending(key);
      try {
        const cleanPhone = opts.phone.replace(/[\s\-\(\)\.]/g, "").replace(/^\+/, "");
        const result = await sendWhatsApp(cleanPhone, "");
        if (result?.success) {
          toast.success(`Chat WhatsApp aperta con ${opts.contactName || cleanPhone}`);
          // Use trackActivity for full tracking (activities + contact_interactions + lead_status)
          trackActivity.mutate({
            activityType: "whatsapp_message",
            title: `WhatsApp a ${opts.contactName || cleanPhone}${opts.companyName ? ` (${opts.companyName})` : ""}`,
            sourceId: opts.sourceId || opts.contactId || opts.partnerId || crypto.randomUUID(),
            sourceType: (opts.sourceType === "contact" ? "imported_contact" : opts.sourceType) || "partner",
            description: "Messaggio WhatsApp inviato",
          });
          opts.onSuccess?.();
          return true;
        } else {
          toast.error(`Contatto non trovato su WhatsApp: ${result?.error || "Errore sconosciuto"}`);
          return false;
        }
      } catch (e: any) {
        toast.error(e?.message || "Errore invio WhatsApp");
        return false;
      } finally {
        setWaSending(null);
      }
    },
    [waAvailable, waAuthenticated, sendWhatsApp, trackActivity]
  );

  return { handleSendEmail, handleSendWhatsApp, waSending, waAvailable };
}
