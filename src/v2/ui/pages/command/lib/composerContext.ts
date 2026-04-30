/**
 * composerContext — Memoria conversazionale per il tool compose-email.
 *
 * Persiste a livello modulo l'ultimo contesto batch (paese + lista partner +
 * tono) così che follow-up come "rifai più amichevole" o "fammele rivedere"
 * possano EREDITARE i destinatari invece di tornare 0 risultati.
 *
 * Stesso pattern di `aiQueryTool.getLastSuccessfulQueryPlan` (singleton modulo).
 * TTL 5 min (allineato a `queryContext.CONTEXT_TTL_MS`).
 */
import type { DetectedTone } from "./toneDetector";

export interface ComposerBatchContext {
  readonly countryCode: string;
  readonly countryLabel: string;
  readonly partnerIds: ReadonlyArray<string>;
  readonly tone: DetectedTone;
  /** Prompt originale che ha avviato il batch (usato come `goal` di rigenerazione). */
  readonly originalGoal: string;
  readonly ts: number;
}

const TTL_MS = 5 * 60_000;

let lastContext: ComposerBatchContext | null = null;

export function setLastComposerContext(ctx: Omit<ComposerBatchContext, "ts">): void {
  lastContext = { ...ctx, ts: Date.now() };
}

export function getLastComposerContext(): ComposerBatchContext | null {
  if (!lastContext) return null;
  if (Date.now() - lastContext.ts > TTL_MS) {
    lastContext = null;
    return null;
  }
  return lastContext;
}

export function clearLastComposerContext(): void {
  lastContext = null;
}

/**
 * Heuristic: il prompt è una richiesta di RIGENERAZIONE/RIVEDERE le bozze
 * appena prodotte (senza nuova ricerca DB)?
 *
 * Esempi che matchano:
 *  - "rifai più amichevole"
 *  - "fammele vedere nel canvas"
 *  - "riscrivi più breve"
 *  - "cambia tono"
 *  - "non vedo le nuove versioni"
 */
export function isRegenerateIntent(prompt: string): boolean {
  const p = (prompt ?? "").toLowerCase();
  return (
    /\b(rifai|riscrivi|rigener[ai]|cambia\s+tono|altro\s+tono|diverso\s+tono|più\s+(amichevole|breve|diretto|informale|formale|corto|lungo))\b/i.test(p) ||
    /\b(fammel[ae]\s+(?:vedere|rivedere|mostrare))\b/i.test(p) ||
    /\b(non\s+vedo|dove\s+sono|mostrami)\s+(?:le\s+)?(?:nuove\s+)?(?:versioni|bozze|mail|email)\b/i.test(p) ||
    /\b(riprovaci|prova\s+(?:di\s+)?nuovo|un'altra\s+versione)\b/i.test(p)
  );
}