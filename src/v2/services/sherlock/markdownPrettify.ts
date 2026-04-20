/**
 * markdownPrettify — pulisce il markdown grezzo restituito dallo scraper
 * (Google Maps, siti aziendali, LinkedIn) prima del rendering UI.
 *
 * Regole deterministiche, no AI: rimuove rumore di navigazione, compatta tabelle
 * orari, deduplica righe, tronca a 800 righe.
 */

const NOISE_PATTERNS: RegExp[] = [
  // Google Maps UI
  /^\s*(Visualizza foto|View photos|Salva|Save|Condividi|Share|Invia al telefono|Send to phone)\s*$/im,
  /^\s*(Suggerisci (?:nuovi orari|una modifica|un'?\s*modifica)|Suggest an edit|Suggest new hours)\s*$/im,
  /^\s*(Cronologia di Maps|Maps history|Aggiungi un'?\s*etichetta|Add a label)\s*$/im,
  /^\s*(Orari di punta|Popular times|Confronta gli orari di punta)\s*$/im,
  /^\s*(Indicazioni stradali|Directions|Avvia indicazioni|Start)\s*$/im,
  /^\s*(Aggiungi (?:foto|nota|orari)|Add (?:photo|note|hours))\s*$/im,
  /^\s*(Rivendica questa attività|Claim this business|Possiedi questa attività)\s*$/im,
  /^\s*(Recensioni|Reviews|Scrivi una recensione|Write a review)\s*$/im,
  /^\s*(Mappa|Map)\s*$/im,
  // Cookie banner & footer
  /^\s*(Accetta tutto|Accept all|Rifiuta tutto|Reject all|Personalizza|Customize)\s*$/im,
  /^\s*(Privacy|Termini|Terms|Cookie|Cookies)(\s+(?:Policy|policy))?\s*$/im,
  // Generic boilerplate
  /^\s*\[Learn more\]\(https?:\/\/[^)]+\)\s*$/im,
  /^\s*Source:\s*https?:\/\/.*$/im,
  /^\s*Skip to (main content|navigation)\s*$/im,
];

const HOURS_TABLE_RE =
  /\|\s*(luned[ìi]|marted[ìi]|mercoled[ìi]|gioved[ìi]|venerd[ìi]|sabato|domenica|monday|tuesday|wednesday|thursday|friday|saturday|sunday)[\s\S]{0,800}?\|\s*\n(?:\|\s*[-:|]+\s*\|.*\n)?(?:\|.*\n){0,7}/gi;

function compactHoursTable(md: string): string {
  return md.replace(HOURS_TABLE_RE, (match) => {
    if (/24\s*ore|24\s*hours|aperto\s*24|open\s*24/i.test(match)) {
      return "\n**Orari**: aperto 24/7\n";
    }
    // Estrai righe non-header, una per giorno
    const lines = match
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("|") && !/^[\s|:-]+$/.test(l) && !/^\|\s*\|/.test(l));
    if (lines.length === 0) return "\n**Orari**: vedi sito\n";
    const compact = lines
      .map((l) =>
        l
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim())
          .filter(Boolean)
          .join(" → "),
      )
      .filter(Boolean);
    return "\n**Orari**\n" + compact.map((c) => `- ${c}`).join("\n") + "\n";
  });
}

function dedupeConsecutiveLines(md: string): string {
  const out: string[] = [];
  let prev = "";
  for (const line of md.split("\n")) {
    const norm = line.trim();
    if (norm && norm === prev) continue;
    out.push(line);
    prev = norm;
  }
  return out.join("\n");
}

function collapseBlankLines(md: string): string {
  return md.replace(/\n{3,}/g, "\n\n");
}

function stripNoisePatterns(md: string): string {
  let out = md;
  for (const re of NOISE_PATTERNS) {
    out = out.replace(re, "");
  }
  return out;
}

function truncate(md: string, maxLines = 800): string {
  const lines = md.split("\n");
  if (lines.length <= maxLines) return md;
  return (
    lines.slice(0, maxLines).join("\n") +
    `\n\n_[…contenuto troncato per leggibilità — ${lines.length - maxLines} righe omesse]_\n`
  );
}

export interface PrettifyOptions {
  /** Numero massimo righe (default 800). */
  maxLines?: number;
  /** Se true, rimuove anche i blocchi tabella orari (default true). */
  compactHours?: boolean;
}

export function prettifyScrapedMarkdown(raw: string, opts: PrettifyOptions = {}): string {
  if (!raw || typeof raw !== "string") return "";
  const { maxLines = 800, compactHours = true } = opts;

  let md = raw;
  if (compactHours) md = compactHoursTable(md);
  md = stripNoisePatterns(md);
  md = dedupeConsecutiveLines(md);
  md = collapseBlankLines(md);
  md = truncate(md.trim(), maxLines);
  return md;
}
