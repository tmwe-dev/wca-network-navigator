/**
 * useFloatingCoPilotVoice — hook voce DEDICATO al Floating Co-Pilot.
 *
 * NON tocca `useCommandRealtimeVoice` né la pagina /v2/command. Vive a parte
 * per poter aggiungere/rimuovere client tools UI senza rischio regressioni
 * sull'esperienza Command Hub.
 *
 * Riusa le stesse edge function (`elevenlabs-conversation-token`,
 * `command-ask-brain`) e lo stesso agent ElevenLabs configurato in dashboard.
 */
import { useCallback, useRef, useState } from "react";
import { useConversation } from "@elevenlabs/react";
import { supabase } from "@/integrations/supabase/client";
import { createLogger } from "@/lib/log";
import { findIntentByKey, listNavigationIntents, matchIntentLocally } from "@/data/uiNavigationMap";

const log = createLogger("useFloatingCoPilotVoice");

export interface CoPilotVoice {
  readonly status: "disconnected" | "connecting" | "connected";
  readonly isSpeaking: boolean;
  readonly error: string | null;
  readonly lastAction: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/** Confirmation dialog handle: il pannello Co-Pilot ascolta `copilot-confirm` e risponde via `copilot-confirm-result`. */
function requestConfirmationViaUi(actionLabel: string): Promise<"ok" | "cancel"> {
  return new Promise((resolve) => {
    const id = `cf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const onResult = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string; result: "ok" | "cancel" } | undefined;
      if (!detail || detail.id !== id) return;
      window.removeEventListener("copilot-confirm-result", onResult);
      resolve(detail.result);
    };
    window.addEventListener("copilot-confirm-result", onResult);
    window.dispatchEvent(new CustomEvent("copilot-confirm", { detail: { id, label: actionLabel } }));
    // Auto-cancel dopo 60s per evitare promise pendenti
    window.setTimeout(() => {
      window.removeEventListener("copilot-confirm-result", onResult);
      resolve("cancel");
    }, 60_000);
  });
}

export function useFloatingCoPilotVoice(opts?: { onAction?: (label: string) => void }): CoPilotVoice {
  const [phase, setPhase] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const bridgeTokenRef = useRef<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const onActionRef = useRef(opts?.onAction);
  onActionRef.current = opts?.onAction;

  const announce = useCallback((label: string) => {
    setLastAction(label);
    onActionRef.current?.(label);
  }, []);

  const conversation = useConversation({
    onConnect: () => setPhase("connected"),
    onDisconnect: () => setPhase("disconnected"),
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn("voice error", { error: msg });
      setError(msg);
    },
    clientTools: {
      // ── ask_brain (riuso edge function esistente) ────────────────
      ask_brain: async (params: { question?: string }) => {
        const question = (params?.question || "").trim();
        if (!question) return "Domanda vuota.";
        try {
          const { data, error: err } = await supabase.functions.invoke("command-ask-brain", {
            body: {
              question,
              bridge_token: bridgeTokenRef.current,
              conversation_id: conversationIdRef.current,
              language: "it",
            },
          });
          if (err) return "Brain non raggiungibile.";
          return (data as { answer?: string } | null)?.answer || "Nessuna risposta.";
        } catch {
          return "Errore tecnico.";
        }
      },

      // ── navigate_to(intent_key | path) ───────────────────────────
      navigate_to: async (params: { intent_key?: string; path?: string; query?: string }) => {
        try {
          let path: string | null = null;
          let filters: Record<string, unknown> = {};
          let modal: string | null = null;

          if (params.intent_key) {
            const intent = await findIntentByKey(params.intent_key);
            if (intent) {
              path = intent.path; filters = intent.default_filters; modal = intent.modal;
            }
          } else if (params.query) {
            const all = await listNavigationIntents({ onlyEnabled: true });
            const matched = matchIntentLocally(params.query, all);
            if (matched) {
              path = matched.path; filters = matched.default_filters; modal = matched.modal;
            }
          } else if (params.path) {
            path = params.path;
          }

          if (!path) return "Destinazione non trovata. Posso elencarti le sezioni disponibili.";

          window.dispatchEvent(new CustomEvent("ai-ui-action", {
            detail: { action_type: "navigate", path },
          }));
          if (Object.keys(filters).length > 0) {
            window.dispatchEvent(new CustomEvent("ai-ui-action", {
              detail: { action_type: "apply_filters", filters },
            }));
          }
          if (modal) {
            window.dispatchEvent(new CustomEvent("ai-ui-action", {
              detail: { action_type: "open_modal", modal, params: {} },
            }));
          }
          announce(`Navigato a ${path}`);
          return `OK, aperto ${path}.`;
        } catch (e) {
          return `Errore navigazione: ${e instanceof Error ? e.message : String(e)}`;
        }
      },

      // ── apply_filter(scope, filters) ─────────────────────────────
      apply_filter: (params: { scope?: string; filters?: Record<string, unknown> }) => {
        const scope = params.scope || "global";
        const filters = params.filters || {};
        window.dispatchEvent(new CustomEvent("ai-ui-action", {
          detail: { action_type: "apply_filters", scope, filters },
        }));
        announce(`Filtri applicati (${scope})`);
        return "Filtri applicati.";
      },

      // ── open_modal(name, params) ─────────────────────────────────
      open_modal: (params: { name?: string; params?: Record<string, unknown> }) => {
        if (!params.name) return "Nome modale mancante.";
        window.dispatchEvent(new CustomEvent("ai-ui-action", {
          detail: { action_type: "open_modal", modal: params.name, params: params.params || {} },
        }));
        announce(`Modale ${params.name} aperta`);
        return `Modale ${params.name} richiesta.`;
      },

      // ── highlight_element({ selector | text, hint }) ─────────────
      highlight_element: (params: { selector?: string; text?: string; hint?: string; duration_ms?: number }) => {
        window.dispatchEvent(new CustomEvent("ai-ui-action", {
          detail: {
            action_type: "highlight",
            selector: params.selector,
            text: params.text,
            hint: params.hint,
            durationMs: params.duration_ms,
          },
        }));
        announce(`Evidenziato: ${params.text || params.selector || "elemento"}`);
        return "Elemento evidenziato.";
      },

      // ── request_confirmation(action_label) ───────────────────────
      request_confirmation: async (params: { action_label?: string }) => {
        const label = params.action_label || "questa azione";
        const result = await requestConfirmationViaUi(label);
        announce(`Conferma ${label}: ${result}`);
        return result === "ok" ? "Confermato." : "Annullato dall'utente.";
      },
    },
  });

  const start = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: {} },
      );
      if (invokeErr) throw invokeErr;
      const payload = data as { token?: string; bridge_token?: string } | null;
      const token = payload?.token;
      bridgeTokenRef.current = payload?.bridge_token || null;
      if (!token) throw new Error("Token ElevenLabs non ricevuto");

      await conversation.startSession({ conversationToken: token, connectionType: "webrtc" });
      try { conversationIdRef.current = conversation.getId() || null; } catch { /* noop */ }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn("start failed", { error: msg });
      setError(msg);
      setPhase("disconnected");
    }
  }, [conversation]);

  const stop = useCallback(async () => {
    try { await conversation.endSession(); }
    catch (e) { log.warn("stop failed", { error: e instanceof Error ? e.message : String(e) }); }
    finally { setPhase("disconnected"); }
  }, [conversation]);

  return { status: phase, isSpeaking: conversation.isSpeaking, error, lastAction, start, stop };
}