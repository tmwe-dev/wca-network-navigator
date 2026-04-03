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

      let newCount = 0;
      let verifyCount = 0;

      for (const msg of messages) {
        const contact = msg.contact || msg.from || "unknown";
        const rawTime = msg.time || msg.timestamp || "";
        const text = msg.lastMessage || msg.text || "";
        const isVerify = msg.isVerify === true;

        // WhatsApp Web returns time like "14:30" or "ieri" — normalize to ISO
        let timestamp: string;
        try {
          const parsed = new Date(rawTime);
          timestamp = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
        } catch {
          timestamp = new Date().toISOString();
        }

        const extId = buildExternalId(contact, rawTime || timestamp, text);

        // Use upsert — if it already exists, nothing changes (dedup)
        const { error, status } = await supabase
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
          }, { onConflict: "message_id_external", ignoreDuplicates: true });

        if (!error) {
          // status 201 = created (new), 200 = already existed (duplicate ignored)
          if (status === 201) {
            if (isVerify) verifyCount++;
            else newCount++;
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
      queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });

      const total = newCount + verifyCount;
      if (total > 0) {
        const parts: string[] = [];
        if (newCount > 0) parts.push(`${newCount} nuovi`);
        if (verifyCount > 0) parts.push(`${verifyCount} recuperati`);
        toast.success(`📱 ${parts.join(" + ")} messaggi WhatsApp importati`);
      } else {
        toast.info("Nessun nuovo messaggio WhatsApp");
      }
    } catch (err: any) {
      toast.error("Errore WhatsApp: " + err.message);
    } finally {
      setIsReading(false);
    }
  }, [readUnread, queryClient]);

  return { readInbox, isReading };
}
