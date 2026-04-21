import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { useLogAction } from "@/hooks/useLogAction";
import { toast } from "sonner";

/**
 * Shared hook for direct contact communication actions (email composer, WhatsApp bridge).
 * LOVABLE-93: Uses logAction (server-side pipeline) for full tracking.
 * Used across Network, BCA, Contacts, Prospects, and Drawer.
 */
export function useDirectContactActions() {
  const navigate = useNavigate();
  const { sendWhatsApp, isAvailable: waAvailable, isAuthenticated: waAuthenticated } = useWhatsAppExtensionBridge();
  const [waSending, setWaSending] = useState<string | null>(null);
  const logAction = useLogAction();

  const handleSendEmail = useCallback(
    (opts: {
      email: string;
      name?: string;
      company?: string;
      partnerId?: string;
      contactId?: string;
    }) => {
      navigate("/v2/email-composer", {
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
          // LOVABLE-93: logAction chiama log-action edge → postSendPipeline server-side
          const resolvedSourceType = opts.sourceType === "contact" ? "imported_contact" as const
            : opts.sourceType === "prospect" ? "imported_contact" as const
            : (opts.sourceType || "partner") as "partner" | "imported_contact" | "business_card";
          logAction.mutate({
            channel: "whatsapp",
            sourceType: resolvedSourceType,
            sourceId: opts.sourceId || opts.contactId || opts.partnerId || crypto.randomUUID(),
            to: cleanPhone,
            title: `WhatsApp a ${opts.contactName || cleanPhone}${opts.companyName ? ` (${opts.companyName})` : ""}`,
            partnerId: opts.partnerId,
            contactId: opts.contactId,
            source: "manual",
          });
          opts.onSuccess?.();
          return true;
        } else {
          toast.error(`Contatto non trovato su WhatsApp: ${result?.error || "Errore sconosciuto"}`);
          return false;
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Errore invio WhatsApp");
        return false;
      } finally {
        setWaSending(null);
      }
    },
    [waAvailable, waAuthenticated, sendWhatsApp, logAction]
  );

  return { handleSendEmail, handleSendWhatsApp, waSending, waAvailable };
}
