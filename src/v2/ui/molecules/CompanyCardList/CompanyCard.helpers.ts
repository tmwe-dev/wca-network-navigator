/**
 * CompanyCard.helpers — Funzioni pure di derivazione dati per la card.
 * Nessun accesso a React o hook.
 */

export type RecencyTone = "ok" | "warn" | "alert" | "muted";

export interface RecencyInfo {
  label: string;
  tone: RecencyTone;
}

/**
 * Ricava un'etichetta compatta ("oggi", "3g fa", ...) e un tono di allarme
 * dall'ISO timestamp dell'ultima interazione.
 */
export function computeRecency(lastInteractionAt: string | null | undefined): RecencyInfo {
  if (!lastInteractionAt) return { label: "mai", tone: "muted" };
  const t = new Date(lastInteractionAt).getTime();
  if (Number.isNaN(t)) return { label: "mai", tone: "muted" };
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days < 1) return { label: "oggi", tone: "ok" };
  if (days < 7) return { label: `${days}g fa`, tone: "ok" };
  if (days < 30) return { label: `${days}g fa`, tone: "warn" };
  if (days < 90) return { label: `${days}g fa`, tone: "warn" };
  return { label: `${days}g fa`, tone: "alert" };
}

/**
 * Etichetta compatta della Deep Search: "DS oggi", "DS 3g fa", ...
 * Ritorna null se il timestamp manca o è invalido.
 */
export function computeEnrichedLabel(enrichedAt: string | null | undefined): string | null {
  if (!enrichedAt) return null;
  const t = new Date(enrichedAt).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
  if (days < 1) return "DS oggi";
  if (days < 30) return `DS ${days}g fa`;
  if (days < 365) return `DS ${Math.floor(days / 30)}mes fa`;
  return `DS ${Math.floor(days / 365)}a fa`;
}
