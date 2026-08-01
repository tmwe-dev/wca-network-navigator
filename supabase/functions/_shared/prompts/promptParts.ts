/**
 * promptParts.ts — building blocks deterministici per i system/user prompt.
 *
 * Queste funzioni puro-funzionali sono la **single source of truth** per i
 * frammenti di prompt che venivano duplicati tra
 * `generate-email/promptBuilder.ts` e `generate-outreach/promptBuilder.ts`:
 *
 *   - rilevamento holding-pattern dalla categoria di un email_address_rule
 *   - blocco "ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO EMAIL"
 *   - blocco "STATO COMMERCIALE" + tono per fase del 9-stati lead funnel
 *
 * Nessuna I/O, nessuna dipendenza Supabase: sono helper testabili offline.
 * Tutti i builder edge devono passare da qui per garantire coerenza tra
 * canali (email, outreach multi-canale, classify, ecc.).
 */

/** Pattern testuali che identificano una categoria "holding pattern". */
const HOLDING_PATTERN_KEYWORDS = [
  "attesa",
  "hold",
  "pausa",
  "pending",
  "paused",
  "on_hold",
  "holding",
] as const;

/** Vero se la categoria (lowercased) contiene un segnale di holding pattern. */
export function isHoldingPatternCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  for (const k of HOLDING_PATTERN_KEYWORDS) {
    if (c.includes(k)) return true;
  }
  return false;
}

export interface AddressPriorityInput {
  addressCustomPrompt?: string | null;
  addressCategory?: string | null;
}

/**
 * Blocco "ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO EMAIL".
 *
 * Replica esatta della logica precedentemente duplicata nei due promptBuilder.
 * Restituisce stringa vuota se né custom prompt né categoria sono presenti.
 */
export function buildAddressPriorityBlock(input: AddressPriorityInput): string {
  const { addressCustomPrompt, addressCategory } = input;
  if (!addressCustomPrompt && !addressCategory) return "";
  const parts: string[] = [];
  if (addressCustomPrompt) {
    parts.push(`⚠️ ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO EMAIL:\n${addressCustomPrompt}`);
  }
  if (addressCategory) {
    if (isHoldingPatternCategory(addressCategory)) {
      parts.push(
        `\nCATEGORIA CONTATTO: ${addressCategory}\n→ HOLDING PATTERN RILEVATO: questo contatto è in fase di attesa pianificata.\n  ADATTAMENTI: tono amichevole ma non pressante, mantieni punto di contatto aperto per riattivazione futura, evita CTA aggressivi.`,
      );
    } else {
      parts.push(`\nCATEGORIA CONTATTO: ${addressCategory}`);
    }
  }
  return parts.join("\n\n") + "\n\n";
}

export interface CommercialStateInput {
  commercialState?: string | null;
  touchCount?: number | null;
  lastChannel?: string | null;
  lastOutcome?: string | null;
  daysSinceLastContact?: number | null;
  warmthScore?: number | null;
  /** Se valorizzato, sovrascrive il tono in modalità holding-pattern (priorità manuale). */
  addressCategory?: string | null;
  /**
   * Strategia di tono:
   *  - "by_state": mappa esplicita per il 9-stati funnel (usato in outreach multicanale).
   *  - "by_warmth": logica heuristic touch/warmth (usato in generate-email).
   * Default: "by_state".
   */
  toneStrategy?: "by_state" | "by_warmth";
}

const STATE_TO_TONE: Record<string, string> = {
  new: "PRIMO CONTATTO — Freddo-professionale. Presentati brevemente, vai al punto. Nessuna familiarità.",
  first_touch_sent: "FOLLOW-UP INIZIALE — Professionale con riferimento al primo messaggio. Non ripresentarti. Aggiungi valore.",
  holding: "RIATTIVAZIONE — Cordiale, richiamo al contatto precedente. Nuova ragione di contatto, valore concreto.",
  engaged: "DIALOGO ATTIVO — Collega amichevole, riferimenti specifici. Puoi essere diretto e propositivo.",
  qualified: "QUALIFICATO — Partner diretto, proposta di valore. Focus su next steps concreti.",
  negotiation: "TRATTATIVA — Partner diretto, dettagli operativi. Focus su termini, condizioni, chiusura.",
  converted: "CLIENTE — Pari livello, tono collaborativo. Relazione consolidata.",
  archived: "RIATTIVAZIONE — Cordiale, verifica interesse. Nuova ragione di contatto.",
};

function pickToneByWarmth(touchCount: number, warmth: number, isHolding: boolean): string {
  if (isHolding) {
    return "CIRCUITO DI ATTESA: Tono cordiale ma non insistente. Mantieni punto di contatto aperto. Suggerisci riattivazione con pretesto leggero. NON CTA aggressivi.";
  }
  if (touchCount === 0) return "PRIMO CONTATTO: Tono freddo-professionale. Breve. CTA basso impegno. NON vendere.";
  if (touchCount <= 3 && warmth < 50) return "FOLLOW-UP INIZIALE: Tono cordiale. Riferirsi al contatto precedente. Aggiungere valore. NON ripetere presentazione.";
  if (touchCount > 3 && warmth < 50) return "NURTURING: Tono amichevole. Focus su insight di valore. Mostrare competenza.";
  return "RELAZIONE CALDA: Tono da collega/amico professionale. Personalizzazione alta. Proposte concrete.";
}

/**
 * Blocco "STATO COMMERCIALE" condiviso tra i builder.
 * Restituisce stringa vuota quando non c'è alcuna informazione utile.
 */
export function buildCommercialStateBlock(input: CommercialStateInput): string {
  const hasAnyInfo =
    input.commercialState !== undefined ||
    input.touchCount !== undefined ||
    Boolean(input.addressCategory);
  if (!hasAnyInfo) return "";

  const tc = input.touchCount ?? 0;
  const ws = input.warmthScore ?? 0;
  const isHolding = isHoldingPatternCategory(input.addressCategory);

  let effectiveState = input.commercialState || "new";
  let holdingPatternNote = "";
  if (isHolding) {
    effectiveState = "holding";
    holdingPatternNote = `\n⚠️ [OVERRIDE] Regola email_address_rules.category="${input.addressCategory}" → stato="holding" (priorità manuale utente su lead_status)`;
  }

  const toneInstruction =
    input.toneStrategy === "by_warmth"
      ? pickToneByWarmth(tc, ws, isHolding)
      : (STATE_TO_TONE[effectiveState] ?? STATE_TO_TONE.first_touch_sent);

  return `\n--- STATO COMMERCIALE ---
- Fase: ${(effectiveState || "new").toUpperCase()}
- Contatti totali inviati: ${tc}
- Ultimo canale: ${input.lastChannel || "nessuno"}
- Ultimo esito: ${input.lastOutcome || "n/a"}
- Giorni dall'ultimo contatto: ${input.daysSinceLastContact ?? "n/a"}
- Calore relazione: ${ws}/100${holdingPatternNote}

ISTRUZIONI TONO${input.toneStrategy === "by_state" || !input.toneStrategy ? " (basate su fase)" : ""}: ${toneInstruction}
`;
}