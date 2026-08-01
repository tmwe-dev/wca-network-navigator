/**
 * UI_TOKENS — costanti visive canoniche del design system v2.
 *
 * Solo classi semantic Tailwind (bg-card, border-border, text-foreground...).
 * Mai colori raw (no bg-white, no text-black). Tutti i colori risolvono
 * a HSL via index.css → tema chiaro/scuro automatico.
 *
 * Importare da qui invece di duplicare le stringhe nei componenti.
 */
export const UI_TOKENS = {
  /** Toolbar standard (filtri, azioni) sopra il contenuto pagina. */
  TOOLBAR: "shrink-0 px-4 py-2 flex flex-wrap items-center gap-3 border-b border-border/40 bg-card/40",
  /** Toolbar compatta per spazi ridotti (split panel, sidebar). */
  TOOLBAR_COMPACT: "shrink-0 px-3 py-1.5 flex items-center gap-2 border-b border-border/40 bg-card/40",

  /** Card primaria con bordo. */
  CARD_SURFACE: "rounded-lg border border-border/60 bg-card p-4",
  /** Card secondaria, no bordo, sfondo tenue. */
  CARD_SUBTLE: "rounded-md bg-muted/20 p-3",
  /** Card interattiva (hover + cursor). */
  CARD_INTERACTIVE:
    "rounded-lg border border-border/60 bg-card p-4 hover:border-primary/30 transition-colors cursor-pointer",

  /** Scala tipografica canonica. Tutto fuori da queste 5 classi è debito. */
  TEXT_BADGE: "text-[10px]",
  TEXT_LABEL: "text-xs",
  TEXT_BODY: "text-sm",
  TEXT_TITLE: "text-base",
  TEXT_HEADING: "text-lg",

  /** Border radius canonici. */
  RADIUS_SM: "rounded-md",
  RADIUS_MD: "rounded-lg",
  RADIUS_LG: "rounded-xl",

  /** Wrapper standard per pagina full-height senza scroll esterno. */
  PAGE_WRAPPER: "h-full flex flex-col overflow-hidden",
} as const;

export type UiTokenKey = keyof typeof UI_TOKENS;