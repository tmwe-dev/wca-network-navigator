/**
 * useBulkLinkedInDispatch — accoda invii LinkedIn massivi rispettando timing configurabile.
 *
 * Lo `scheduled_for` di ogni messaggio è calcolato tramite `buildSchedule` (lib/multichannelTiming):
 *  - delay random tra min/max secondi (default 45-180s, allineato pattern WhatsApp ma più conservativo)
 *  - finestra oraria operativa (default 09-19), spostamento automatico al giorno successivo se fuori
 *
 * I parametri sono letti da `app_settings`:
 *  - linkedin_send_start_hour / linkedin_send_end_hour
 *  - linkedin_min_delay_seconds / linkedin_max_delay_seconds
 */
import { useState, useCallback } from "react";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { isLinkedInProfileUrl, normalizeLinkedInProfileUrl } from "@/lib/linkedinSearch";
import { toast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/log";
import { useAppSettings } from "@/hooks/useAppSettings";
import { buildSchedule, parseTimingFromSettings, estimateBatchDuration, type ChannelTimingConfig } from "@/lib/multichannelTiming";

const log = createLogger("useBulkLinkedInDispatch");

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
  const { data: settings } = useAppSettings();
  const timing: ChannelTimingConfig = parseTimingFromSettings(settings, "linkedin");

  const previewSchedule = (count: number) => estimateBatchDuration(count, timing);

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

    // ── HARD CAP: Limit to 50 messages maximum (daily limit) ──
    const HARD_CAP = 50;
    const toDispatch = eligible.slice(0, HARD_CAP);
    const capped = eligible.length > HARD_CAP;

    if (capped) {
      log.warn("bulk dispatch capped at 50", { requested: eligible.length });
      toast({
        title: "Limite giornaliero LinkedIn",
        description: `Sono stati richiesti ${eligible.length} messaggi, ma il limite è 50/giorno. Verranno programmati i primi 50.`,
        variant: "destructive",
      });
    }

    setSending(true);
    setProgress({ current: 0, total: toDispatch.length, queued: 0, failed: 0 });

    const slots = buildSchedule(toDispatch.length, timing);
    let queued = 0;
    let failed = 0;

    for (let i = 0; i < toDispatch.length; i++) {
      const t = toDispatch[i];
      setProgress(p => ({ ...p, current: i + 1 }));

      const personalized = messageTemplate
        .replace(/\{\{name\}\}/gi, t.contactName || "")
        .replace(/\{\{company\}\}/gi, t.companyName || "")
        .slice(0, 300);

      const scheduledFor = slots[i].toISOString();

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

    const lastSlot = slots[slots.length - 1];
    toast({
      title: `${queued} messaggi LinkedIn programmati`,
      description: `Finestra ${timing.startHour}:00-${timing.endHour}:00 · delay ${timing.minDelaySeconds}-${timing.maxDelaySeconds}s. Ultimo invio: ${lastSlot.toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}.${failed > 0 ? ` ${failed} falliti.` : ""}${capped ? " CAPPED@50" : ""}`,
    });

    return { queued, failed };
  }, [timing]);

  return { dispatch, sending, progress, timing, previewSchedule };
}
