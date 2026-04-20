/**
 * Renderer template URL Sherlock — sostituisce {var} con vars[var] (URL-encoded).
 * Variabili mancanti restano come {var} → lo step viene saltato.
 */

const VAR_RE = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export function renderUrlTemplate(
  template: string,
  vars: Record<string, string | undefined>,
): { url: string; missing: string[] } {
  const missing: string[] = [];
  const url = template.replace(VAR_RE, (_m, key: string) => {
    const raw = vars[key];
    if (raw === undefined || raw === null || raw === "") {
      missing.push(key);
      return `{${key}}`;
    }
    // Per URL completi (websiteUrl, decisionMakerLinkedinUrl) NON encodiamo
    if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
    return encodeURIComponent(raw);
  });
  return { url, missing };
}

export function checkRequiredVars(
  required: string[],
  vars: Record<string, string | undefined>,
): { ok: boolean; missing: string[] } {
  const missing = required.filter((v) => !vars[v]);
  return { ok: missing.length === 0, missing };
}
