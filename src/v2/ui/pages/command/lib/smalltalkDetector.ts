/**
 * Smalltalk / meta-test detector.
 *
 * Riconosce input conversazionali brevi che NON devono triggerare il planner
 * né `ai-query` (che produce "Nessun risultato trovato" su saluti tipo
 * "ciao", "c'è qualcuno?", "mi senti?").
 *
 * Risponde con una battuta del Direttore — flusso < 1s, niente DB.
 */

const SMALLTALK_PATTERNS: RegExp[] = [
  // Saluti
  /^(ciao|salve|hey|ehi|buongiorno|buonasera|buonanotte|hola|hi|hello)[\s!.?,]*$/i,
  // Test microfono / presenza
  /^c['’\s]*[èe]?\s*qualcun[oa]\s*(in\s+ascolto|li[ìi]|qui)?\??$/i,
  /^c['’\s]*[èe]?\s*nessun[oa]?\s*(in\s+ascolto|li[ìi]|qui)?\??$/i,
  /^(mi\s+senti|ci\s+sei|sei\s+(li[ìi]|qui|attiv[oa])|funzion[ai])\??$/i,
  /^(prova|test|testing|hello\s+world|1\s*2\s*3)\??$/i,
  // Ringraziamenti / ack
  /^(grazie|ok|okay|va\s+bene|perfetto|capito|d['’]accordo|bene)[\s!.]*$/i,
  // Domande sullo stato dell'AI
  /^(come\s+(stai|va)|tutto\s+bene)\??$/i,
  // Saluti finali
  /^(arrivederci|a\s+presto|ciao\s+ciao|bye)[\s!.]*$/i,
];

export type SmalltalkKind = "greeting" | "presence" | "ack" | "farewell" | "status";

export interface SmalltalkMatch {
  kind: SmalltalkKind;
  reply: string;
}

/**
 * Restituisce una risposta canned se il prompt è smalltalk, altrimenti null.
 * Le risposte sono brevi, ottimizzate per TTS (≤80 parole, no markdown).
 */
export function detectSmalltalk(rawText: string): SmalltalkMatch | null {
  const t = rawText.trim();
  if (!t || t.length > 60) return null;

  // Presenza / test mic
  if (
    /^c['’\s]*[èe]?\s*qualcun/i.test(t) ||
    /^c['’\s]*[èe]?\s*nessun/i.test(t) ||
    /^(mi\s+senti|ci\s+sei|sei\s+(li[ìi]|qui|attiv))/i.test(t) ||
    /^(prova|test|testing)\b/i.test(t)
  ) {
    return { kind: "presence", reply: "Sì, ti sento. Sono qui. Dimmi pure cosa vuoi fare." };
  }

  // Saluti
  if (/^(ciao|salve|hey|ehi|hola|hi|hello)\b/i.test(t)) {
    return { kind: "greeting", reply: "Ciao. Pronto a lavorare. Da dove partiamo?" };
  }
  if (/^(buongiorno)\b/i.test(t)) {
    return { kind: "greeting", reply: "Buongiorno. Cosa facciamo oggi?" };
  }
  if (/^(buonasera|buonanotte)\b/i.test(t)) {
    return { kind: "greeting", reply: "Buonasera. Su cosa vuoi che mi muova?" };
  }

  // Ringraziamento / ack
  if (/^(grazie|ok|okay|va\s+bene|perfetto|capito|d['’]accordo|bene)[\s!.]*$/i.test(t)) {
    return { kind: "ack", reply: "Ricevuto. Resto in attesa del prossimo passo." };
  }

  // Stato
  if (/^(come\s+(stai|va)|tutto\s+bene)/i.test(t)) {
    return { kind: "status", reply: "Tutto operativo. Pipeline attive, agenti pronti. Cosa serve?" };
  }

  // Saluti finali
  if (/^(arrivederci|a\s+presto|ciao\s+ciao|bye)/i.test(t)) {
    return { kind: "farewell", reply: "A dopo. Resto in ascolto quando torni." };
  }

  // Catch-all su pattern lista
  for (const re of SMALLTALK_PATTERNS) {
    if (re.test(t)) {
      return { kind: "greeting", reply: "Sono qui. Dimmi pure." };
    }
  }

  return null;
}