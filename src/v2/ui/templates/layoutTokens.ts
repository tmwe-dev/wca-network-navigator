/**
 * layoutTokens — SSOT della STRUTTURA del guscio applicativo (no colori).
 *
 * Sorgente unica di verità per altezze fisse, gap, padding di sicurezza e
 * scala z-index a livelli. Usare queste costanti ovunque per garantire
 * uniformità ed evitare sovrapposizioni tra top bar, header di pagina,
 * toolbar, rail laterali, popover/drawer e toast.
 *
 * Regola: nessun elemento `fixed` deve coprire contenuto. Gli elementi
 * fluttuanti vanno collocati DENTRO le zone in flusso (vedi LayoutHeader,
 * che ora ospita il ☰) oppure rispettare Z e gli offset di sicurezza qui sotto.
 */

/** Altezze fisse delle zone strutturali (Tailwind class). */
export const LAYOUT_HEIGHTS = {
  /** Top bar globale (desktop). */
  topBar: "h-11", // 44px
  /** Header di pagina in-mask (StandardPageFrame). */
  pageHeader: "h-9", // 36px
  /** Toolbar contestuale opzionale sotto l'header. */
  pageToolbar: "h-9", // 36px
  /** Header mobile fixed. */
  mobileBar: "h-12", // 48px
} as const;

/** Padding orizzontale standard delle zone header/toolbar. */
export const LAYOUT_PADDING_X = "px-4" as const;

/** Gap standard tra elementi nei cluster header. */
export const LAYOUT_GAP = "gap-2" as const;

/**
 * Scala z-index a LIVELLI (dal basso verso l'alto).
 * Valori numerici per uso inline; le classi Tailwind equivalenti tra parentesi.
 */
export const Z = {
  content: 0, // z-0
  rail: 30, // z-30 — rail filtri/workflow
  header: 40, // z-40 — top bar / header di pagina
  floating: 50, // z-50 — pulsanti fissi (linguette), menu mobile
  overlay: 60, // z-[60] — popover, drawer, dialog backdrop
  toast: 9999, // z-[9999] — notifiche/toast, skip-nav
} as const;

export type LayoutHeightKey = keyof typeof LAYOUT_HEIGHTS;
