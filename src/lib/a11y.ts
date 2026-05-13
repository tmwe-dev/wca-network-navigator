/**
 * a11y.ts — Accessibility utilities for Sprint J UX hardening.
 */

/* ── Focus trap ────────────────────────────────────────────────────── */

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Traps keyboard focus within the given container.
 * Returns a cleanup function that removes the event listener.
 */
export function trapFocus(container: HTMLElement): () => void {
  const handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== "Tab") return;

    const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener("keydown", handleKeyDown);
  return () => container.removeEventListener("keydown", handleKeyDown);
}

/* ── Screen reader announcements ───────────────────────────────────── */

/**
 * Creates a temporary aria-live region to announce a message to screen readers.
 */
export function announceToScreenReader(message: string, priority: "polite" | "assertive" = "polite"): void {
  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", priority);
  el.setAttribute("aria-atomic", "true");
  el.className = "sr-only";
  Object.assign(el.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: "0",
  });

  document.body.appendChild(el);

  // Delay setting text so assistive tech picks up the change
  requestAnimationFrame(() => {
    el.textContent = message;
  });

  // Clean up after announcement
  setTimeout(() => {
    document.body.removeChild(el);
  }, 3000);
}

/* ── Contrast ratio calculator ─────────────────────────────────────── */

/**
 * Parses a hex color string (e.g. "#ff0000" or "#f00") to [R, G, B] 0-255.
 */
function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    return [parseInt(clean[0] + clean[0], 16), parseInt(clean[1] + clean[1], 16), parseInt(clean[2] + clean[2], 16)];
  }
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
}

/**
 * Computes relative luminance per WCAG 2.1 definition.
 */
function relativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculates the WCAG contrast ratio between two hex colors.
 * Returns a number >= 1, where 21 is maximum contrast (black/white).
 */
export function getContrastRatio(fg: string, bg: string): number {
  const [r1, g1, b1] = parseHex(fg);
  const [r2, g2, b2] = parseHex(bg);

  const l1 = relativeLuminance(r1, g1, b1);
  const l2 = relativeLuminance(r2, g2, b2);

  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);

  return (lighter + 0.05) / (darker + 0.05);
}

/* ── ARIA label constants ──────────────────────────────────────────── */

export const ARIA_LABELS = {
  navigation: {
    main: "Navigazione principale",
    sidebar: "Menu laterale",
    breadcrumb: "Percorso di navigazione",
  },
  actions: {
    close: "Chiudi",
    save: "Salva",
    cancel: "Annulla",
    delete: "Elimina",
    edit: "Modifica",
    search: "Cerca",
    filter: "Filtra",
    sort: "Ordina",
    refresh: "Aggiorna",
    expand: "Espandi",
    collapse: "Comprimi",
  },
  status: {
    loading: "Caricamento in corso",
    error: "Errore",
    success: "Operazione completata",
    empty: "Nessun risultato",
  },
  form: {
    required: "Campo obbligatorio",
    optional: "Campo facoltativo",
    invalid: "Valore non valido",
  },
} as const;
