/**
 * planFallback — guardia anti-allucinazione quando il planner restituisce
 * `steps: []` ma il prompt sembra una ricerca reale.
 *
 * In quel caso NON mostriamo il summary del modello (spesso allucina
 * "nessun risultato trovato" senza interrogare il DB) e forziamo un piano
 * a 1 step su `ai-query`, eseguito dallo stesso planRunner (flusso unico).
 *
 * Estratto da `useCommandSubmit.ts` per pulire il master control.
 */

const SEARCH_VERB_RE =
  /\b(cerca|trova|mostra|elenca|lista|visualizza|dammi|quanti|quante|ultimi|recenti)\b/i;

const DOMAIN_NOUN_RE =
  /\b(partner|contatt|prospect|azienda|società|company|attivit|messagg|email|outreach)\b/i;

// Nome proprio nudo (es. "Radiant", "Acme Corp")
const PROPER_NAME_RE = /^[A-ZÀ-Ý][\p{L}\p{N}\s'’.&/-]{1,60}$/u;

/**
 * Ritorna true se il prompt normalizzato ha "sapore" di ricerca e va forzato
 * su `ai-query` invece di mostrare un summary allucinato.
 */
export function shouldForceAiQuery(
  text: string,
  looksLikeSimpleQuery: (t: string) => boolean,
): boolean {
  return (
    looksLikeSimpleQuery(text) ||
    SEARCH_VERB_RE.test(text) ||
    DOMAIN_NOUN_RE.test(text) ||
    PROPER_NAME_RE.test(text.trim())
  );
}
