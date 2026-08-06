/**
 * Sanitizer HTML centralizzato — SSOT per tutto il codice browser.
 *
 * Perché DOMPurify:
 *  - Battle-tested (Google, GitHub, molti OWASP-listed).
 *  - Parsa HTML col DOM reale del browser (non regex → immune a
 *    mutation XSS del vecchio htmlSanitizer manuale).
 *  - `USE_PROFILES: { html: true }` copre email-safe tag set out of the box.
 *
 * Deno / edge functions: continuare a usare
 * `supabase/functions/_shared/sanitizeHtml.ts` (npm:sanitize-html) —
 * DOMPurify browser richiede DOM globale.
 *
 * API compatibile con il vecchio `@/lib/security/htmlSanitizer` così i
 * consumer possono migrare senza refactor.
 */
import DOMPurify from "dompurify";

// Config email-safe + hardening extra.
// `RETURN_TRUSTED_TYPE: false` garantisce che l'output sia sempre `string`.
const CONFIG: Parameters<typeof DOMPurify.sanitize>[1] = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ["target", "rel"],
  FORBID_TAGS: [
    "style",
    "script",
    "iframe",
    "object",
    "embed",
    "form",
    "noscript",
    "svg",
    "math",
    "input",
    "button",
    "textarea",
    "select",
    "option",
    "meta",
    "link",
    "base",
  ],
  FORBID_ATTR: [
    "onerror",
    "onload",
    "onclick",
    "onmouseover",
    "onfocus",
    "onblur",
    "onchange",
    "onsubmit",
    "style",
    "formaction",
    "srcdoc",
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  RETURN_TRUSTED_TYPE: false,
};

// Hook per forzare rel="noopener noreferrer" su tutti i link target="_blank"
let hooksInstalled = false;
function ensureHooks() {
  if (hooksInstalled) return;
  if (typeof DOMPurify.addHook !== "function") return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node instanceof Element && node.tagName === "A") {
      if (node.getAttribute("target") === "_blank") {
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  });
  hooksInstalled = true;
}

/**
 * Sanitizza HTML non fidato per rendering in `dangerouslySetInnerHTML`.
 * Idempotente. Ritorna stringa vuota se input null/undefined.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  ensureHooks();
  return DOMPurify.sanitize(html, CONFIG) as unknown as string;
}

/**
 * Escape testo plain per iniezione HTML sicura.
 * Compatibile con `escapeHtml` di `@/lib/security/htmlSanitizer`.
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
