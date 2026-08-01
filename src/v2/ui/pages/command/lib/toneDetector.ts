/**
 * toneDetector — Estrae il tono richiesto dall'operatore dal prompt naturale.
 *
 * Usato da composeEmail.ts e ComposerCanvas.handleGenerate per passare il
 * parametro `oracle_tone` corretto a `generate-email` invece dell'hardcoded
 * "professionale". Pure function: niente stato, niente effetti.
 */

export type DetectedTone =
  | "amichevole"
  | "professionale"
  | "diretto"
  | "informale";

const PATTERNS: ReadonlyArray<{ tone: DetectedTone; re: RegExp }> = [
  // Amichevole / colloquiale / vecchi compagni
  {
    tone: "amichevole",
    re: /\b(amichevol[ei]|amico|vecchi\s+(?:amici|compagni)|compagn[oi]\s+di\s+scuola|familiare|caloros[oa]|cuore|simpatic[oa])\b/i,
  },
  // Informale / colloquiale / rilassato
  {
    tone: "informale",
    re: /\b(informale|colloquial[ei]|rilassat[oa]|alla\s+mano|tu\s+a\s+tu|naturale|spontane[oa])\b/i,
  },
  // Diretto / breve / no fronzoli
  {
    tone: "diretto",
    re: /\b(diretto|brev[ei]|sintetic[oa]|essenzial[ei]|conciso|al\s+sodo|no\s+fronzoli|punto\s+e\s+basta)\b/i,
  },
  // Esplicito "professionale / formale"
  {
    tone: "professionale",
    re: /\b(professional[ei]|formale|ufficial[ei]|istituzional[ei]|corporate|business)\b/i,
  },
];

/**
 * detectTone — Ritorna il tono dominante nel prompt. Default "professionale".
 * Se più pattern matchano, vince il PRIMO trovato (ordine di priorità sopra).
 */
export function detectTone(prompt: string): DetectedTone {
  const text = (prompt ?? "").toLowerCase();
  for (const { tone, re } of PATTERNS) {
    if (re.test(text)) return tone;
  }
  return "professionale";
}

/**
 * Etichetta IT user-facing per il messaggio dell'Orchestratore nel chat.
 */
export function toneLabel(tone: DetectedTone): string {
  switch (tone) {
    case "amichevole":   return "amichevole";
    case "informale":    return "informale";
    case "diretto":      return "diretto e breve";
    case "professionale":
    default:             return "professionale";
  }
}