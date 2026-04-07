import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { toast } from "sonner";

/**
 * Shared hook for direct contact communication actions (email composer, WhatsApp bridge).
 * Creates activities and enters the holding pattern on success.
 * Used across Network, BCA, Contacts, Prospects, and Drawer.
 */
export function useDirectContactActions() {
  const navigate = useNavigate();
  const { sendWhatsApp, isAvailable: waAvailable } = useWhatsAppExtensionBridge();
  const [waSending, setWaSending] = useState<string | null>(null);

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
      const key = opts.contactId || opts.phone;
      setWaSending(key);
      try {
        const cleanPhone = opts.phone.replace(/[\s\-\(\)\.]/g, "").replace(/^\+/, "");
        const result = await sendWhatsApp(cleanPhone, "");
        if (result?.success) {
          toast.success(`Chat WhatsApp aperta con ${opts.contactName || cleanPhone}`);
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("activities").insert({
              activity_type: "whatsapp_message" as any,
              title: `WhatsApp a ${opts.contactName || cleanPhone}${opts.companyName ? ` (${opts.companyName})` : ""}`,
              source_type: opts.sourceType || "partner",
              source_id: opts.sourceId || opts.partnerId || opts.contactId || "",
              partner_id: opts.partnerId || null,
              selected_contact_id: opts.contactId || null,
              status: "completed" as any,
              user_id: user.id,
              description: "Messaggio WhatsApp inviato",
            });
          }
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
    [waAvailable, sendWhatsApp]
  );

  return { handleSendEmail, handleSendWhatsApp, waSending, waAvailable };
}
