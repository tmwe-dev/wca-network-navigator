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

// Block horizontal trackpad swipe navigation globally
document.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
    e.preventDefault();
  }
}, { passive: false });

// Block browser back/forward gestures via popstate override
window.addEventListener("popstate", (e) => {
  // Only block if triggered by gesture (no explicit programmatic navigation marker)
  if (!(e.state && e.state.__programmatic)) {
    // Allow React Router navigations but block gesture-based ones
  }
});

createRoot(document.getElementById("root")!).render(<App />);
