/**
 * useWhatsAppNewMessagesIndicator — Counter "nuovi messaggi WA non visti".
 * Ascolta `wa-sync-completed` e somma i nuovi messaggi.
 * Reset:
 *  - evento `wa-indicator-clear`
 *  - utente naviga su rotte WA (Inbox/Outreach WA)
 * Persistito in sessionStorage.
 */
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

const KEY = "wa_unseen_messages";
const WA_ROUTE_PATTERNS = [/whatsapp/i, /\/v2\/inbox/i, /\/v2\/outreach/i];

function load(): number {
  try {
    const v = sessionStorage.getItem(KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch { return 0; }
}
function save(n: number) {
  try { sessionStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
}

export function useWhatsAppNewMessagesIndicator() {
  const [count, setCount] = useState<number>(() => load());
  const [pulse, setPulse] = useState(false);
  const location = useLocation();

  useEffect(() => {
    function onSync(e: Event) {
      const detail = (e as CustomEvent).detail as { newMessages?: number } | undefined;
      const n = detail?.newMessages ?? 0;
      if (n > 0) {
        setCount((prev) => {
          const next = prev + n;
          save(next);
          return next;
        });
        setPulse(true);
        window.setTimeout(() => setPulse(false), 4000);
      }
    }
    function onClear() {
      save(0);
      setCount(0);
    }
    window.addEventListener("wa-sync-completed", onSync as EventListener);
    window.addEventListener("wa-indicator-clear", onClear);
    return () => {
      window.removeEventListener("wa-sync-completed", onSync as EventListener);
      window.removeEventListener("wa-indicator-clear", onClear);
    };
  }, []);

  // Reset quando l'utente naviga su una pagina WA-related.
  useEffect(() => {
    if (WA_ROUTE_PATTERNS.some((re) => re.test(location.pathname))) {
      if (count !== 0) {
        save(0);
        setCount(0);
      }
    }
  }, [location.pathname, count]);

  return { count, pulse, clear: () => window.dispatchEvent(new CustomEvent("wa-indicator-clear")) };
}