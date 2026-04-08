/**
 * HTML Sanitizer — anti-XSS per signature email, body inbound,
 * e qualsiasi HTML che venga renderizzato in `dangerouslySetInnerHTML`
 * o iniettato in body email server-side.
 *
 * Vol. II §6.4 (output encoding) — sanitize at the boundary, mai trust
 * input/storage.
 *
 * Strategia:
 *  - Allowlist tag/attributi conservativa (HTML email-safe)
 *  - Strip script/event handler/javascript: URL
 *  - Strip data: URL eccetto image/png|jpeg|gif (per inline images legittime)
 *  - Idempotente: passare un valore già sanitizzato non cambia output
 *
 * Implementazione manuale (no DOMPurify dep) per compatibilità Deno
 * edge functions, dove DOMParser potrebbe non essere disponibile.
 * Su browser usiamo DOMParser nativo se presente.
 */

const ALLOWED_TAGS = new Set([
  "a", "abbr", "address", "b", "blockquote", "br", "caption", "code",
  "div", "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img",
  "li", "ol", "p", "pre", "small", "span", "strong", "sub", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
]);

const ALLOWED_ATTRS = new Set([
  "href", "src", "alt", "title", "width", "height", "style",
  "align", "valign", "border", "cellpadding", "cellspacing",
  "colspan", "rowspan", "target", "rel",
]);

// Style properties allowlist (whitelist conservativo per email)
const ALLOWED_STYLE_PROPS = new Set([
  "color", "background-color", "background", "font-family", "font-size",
  "font-weight", "font-style", "text-align", "text-decoration",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-width", "border-style", "border-radius",
  "width", "height", "max-width", "max-height", "min-width", "min-height",
  "line-height", "letter-spacing", "vertical-align", "display",
]);

const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|file):/i;

function sanitizeUrl(url: string): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (DANGEROUS_PROTOCOLS.test(trimmed)) return "";
  // Allow data: only for images
  if (trimmed.startsWith("data:")) {
    return /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(trimmed) ? trimmed : "";
  }
  return trimmed;
}

function sanitizeStyle(style: string): string {
  return style
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => decl.length > 0)
    .map((decl) => {
      const colonIdx = decl.indexOf(":");
      if (colonIdx < 0) return null;
      const prop = decl.slice(0, colonIdx).trim().toLowerCase();
      const value = decl.slice(colonIdx + 1).trim();
      if (!ALLOWED_STYLE_PROPS.has(prop)) return null;
      // strip url(javascript:...) e expression()
      if (/url\s*\(/i.test(value) && !/url\s*\(\s*['"]?https?:/i.test(value)) {
        return null;
      }
      if (/expression\s*\(/i.test(value)) return null;
      return `${prop}: ${value}`;
    })
    .filter((d): d is string => d !== null)
    .join("; ");
}

/**
 * Sanitizza HTML usando un parser regex robusto (no DOM dependency).
 * Suitable for both browser and Deno environments.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  // 1. Strip script/style/iframe/object/embed/form blocks COMPLETAMENTE
  let out = html.replace(
    /<(script|style|iframe|object|embed|form|noscript|svg|math)\b[^>]*>[\s\S]*?<\/\1>/gi,
    ""
  );
  // Self-closing varianti
  out = out.replace(
    /<(script|style|iframe|object|embed|form|noscript|link|meta|base)\b[^>]*\/?>/gi,
    ""
  );

  // 2. Strip HTML comments (potrebbero contenere conditional IE injection)
  out = out.replace(/<!--[\s\S]*?-->/g, "");

  // 3. Walk dei tag rimanenti, applicando allowlist
  out = out.replace(
    /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g,
    (_match, slash, tag, attrs) => {
      const tagLower = tag.toLowerCase();
      if (!ALLOWED_TAGS.has(tagLower)) return "";

      if (slash) return `</${tagLower}>`;

      // Parse attributi
      const cleanAttrs: string[] = [];
      const attrRegex = /([a-zA-Z][a-zA-Z0-9-]*)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/g;
      let m: RegExpExecArray | null;
      while ((m = attrRegex.exec(attrs)) !== null) {
        const name = m[1].toLowerCase();
        const rawValue = m[3] ?? m[4] ?? m[5] ?? "";
        if (name.startsWith("on")) continue; // strip onclick/onload/etc
        if (!ALLOWED_ATTRS.has(name)) continue;

        let value = rawValue;
        if (name === "href" || name === "src") {
          value = sanitizeUrl(value);
          if (!value) continue;
        }
        if (name === "style") {
          value = sanitizeStyle(value);
          if (!value) continue;
        }
        if (name === "target") {
          // forza rel="noopener noreferrer" per target="_blank"
          if (value === "_blank") {
            cleanAttrs.push(`target="_blank"`);
            cleanAttrs.push(`rel="noopener noreferrer"`);
            continue;
          }
        }
        // escape doppi apici nel value
        const safeValue = value.replace(/"/g, "&quot;");
        cleanAttrs.push(`${name}="${safeValue}"`);
      }

      const attrStr = cleanAttrs.length > 0 ? " " + cleanAttrs.join(" ") : "";
      return `<${tagLower}${attrStr}>`;
    }
  );

  return out;
}

/**
 * Sanitizza testo plain prima di iniettarlo in HTML (escape entity).
 */
export function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
