/**
 * useBulkLinkedInDispatch — accoda invii LinkedIn massivi rispettando il rate limit (3/ora).
 *
 * Ogni messaggio viene programmato con `scheduled_for` distanziato di ≥21 minuti
 * (3600s / 3 + buffer) per restare sotto il limite del check_channel_rate_limit DB.
 * Gli invii avvengono comunque tramite l'estensione browser, che leggerà la coda
 * solo quando `scheduled_for` è passato.
 */
import { useState, useCallback } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { isLinkedInProfileUrl, normalizeLinkedInProfileUrl } from "@/lib/linkedinSearch";
import { toast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/log";

const log = createLogger("useBulkLinkedInDispatch");

const SPACING_MINUTES = 21; // 3/ora con buffer

export interface BulkLinkedInTarget {
  contactId?: string;
  partnerId?: string;
  profileUrl: string | null | undefined;
  contactName?: string | null;
  companyName?: string | null;
}

export function useBulkLinkedInDispatch() {
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, queued: 0, failed: 0 });

  const dispatch = useCallback(async (targets: BulkLinkedInTarget[], messageTemplate: string) => {
    const eligible = targets
      .map(t => ({ ...t, profileUrl: normalizeLinkedInProfileUrl(t.profileUrl) }))
      .filter(t => t.profileUrl && isLinkedInProfileUrl(t.profileUrl));

    if (eligible.length === 0) {
      toast({ title: "Nessun contatto con URL LinkedIn valido", variant: "destructive" });
      return { queued: 0, failed: targets.length };
    }
    if (!messageTemplate.trim()) {
      toast({ title: "Messaggio vuoto", variant: "destructive" });
      return { queued: 0, failed: 0 };
    }
    if (messageTemplate.length > 300) {
      toast({ title: "Messaggio troppo lungo", description: "Max 300 caratteri", variant: "destructive" });
      return { queued: 0, failed: 0 };
    }

    setSending(true);
    setProgress({ current: 0, total: eligible.length, queued: 0, failed: 0 });

    let queued = 0;
    let failed = 0;
    const startTime = Date.now() + 60_000; // primo invio fra 1 min

    for (let i = 0; i < eligible.length; i++) {
      const t = eligible[i];
      setProgress(p => ({ ...p, current: i + 1 }));

      // Personalizzazione minima placeholders
      const personalized = messageTemplate
        .replace(/\{\{name\}\}/gi, t.contactName || "")
        .replace(/\{\{company\}\}/gi, t.companyName || "")
        .slice(0, 300);

      const scheduledFor = new Date(startTime + i * SPACING_MINUTES * 60_000).toISOString();

      try {
        const res = await invokeEdge("send-linkedin", {
          body: {
            recipient: t.profileUrl,
            message_text: personalized,
            contact_id: t.contactId || null,
            partner_id: t.partnerId || null,
            scheduled_for: scheduledFor,
          },
          context: "useBulkLinkedInDispatch",
        });
        if ((res as { success?: boolean })?.success) {
          queued++;
        } else {
          failed++;
        }
      } catch (e) {
        log.warn("dispatch failed", { error: e instanceof Error ? e.message : String(e), profileUrl: t.profileUrl });
        failed++;
      }
      setProgress(p => ({ ...p, queued, failed }));
    }

    setSending(false);

    const lastSlot = new Date(startTime + (eligible.length - 1) * SPACING_MINUTES * 60_000);
    toast({
      title: `${queued} messaggi LinkedIn programmati`,
      description: `Distribuiti su ~${Math.ceil(eligible.length * SPACING_MINUTES / 60)}h. Ultimo invio: ${lastSlot.toLocaleString("it-IT")}.${failed > 0 ? ` ${failed} falliti.` : ""}`,
    });

    return { queued, failed };
  }, []);

  return { dispatch, sending, progress, spacingMinutes: SPACING_MINUTES };
}
