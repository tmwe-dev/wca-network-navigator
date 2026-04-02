import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { toast } from "sonner";

function buildExternalId(contact: string, timestamp: string, text: string): string {
  const safeText = (text || "").slice(0, 50).replace(/[|]/g, "_");
  const safeContact = (contact || "unknown").replace(/[|]/g, "_");
  return `wa_${safeContact}_${timestamp}_${safeText}`;
}

export function useWhatsAppInbox() {
  const [isReading, setIsReading] = useState(false);
  const queryClient = useQueryClient();
  const { readUnread } = useWhatsAppExtensionBridge();

  const readInbox = useCallback(async () => {
    setIsReading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non autenticato");

      const result = await readUnread();
      if (!result.success) {
        throw new Error(result.error || "Errore lettura WhatsApp");
      }

      const messages = (result as any).messages || [];
      if (!messages.length) {
        toast.info("Nessun nuovo messaggio WhatsApp");
        return;
      }

      let imported = 0;
      for (const msg of messages) {
        const contact = msg.contact || msg.from || "unknown";
        const timestamp = msg.time || msg.timestamp || new Date().toISOString();
        const text = msg.lastMessage || msg.text || "";
        const extId = buildExternalId(contact, timestamp, text);

        const { error } = await supabase
          .from("channel_messages")
          .upsert({
            user_id: session.user.id,
            channel: "whatsapp",
            direction: "inbound",
            from_address: contact,
            body_text: text,
            message_id_external: extId,
            raw_payload: msg as any,
            created_at: timestamp,
          }, { onConflict: "message_id_external" });

        if (!error) imported++;
      }

      queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });

      if (imported > 0) {
        toast.success(`📱 ${imported} messaggi WhatsApp importati`);
      } else {
        toast.info("Messaggi già importati");
      }
    } catch (err: any) {
      toast.error("Errore WhatsApp: " + err.message);
    } finally {
      setIsReading(false);
    }
  }, [readUnread, queryClient]);

  return { readInbox, isReading };
}
