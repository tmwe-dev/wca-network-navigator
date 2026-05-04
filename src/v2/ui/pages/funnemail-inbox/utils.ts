/**
 * Helpers UI per il client Funnemail. Pure, no side-effect.
 */

const PREFIX_RE = /^\s*(re|r|fwd|fw|i|res|ris|antw|aw)\s*:\s*/i;

/** Rimuove ricorsivamente prefissi tipo "Re:", "R:", "Fwd:", "I:". */
export function stripReplyPrefixes(subject: string | null | undefined): string {
  if (!subject) return "";
  let out = subject;
  // safety cap a 8 iterazioni
  for (let i = 0; i < 8; i++) {
    const next = out.replace(PREFIX_RE, "");
    if (next === out) break;
    out = next;
  }
  return out.trim();
}

/** "Mario Rossi <a@b.com>" → "Mario Rossi". Senza display name → "a" (local part). */
export function extractSenderName(raw: string | null | undefined): string {
  if (!raw) return "—";
  const m = raw.match(/^"?([^"<]+?)"?\s*<([^>]+)>\s*$/);
  if (m) {
    const display = m[1].trim();
    if (display) return display;
    return m[2].split("@")[0];
  }
  if (raw.includes("@")) {
    const local = raw.split("@")[0].trim();
    // capitalizza separatori comuni
    return local
      .replace(/[._-]+/g, " ")
      .split(" ")
      .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
      .join(" ");
  }
  return raw.trim();
}

/** Snippet pulito da body_text (no whitespace doppi, max N caratteri). */
export function makeSnippet(text: string | null | undefined, max = 200): string {
  if (!text) return "";
  const cleaned = text
    .replace(/\r/g, " ")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (cleaned.length <= max) return cleaned;
  return cleaned.slice(0, max).trimEnd() + "…";
}
