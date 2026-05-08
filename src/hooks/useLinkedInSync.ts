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
import { upsertChannelMessageDedup } from "@/data/channelMessages";
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

  const { isAvailable, readInbox, readThread } = useLinkedInMessagingBridge();
  const queryClient = useQueryClient();

  const errMsg = (e: unknown): string => {
    if (!e) return "errore sconosciuto";
    if (typeof e === "string") return e;
    if (e instanceof Error) return e.message;
    if (typeof e === "object") {
      const r = e as Record<string, unknown>;
      if (typeof r.error === "string") return r.error;
      if (typeof r.message === "string") return r.message;
      try { return JSON.stringify(r).slice(0, 200); } catch { return "errore"; }
    }
    return String(e);
  };

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

      // Dedup garantito da extId stabile (hash testo) — no cursori temporali.

      let newMsgs = 0;
      for (const thread of result.threads) {
        if (!thread.lastMessage || !thread.name) continue;
        if (isUiLabel(thread.name)) continue;
        if (isGhostBody(thread.lastMessage)) continue;

        // 1) Salva sempre il preview della sidebar (dedup stabile via hash testo, no timestamp)
        const extIdPreview = buildDeterministicId("li", thread.name, thread.lastMessage, "");
        const tsIso = new Date().toISOString();
        try {
          const res = await upsertChannelMessageDedup({
            user_id: user.id,
            operator_id: operatorId,
            channel: "linkedin" as never,
            direction: "inbound" as never,
            from_address: thread.name,
            body_text: thread.lastMessage,
            message_id_external: extIdPreview,
            thread_id: thread.threadUrl || null,
            created_at: tsIso,
          } as never);
          if (res.inserted) newMsgs++;
        } catch (e) {
          log.warn("preview upsert failed", { error: errMsg(e) });
        }

        // 2) Se thread non letto E abbiamo URL, apri thread per recuperare conversazione completa
        if (thread.unread && thread.threadUrl) {
          try {
            const tr = await readThread(thread.threadUrl);
            if (tr.success && Array.isArray(tr.messages)) {
              for (const m of tr.messages) {
                const text = String(m.text || "").trim();
                if (!text || isGhostBody(text)) continue;
                const direction = (m.direction === "outbound" ? "outbound" : "inbound") as "inbound" | "outbound";
                const extId = buildDeterministicId(
                  direction === "outbound" ? "li_out" : "li",
                  thread.name,
                  text,
                  "",
                );
                try {
                  const r = await upsertChannelMessageDedup({
                    user_id: user.id,
                    operator_id: operatorId,
                    channel: "linkedin" as never,
                    direction: direction as never,
                    from_address: direction === "inbound" ? thread.name : undefined,
                    to_address: direction === "outbound" ? thread.name : undefined,
                    body_text: text,
                    message_id_external: extId,
                    thread_id: thread.threadUrl,
                    created_at: new Date().toISOString(),
                  } as never);
                  if (r.inserted) newMsgs++;
                } catch (e) {
                  log.warn("thread msg upsert failed", { error: errMsg(e) });
                }
              }
            }
          } catch (e) {
            log.warn("readThread failed", { thread: thread.name, error: errMsg(e) });
          }
        }
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
      log.warn("sync error", { message: errMsg(err) });
      if (!silent) toast.error(`Errore sync: ${errMsg(err)}`);
    } finally {
      setIsReading(false);
    }
  }, [isAvailable, readInbox, readThread, queryClient]);

  return { isReading, isAvailable, readNow, lastSyncAt };
}
