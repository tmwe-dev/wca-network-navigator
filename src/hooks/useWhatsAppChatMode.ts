/**
 * useWhatsAppChatMode — Modalità "chat in tempo reale" per una singola
 * conversazione WhatsApp.
 *
 * Comportamento:
 *  - quando attivo, ogni 5s esegue `syncSingleThread(contact)` (solo quel
 *    thread, niente sidebar walk).
 *  - viene attivato esplicitamente (toggle UI) o automaticamente quando
 *    l'utente clicca il refresh manuale entro 30s da un proprio invio
 *    (auto-detect).
 *  - dopo `IDLE_TICKS_BEFORE_AUTO_OFF` tick consecutivi senza nuovi messaggi
 *    e senza nuovi invii utente, si auto-disattiva e lascia la parola al
 *    sync di background.
 *
 * Side effects gestiti:
 *  - mette in pausa il timer di `useWhatsAppAutoSync` via flag globale
 *    (`__waChatModeActive`) consumato dal background hook.
 */
import { useEffect, useRef, useState, useCallback } from "react";

const TICK_MS = 5000;
const IDLE_TICKS_BEFORE_AUTO_OFF = 6; // 6 × 5s = 30s di silenzio
const AUTO_DETECT_WINDOW_MS = 30_000;

type Source = "manual" | "auto";

interface Options {
  contact: string | null;
  syncSingleThread: (contact: string) => Promise<number>;
}

declare global {
  interface Window {
    __waChatModeActive?: boolean;
    __waLastUserSendAt?: number;
  }
}

export function useWhatsAppChatMode({ contact, syncSingleThread }: Options) {
  const [active, setActive] = useState(false);
  const [source, setSource] = useState<Source>("manual");
  const idleTicksRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningRef = useRef(false);
  const contactRef = useRef<string | null>(contact);

  useEffect(() => { contactRef.current = contact; }, [contact]);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setActive(false);
    window.__waChatModeActive = false;
    idleTicksRef.current = 0;
  }, []);

  const start = useCallback((src: Source = "manual") => {
    if (!contactRef.current) return;
    setSource(src);
    setActive(true);
    window.__waChatModeActive = true;
    idleTicksRef.current = 0;
  }, []);

  // Auto-detect: se l'utente clicca il refresh entro 30s da un invio → on.
  useEffect(() => {
    function onTrigger() {
      const last = window.__waLastUserSendAt ?? 0;
      if (!active && contactRef.current && Date.now() - last <= AUTO_DETECT_WINDOW_MS) {
        start("auto");
      }
    }
    window.addEventListener("wa-sync-trigger", onTrigger);
    return () => window.removeEventListener("wa-sync-trigger", onTrigger);
  }, [active, start]);

  // Stop quando si cambia chat / si chiude il thread.
  useEffect(() => {
    if (active && !contact) stop();
  }, [contact, active, stop]);

  // Tick loop.
  useEffect(() => {
    if (!active || !contact) return;
    let cancelled = false;

    async function tick() {
      if (cancelled || runningRef.current) return;
      const c = contactRef.current;
      if (!c) return;
      runningRef.current = true;
      try {
        const newCount = await syncSingleThread(c);
        const lastSend = window.__waLastUserSendAt ?? 0;
        const recentSend = Date.now() - lastSend <= AUTO_DETECT_WINDOW_MS;
        if (newCount > 0 || recentSend) {
          idleTicksRef.current = 0;
        } else {
          idleTicksRef.current += 1;
          if (idleTicksRef.current >= IDLE_TICKS_BEFORE_AUTO_OFF) {
            stop();
          }
        }
      } finally {
        runningRef.current = false;
      }
    }

    // primo tick rapido (1s) poi cadenza standard
    const first = setTimeout(tick, 1000);
    timerRef.current = setInterval(tick, TICK_MS);
    return () => {
      cancelled = true;
      clearTimeout(first);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [active, contact, syncSingleThread, stop]);

  const toggle = useCallback(() => {
    if (active) stop(); else start("manual");
  }, [active, start, stop]);

  return { active, source, start, stop, toggle };
}

/** Marca un invio utente per abilitare l'auto-detect del chat mode. */
export function markUserSentMessage() {
  window.__waLastUserSendAt = Date.now();
}