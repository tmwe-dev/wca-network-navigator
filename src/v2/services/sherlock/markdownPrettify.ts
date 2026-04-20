/**
 * markdownPrettify — pulisce il markdown grezzo restituito dallo scraper
 * (Google Maps, siti aziendali, LinkedIn) prima del rendering UI.
 *
 * Regole deterministiche, no AI: rimuove rumore di navigazione, compatta tabelle
 * orari, deduplica righe, tronca a 800 righe.
 */

const NOISE_PATTERNS: RegExp[] = [
  // Google Maps UI
  /^\s*(Visualizza foto|View photos|Salva|Save|Condividi|Share|Invia al telefono|Send to phone)\s*$/gim,
  /^\s*(Suggerisci (?:nuovi orari|una modifica|un'?\s*modifica)|Suggest an edit|Suggest new hours)\s*$/gim,
  /^\s*(Cronologia di Maps|Maps history|Aggiungi un'?\s*etichetta|Add a label)\s*$/gim,
  /^\s*(Orari di punta|Popular times|Confronta gli orari di punta)\s*$/gim,
  /^\s*(Indicazioni stradali|Directions|Avvia indicazioni|Start)\s*$/gim,
  /^\s*(Aggiungi (?:foto|nota|orari)|Add (?:photo|note|hours))\s*$/gim,
  /^\s*(Rivendica questa attività|Claim this business|Possiedi questa attività)\s*$/gim,
  /^\s*(Recensioni|Reviews|Scrivi una recensione|Write a review)\s*$/gim,
  /^\s*(Mappa|Map)\s*$/gim,
  // Cookie banner & footer
  /^\s*(Accetta tutto|Accept all|Rifiuta tutto|Reject all|Personalizza|Customize)\s*$/gim,
  /^\s*(Privacy|Termini|Terms|Cookie|Cookies)(\s+(?:Policy|policy))?\s*$/gim,
  // Google Search SERP noise
  /^\s*Web results\s*$/gim,
  /^\s*Source:\s*https?:\/\/.*$/gim,
  /^\s*Missing:\s*[^|\n]*\|\s*Show results with:.*$/gim,
  /\.\.\.\s*Read more/gi,
  /^\s*Read more\s*$/gim,
  /^\s*See more results\s*$/gim,
  /^\s*People also ask\s*$/gim,
  /^\s*Related searches\s*$/gim,
  /^\s*Images? for\s+.*$/gim,
  /^\s*Videos? for\s+.*$/gim,
  // Reaction/like footers ripetuti ("Facebook · WCAworld5 reactions · 3 months ago")
  /^\s*(?:Facebook|Instagram|LinkedIn|Twitter|X)\s*·\s*[^·\n]+·\s*\d+\s*(?:reactions?|likes?|comments?|followers?)[^\n]*$/gim,
  // Generic boilerplate
  /^\s*\[Learn more\]\(https?:\/\/[^)]+\)\s*$/gim,
  /^\s*Skip to (main content|navigation)\s*$/gim,
  // "Show more"/"Show less" toggles
  /^\s*(Show more|Show less|Mostra altro|Mostra meno)\s*$/gim,
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
