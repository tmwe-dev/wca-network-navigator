/**
 * LinkedIn Sync — download messaggi via estensione.
 * Usa cursor per-contatto: salva SOLO i messaggi nuovi rispetto al DB.
 * Filtra etichette UI ("Da leggere", "Tutti", ...) e ghost preview ("foto", "audio", ...).
 * Chiamato sia manualmente (bottone "Leggi") sia dall'auto-sync lento.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge } from "./useLinkedInMessagingBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { createLogger } from "@/lib/log";

const log = createLogger("useLinkedInSync");
import { toast } from "sonner";
import {
  upsertChannelMessageDedup,
  getChannelContactCursors,
} from "@/data/channelMessages";
import { queryKeys } from "@/lib/queryKeys";

const LI_UI_LABELS = new Set([
  "messaggi", "messaggio", "da leggere", "non letti", "archiviata",
  "archiviate", "spam", "inmail", "inmails", "sponsorizzato",
  "sponsored", "tutti", "filtri", "messages", "unread", "archived",
]);
const LI_GHOST_BODIES = new Set([
  "foto", "video", "audio", "gif", "documento", "allegato",
  "ha reagito", "ha risposto", "ha ritirato un messaggio",
  "messaggio rimosso", "image", "attachment",
]);

function isUiLabel(s: string): boolean {
  return LI_UI_LABELS.has(s.trim().toLowerCase());
}
function isGhostBody(s: string): boolean {
  const t = s.trim().toLowerCase();
  if (t.length < 3) return true;
  if (/^[0-9]{1,3}$/.test(t)) return true;
  return LI_GHOST_BODIES.has(t);
}

export function useLinkedInSync() {
  const [isReading, setIsReading] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const { isAvailable, readInbox } = useLinkedInMessagingBridge();
  const queryClient = useQueryClient();

  const readNow = useCallback(async (silent = false) => {
    if (!isAvailable) {
      if (!silent) toast.error("Estensione LinkedIn non disponibile");
      return;
    }
    setIsReading(true);
    try {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) {
        if (!silent) toast.error("Non autenticato");
        return;
      }

      // Resolve operator_id
      const { data: opRow } = await supabase
        .from("operators")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      const operatorId = opRow?.id ?? null;
      if (!operatorId) {
        log.warn("No operator found for user, skipping sync");
        if (!silent) toast.error("Nessun operatore associato");
        return;
      }

      const result = await readInbox();
      log.debug("readInbox result", { preview: JSON.stringify(result).slice(0, 500) });

      if (!result.success) {
        if (!silent) toast.error(`Lettura LinkedIn fallita: ${result.error || "errore sconosciuto"}`);
        return;
      }

      if (!result.threads?.length) {
        if (!silent) toast.info("Nessun thread LinkedIn trovato nell'inbox");
        return;
      }

      // Cursor per-contatto: ts (ms) ultimo messaggio in DB per evitare duplicati
      // e (più importante) salvare solo nuovi messaggi.
      const cursors = await getChannelContactCursors(user.id, "linkedin");
      const nowMs = Date.now();

      let newMsgs = 0;
      for (const thread of result.threads) {
        if (!thread.lastMessage || !thread.name) continue;
        if (isUiLabel(thread.name)) continue;
        if (isGhostBody(thread.lastMessage)) continue;

        const contactKey = thread.name.toLowerCase().trim();
        const cursor = cursors.get(contactKey) ?? 0;
        // Sidebar non dà timestamp preciso → usiamo "ora" come ts del messaggio
        // ricevuto, ma confrontiamo body_text col messaggio noto per de-dup.
        // Skip se già abbiamo un messaggio recentissimo con lo stesso testo.
        if (cursor > 0 && nowMs - cursor < 60_000) {
          // protezione anti-doppio-click
          continue;
        }
        const ts = new Date(nowMs).toISOString();
        const extId = buildDeterministicId("li", thread.name, thread.lastMessage, ts);
        const res = await upsertChannelMessageDedup({
          user_id: user.id,
          operator_id: operatorId,
          channel: "linkedin" as never,
          direction: "inbound" as never,
          from_address: thread.name,
          body_text: thread.lastMessage,
          message_id_external: extId,
          thread_id: thread.threadUrl || null,
        });
        if (res.inserted) newMsgs++;
      }

      if (newMsgs > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.all });
        if (!silent) toast.success(`${newMsgs} nuovi messaggi LinkedIn salvati`);
      } else if (!silent) {
        toast.info("Nessun nuovo messaggio LinkedIn");
      }
      window.dispatchEvent(new CustomEvent("li-sync-completed", {
        detail: { newMessages: newMsgs },
      }));
      window.dispatchEvent(new CustomEvent("channel-sync-done", { detail: { channel: "linkedin" } }));
      setLastSyncAt(Date.now());
    } catch (err: unknown) {
      log.warn("sync error", { message: err instanceof Error ? err.message : String(err) });
      if (!silent) toast.error(`Errore sync: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsReading(false);
    }
  }, [isAvailable, readInbox, queryClient]);

  return { isReading, isAvailable, readNow, lastSyncAt };
}
