// Lazy init Sentry in production only
if (import.meta.env.PROD) {
  import("./lib/sentry").then((m) => m.initSentry());
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installRemoteSink } from "@/lib/log/remoteSink";
import { installGlobalErrorCatchers } from "@/lib/errorCatchers";
import "./i18n";

document.documentElement.classList.add('dark');

// Applica il tema visivo persistito (Amber/Lilac/Space/Notte) PRIMA del render
// per evitare flash. Stesse chiavi usate da ThemePicker.
try {
  const stored = localStorage.getItem('wcann.theme');
  const valid = ['amber', 'lilac', 'space', 'notte'];
  if (stored && valid.includes(stored) && stored !== 'amber') {
    document.documentElement.classList.add(`theme-${stored}`);
  }
} catch { /* ignore */ }

// ── PWA: guard against iframe/preview contexts ──
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

// Vol. II §11.4 — sink remoto env-gated. No-op se VITE_REMOTE_LOG_ENDPOINT
// non è impostato (deploy senza credenziali continua a funzionare).
installRemoteSink();
installGlobalErrorCatchers();

createRoot(document.getElementById("root")!).render(<App />);
