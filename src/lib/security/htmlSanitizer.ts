/**
 * DEPRECATED SHIM — mantiene compatibilità con i consumer esistenti.
 * L'implementazione reale è in `@/v2/core/security/sanitizeHtml`
 * che usa DOMPurify (industry standard) invece di regex parsing.
 *
 * Consumer nuovi: importare direttamente da `@/v2/core/security/sanitizeHtml`.
 */
export { sanitizeHtml, escapeHtml } from "@/v2/core/security/sanitizeHtml";
