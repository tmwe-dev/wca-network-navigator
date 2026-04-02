import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppExtensionBridge } from "@/hooks/useWhatsAppExtensionBridge";
import { toast } from "sonner";

function hashMessage(contact: string, timestamp: string, text: string): string {
  const raw = `${contact}|${timestamp}|${text}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return `wa_${Math.abs(hash).toString(36)}`;
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
        const extId = hashMessage(
          msg.contact || msg.from || "unknown",
          msg.timestamp || new Date().toISOString(),
          msg.text || ""
        );

        const { error } = await supabase
          .from("channel_messages")
          .upsert({
            user_id: session.user.id,
            channel: "whatsapp",
            direction: "inbound",
            from_address: msg.contact || msg.from || "Sconosciuto",
            body_text: msg.text || "",
            message_id_external: extId,
            raw_payload: msg,
            created_at: msg.timestamp || new Date().toISOString(),
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
