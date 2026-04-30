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
 * activeContextSummary — descrizione breve in linguaggio naturale del batch
 * composer attivo, da iniettare nel router AI come `activeContext`. Quando
 * questo summary è presente, l'AI sa che esiste un batch vivo e può scegliere
 * `compose-email` per follow-up (rigenerazione, modifiche di lunghezza/tono,
 * riapertura canvas) anche se il prompt non contiene parole chiave fisse.
 *
 * Niente regex. L'interpretazione semantica della richiesta è demandata al
 * modello AI, che ha contesto + cronologia + KB.
 */
export function getActiveComposerContextSummary(): {
  type: "composer-batch";
  toolId: "compose-email";
  description: string;
  ttlSecondsLeft: number;
} | null {
  const ctx = getLastComposerContext();
  if (!ctx) return null;
  const ageSec = Math.round((Date.now() - ctx.ts) / 1000);
  const ttlSec = Math.max(0, Math.round(TTL_MS / 1000) - ageSec);
  return {
    type: "composer-batch",
    toolId: "compose-email",
    description:
      `C'è un batch di ${ctx.partnerIds.length} bozze email per partner di ` +
      `${ctx.countryLabel.toUpperCase()} (codice ${ctx.countryCode}), tono "${ctx.tone}", ` +
      `generato ${ageSec}s fa. L'utente può chiedere modifiche (lunghezza, tono, ` +
      `contenuto, formato), riapertura del canvas, o nuove varianti — sempre ` +
      `riferendosi a queste bozze. Solo se cambia chiaramente argomento ` +
      `(es. "quanti partner ho a Malta?" o nuova azienda) usa un altro tool.`,
    ttlSecondsLeft: ttlSec,
  };
}