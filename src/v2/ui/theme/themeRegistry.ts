/**
 * themeRegistry — SSOT del sistema tema/colore della piattaforma.
 *
 * Unica sorgente di verità per: id dei temi, modi (light/dark), chiavi di
 * localStorage, nomi degli eventi custom e logica di applicazione delle
 * classi su <html>. Importato da `main.tsx` (pre-render, anti-flash) e da
 * `ThemePicker.tsx` (UI). I VALORI HSL di ogni (tema, modo) vivono SOLO in
 * `src/index.css`. I componenti usano SOLO classi semantiche Tailwind
 * (text-foreground, bg-card, text-primary, text-success, ...): mai colori raw.
 */

export type ThemeId = "amber" | "lilac" | "space" | "notte";
export type ThemeMode = "light" | "dark";

/** Chiavi di persistenza in localStorage. */
export const THEME_STORAGE_KEY = "wcann.theme";
export const MODE_STORAGE_KEY = "wcann.themeMode";

/** Eventi custom emessi quando tema/modo cambiano (sync cross-componente). */
export const THEME_EVENT = "wcann:theme-change";
export const MODE_EVENT = "wcann:themeMode-change";

/** Tutti gli id di tema validi. `amber` è il default (nessuna classe theme-*). */
export const THEME_IDS: readonly ThemeId[] = ["amber", "lilac", "space", "notte"];

/** Classi `theme-*` applicabili su <html> (amber = assenza di classe). */
export const THEME_CLASSES = ["theme-lilac", "theme-space", "theme-notte"] as const;

/** Metadati UI dei temi (label, swatch, descrizione). */
export const THEMES: ReadonlyArray<{
  id: ThemeId;
  label: string;
  swatch: string;
  description: string;
}> = [
  { id: "amber", label: "Amber", swatch: "#b45309", description: "Default · Inter" },
  { id: "lilac", label: "Lilac Blue", swatch: "#4f46e5", description: "Indaco · Manrope" },
  { id: "space", label: "Space", swatch: "#22d3ee", description: "Cosmico · Space Grotesk" },
  { id: "notte", label: "Notte", swatch: "#b48232", description: "Notturno · Cormorant" },
];

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === "light" || v === "dark";
}

/** Applica il tema visivo (classe theme-*) su <html> + persiste + notifica. */
export function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  THEME_CLASSES.forEach((c) => root.classList.remove(c));
  if (id !== "amber") root.classList.add(`theme-${id}`);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: id }));
}

/** Applica la modalità (classe dark) su <html> + persiste + notifica. */
export function applyMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }));
}

/** Legge la modalità persistita (default: dark). */
export function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_STORAGE_KEY);
    if (isThemeMode(v)) return v;
  } catch {
    /* ignore */
  }
  return "dark";
}

/** Legge il tema persistito (default: amber). */
export function readStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemeId(v)) return v;
  } catch {
    /* ignore */
  }
  return "amber";
}

/**
 * Applica tema+modo PRIMA del render React (chiamato da main.tsx).
 * Idempotente e privo di dipendenze, sicuro in qualsiasi contesto.
 */
export function bootstrapThemeClasses(): void {
  try {
    applyMode(readStoredMode());
    applyTheme(readStoredTheme());
  } catch {
    document.documentElement.classList.add("dark");
  }
}