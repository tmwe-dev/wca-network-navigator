/**
 * LinkedIn Sync — download messaggi via estensione.
 * Usa cursor per-contatto: salva SOLO i messaggi nuovi rispetto al DB.
 * Filtra etichette UI ("Da leggere", "Tutti", ...) e ghost preview ("foto", "audio", ...).
 * Chiamato sia manualmente (bottone "Leggi") sia dall'auto-sync lento.
 */
import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInMessagingBridge, type LinkedInThreadDTO, type LinkedInMessageDTO } from "./useLinkedInMessagingBridge";
import { buildDeterministicId } from "@/lib/messageDedup";
import { createLogger } from "@/lib/log";

const log = createLogger("useLinkedInSync");
import { toast } from "sonner";
import { upsertChannelMessageDedup } from "@/data/channelMessages";
import { queryKeys } from "@/lib/queryKeys";
import { tryAcquire, throttle, SyncGuardBusyError } from "@/lib/syncGuard";

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

// P0.3 — Chiave dedup composita: mai solo nome.
function buildDedupKey(t: LinkedInThreadDTO): string {
  return (
    t.threadUrl ||
    t.profileUrl ||
    t.linkedinId ||
    t.profileId ||
    `${(t.name || "").toLowerCase().trim()}|${(t.lastMessage || "").toLowerCase().trim()}|${t.lastActivity || ""}`
  );
}

// Estrae profile_slug stabile da profileUrl /in/<slug> oppure linkedinId.
function extractProfileSlug(t: LinkedInThreadDTO): string | null {
  if (t.profileId) return t.profileId;
  if (t.linkedinId) return t.linkedinId;
  if (t.profileUrl) {
    const m = t.profileUrl.match(/\/in\/([^/?#]+)/i);
    if (m) return decodeURIComponent(m[1]);
  }
  if (t.threadUrl) {
    const m = t.threadUrl.match(/\/in\/([^/?#]+)/i);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

// P0.3 — Address chiave per channel_messages: ID stabile, mai nome.
function buildContactAddress(t: LinkedInThreadDTO): string {
  return t.profileUrl || t.linkedinId || t.profileId || t.threadUrl || `name:${t.name}`;
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
    // Single-op guard
    let guard!: import("@/lib/syncGuard").GuardToken;
    try {
      guard = tryAcquire("linkedin", "Lettura inbox");
    } catch (e) {
      if (e instanceof SyncGuardBusyError) {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("sync-guard-blocked", { detail: { channel: "linkedin" } }));
        }
        if (!silent) toast.warning("LinkedIn: un'operazione è già in corso, attendi.");
        return;
      }
      throw e;
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

      await throttle("linkedin", "ping", "Ping estensione");
      const result = await readInbox();
      log.debug("readInbox result", { preview: JSON.stringify(result).slice(0, 500) });
      // Diagnostica visibile: l'utente segnalava "tutte aggiornate ma 0 scaricati".
      if (!silent) {
        const n = Array.isArray(result.threads) ? result.threads.length : 0;
        toast.info(`LinkedIn bridge: ${n} thread visibili nella sidebar`);
      }

      if (!result.success) {
        if (!silent) toast.error(`Lettura LinkedIn fallita: ${result.error || "errore sconosciuto"}`);
        return;
      }

      if (!result.threads?.length) {
        if (!silent) toast.info("Nessun thread LinkedIn trovato nell'inbox");
        return;
      }

      // P0.1 — Dedup composita lato sync (oltre a quella già fatta dall'estensione).
      const seenKeys = new Set<string>();
      const threads = (result.threads as LinkedInThreadDTO[]).filter((t) => {
        const k = buildDedupKey(t);
        if (!k || seenKeys.has(k)) return false;
        seenKeys.add(k);
        return true;
      });

      let newMsgs = 0;
      for (const thread of threads) {
        if (!thread.lastMessage || !thread.name) continue;
        if (isUiLabel(thread.name)) continue;
        if (isGhostBody(thread.lastMessage)) continue;

        await throttle("linkedin", "read", `Preview: ${thread.name}`);
        // 1) Salva sempre il preview della sidebar.
        // P0.3 — Scope su ID reale (threadId/threadUrl), non più solo nome.
        const threadScope = thread.threadId || thread.threadUrl || thread.profileUrl || `name:${thread.name}`;
        const extIdPreview = buildDeterministicId("li", thread.name, thread.lastMessage, threadScope);
        const tsIso = new Date().toISOString();
        const contactAddr = buildContactAddress(thread);
        const profileSlug = extractProfileSlug(thread);
        const rawPayload = {
          profileUrl: thread.profileUrl,
          profileId: thread.profileId,
          linkedinId: thread.linkedinId,
          threadUrl: thread.threadUrl,
          threadId: thread.threadId,
          method: thread.method ?? null,
          confidence: thread.confidence ?? null,
        };
        try {
          const res = await upsertChannelMessageDedup({
            user_id: user.id,
            operator_id: operatorId,
            channel: "linkedin" as never,
            direction: "inbound" as never,
            from_address: contactAddr,
            from_name: thread.name,
            body_text: thread.lastMessage,
            message_id_external: extIdPreview,
            thread_id: thread.threadId || thread.threadUrl || null,
            email_date: tsIso,
            raw_payload: rawPayload as never,
            created_at: tsIso,
          } as never);
          if (res.inserted) {
            newMsgs++;
            // P0.4 — Rubrica LinkedIn (best-effort).
            if (profileSlug) {
              try {
                await supabase.rpc("upsert_linkedin_address" as never, {
                  p_user_id: user.id,
                  p_operator_id: operatorId,
                  p_profile_slug: profileSlug,
                  p_profile_url: thread.profileUrl ?? null,
                  p_display_name: thread.name,
                  p_headline: null,
                  p_direction: "inbound",
                  p_message_at: tsIso,
                } as never);
              } catch (e) {
                log.warn("upsert_linkedin_address failed", { error: errMsg(e) });
              }
            }
          }
        } catch (e) {
          log.warn("preview upsert failed", { error: errMsg(e) });
        }

        // 2) Se thread non letto E abbiamo URL, apri thread per recuperare conversazione completa
        if (thread.unread && thread.threadUrl) {
          try {
            await throttle("linkedin", "open", `Apri thread: ${thread.name}`);
            const tr = await readThread(thread.threadUrl);
            if (tr.success && Array.isArray(tr.messages)) {
              await throttle("linkedin", "read", `Leggo messaggi: ${thread.name}`);
              const msgs = tr.messages as LinkedInMessageDTO[];
              for (const m of msgs) {
                const text = String(m.text || "").trim();
                if (!text || isGhostBody(text)) continue;
                // P0.2 — Direction honest. "unknown" da AX/structural: salva come inbound
                // SOLO se il preview era unread (segnale forte che è arrivato qualcosa).
                let direction: "inbound" | "outbound";
                if (m.direction === "outbound") direction = "outbound";
                else if (m.direction === "inbound") direction = "inbound";
                else if (thread.unread === true) direction = "inbound";
                else {
                  log.debug("skip unknown-direction message", { method: m.method, sender: m.sender });
                  continue;
                }
                // Scope al thread + posizione del messaggio nella conversazione,
                // così due bolle identiche nello stesso thread restano distinte.
                const msgScope = `${thread.threadId || thread.threadUrl || thread.name}#${msgs.indexOf(m)}`;
                const extId = buildDeterministicId(
                  direction === "outbound" ? "li_out" : "li",
                  thread.name,
                  text,
                  msgScope,
                );
                const msgIso = m.timestamp && /\d{4}-\d{2}-\d{2}T/.test(m.timestamp) ? m.timestamp : new Date().toISOString();
                try {
                  const r = await upsertChannelMessageDedup({
                    user_id: user.id,
                    operator_id: operatorId,
                    channel: "linkedin" as never,
                    direction: direction as never,
                    from_address: direction === "inbound" ? contactAddr : "me",
                    to_address: direction === "outbound" ? contactAddr : "me",
                    from_name: direction === "inbound" ? thread.name : null,
                    to_name: direction === "outbound" ? thread.name : null,
                    body_text: text,
                    message_id_external: extId,
                    thread_id: thread.threadId || thread.threadUrl,
                    email_date: msgIso,
                    raw_payload: { ...rawPayload, message_method: m.method ?? null, message_confidence: m.confidence ?? null } as never,
                    created_at: new Date().toISOString(),
                  } as never);
                  if (r.inserted) {
                    newMsgs++;
                    if (profileSlug) {
                      try {
                        await supabase.rpc("upsert_linkedin_address" as never, {
                          p_user_id: user.id,
                          p_operator_id: operatorId,
                          p_profile_slug: profileSlug,
                          p_profile_url: thread.profileUrl ?? null,
                          p_display_name: thread.name,
                          p_headline: null,
                          p_direction: direction,
                          p_message_at: msgIso,
                        } as never);
                      } catch (e) {
                        log.warn("upsert_linkedin_address (msg) failed", { error: errMsg(e) });
                      }
                    }
                  }
                } catch (e) {
                  log.warn("thread msg upsert failed", { error: errMsg(e) });
                }
              }
            }
          } catch (e) {
            log.warn("readThread failed", { thread: thread.name, error: errMsg(e) });
          }
          await throttle("linkedin", "betweenThreads", "Pausa tra thread");
        }
      }

      if (newMsgs > 0) {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.all });
        if (!silent) toast.success(`${newMsgs} nuovi messaggi LinkedIn salvati`);
      } else if (!silent) {
        toast.info(`Nessun nuovo messaggio (${threads.length} thread analizzati, già in DB o filtrati)`);
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
      guard.release();
    }
  }, [isAvailable, readInbox, readThread, queryClient]);

  return { isReading, isAvailable, readNow, lastSyncAt };
}
