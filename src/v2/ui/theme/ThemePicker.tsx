/**
 * ThemePicker — Selettore globale dei temi (Amber, Lilac, Space, Notte).
 * Applica una delle classi `theme-*` su <html>, persiste in localStorage
 * e cambia anche il font-family via --font-sans (gestito in index.css).
 *
 * Due varianti:
 *  - "icon": pulsante 🎨 con piccolo popover di scelta (uso header desktop/mobile).
 *  - "menu-row": riga full-width con 4 swatch inline cliccabili
 *    (uso dentro NavMenuPopover, dove non possiamo annidare un Radix dropdown).
 */
import * as React from "react";
import { Palette, Check, Sun, Moon, Type } from "lucide-react";
import { useTextIntensity, type TextIntensity } from "@/providers/TextIntensityProvider";

export type ThemeId = "amber" | "lilac" | "space" | "notte";
export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "wcann.theme";
const MODE_KEY = "wcann.themeMode";
const THEME_CLASSES = ["theme-lilac", "theme-space", "theme-notte"] as const;
const THEME_EVENT = "wcann:theme-change";
const MODE_EVENT = "wcann:themeMode-change";

const THEMES: ReadonlyArray<{
  id: ThemeId;
  label: string;
  swatch: string;
  description: string;
}> = [
  { id: "amber", label: "Amber",      swatch: "#b45309", description: "Default · Inter" },
  { id: "lilac", label: "Lilac Blue", swatch: "#4f46e5", description: "Indaco · Manrope" },
  { id: "space", label: "Space",      swatch: "#22d3ee", description: "Cosmico · Space Grotesk" },
  { id: "notte", label: "Notte",      swatch: "#b48232", description: "Notturno · Cormorant" },
];

function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  THEME_CLASSES.forEach((c) => root.classList.remove(c));
  if (id !== "amber") root.classList.add(`theme-${id}`);
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: id }));
}

function applyMode(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: mode }));
}

function readStoredMode(): ThemeMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch { /* ignore */ }
  return "dark";
}

function readStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "amber" || v === "lilac" || v === "space" || v === "notte") return v;
  } catch { /* ignore */ }
  return "amber";
}

/** Hook che inizializza il tema all'avvio. (main.tsx già lo applica pre-render). */
export function useInitTheme(): void {
  React.useEffect(() => {
    applyMode(readStoredMode());
    applyTheme(readStoredTheme());
  }, []);
}

function useCurrentTheme(): [ThemeId, (id: ThemeId) => void] {
  const [current, setCurrent] = React.useState<ThemeId>(() => readStoredTheme());
  React.useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<ThemeId>).detail;
      if (id) setCurrent(id);
    };
    window.addEventListener(THEME_EVENT, handler);
    return () => window.removeEventListener(THEME_EVENT, handler);
  }, []);
  const change = React.useCallback((id: ThemeId) => { applyTheme(id); }, []);
  return [current, change];
}

function useCurrentMode(): [ThemeMode, (m: ThemeMode) => void] {
  const [mode, setMode] = React.useState<ThemeMode>(() => readStoredMode());
  React.useEffect(() => {
    const handler = (e: Event) => {
      const m = (e as CustomEvent<ThemeMode>).detail;
      if (m) setMode(m);
    };
    window.addEventListener(MODE_EVENT, handler);
    return () => window.removeEventListener(MODE_EVENT, handler);
  }, []);
  const change = React.useCallback((m: ThemeMode) => { applyMode(m); }, []);
  return [mode, change];
}

interface ThemePickerProps {
  variant?: "icon" | "menu-row";
}

export function ThemePicker({ variant = "icon" }: ThemePickerProps): React.ReactElement {
  const [current, change] = useCurrentTheme();
  const [mode, setMode] = useCurrentMode();

  if (variant === "menu-row") {
    return (
      <div className="flex flex-col gap-1.5 px-3 py-2">
        <div className="flex items-center gap-2">
          <Palette className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground mr-1">Tema</span>
          <div className="flex items-center gap-1.5 ml-auto">
            {THEMES.map((t) => {
              const active = t.id === current;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => change(t.id)}
                  aria-label={`Tema ${t.label}`}
                  title={`${t.label} — ${t.description}`}
                  className={
                    "h-5 w-5 rounded-full ring-1 ring-white/20 transition-transform hover:scale-110 flex items-center justify-center " +
                    (active ? "ring-2 ring-primary scale-110" : "")
                  }
                  style={{ background: t.swatch }}
                >
                  {active && <Check className="h-3 w-3 text-white drop-shadow" />}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mode === "dark" ? <Moon className="h-4 w-4 text-muted-foreground shrink-0" /> : <Sun className="h-4 w-4 text-muted-foreground shrink-0" />}
          <span className="text-xs text-muted-foreground mr-1">Modalità</span>
          <div className="flex items-center gap-1 ml-auto rounded-md border border-border/60 p-0.5">
            <button
              type="button"
              onClick={() => setMode("light")}
              className={"px-2 py-0.5 text-[11px] rounded-sm transition-colors " + (mode === "light" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >Chiaro</button>
            <button
              type="button"
              onClick={() => setMode("dark")}
              className={"px-2 py-0.5 text-[11px] rounded-sm transition-colors " + (mode === "dark" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
            >Scuro</button>
          </div>
        </div>
        <TextIntensityRow />
      </div>
    );
  }

  return <ThemePickerIcon current={current} onChange={change} mode={mode} onModeChange={setMode} />;
}

function ThemePickerIcon({
  current,
  onChange,
  mode,
  onModeChange,
}: { current: ThemeId; onChange: (id: ThemeId) => void; mode: ThemeMode; onModeChange: (m: ThemeMode) => void }): React.ReactElement {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const currentTheme = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Tema corrente: ${currentTheme.label}. Cambia tema`}
        title={`Tema · ${currentTheme.label}`}
        className="h-9 w-9 md:h-7 md:w-7 inline-flex items-center justify-center rounded-md text-foreground/70 hover:text-primary hover:bg-white/5 transition-colors"
      >
        <Palette className="h-4 w-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 z-[100] rounded-md border border-border/60 bg-popover/95 backdrop-blur-xl shadow-xl p-1"
        >
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Tema visivo
          </div>
          <div className="h-px bg-border/60 my-1" />
          {THEMES.map((t) => {
            const active = t.id === current;
            return (
              <button
                key={t.id}
                type="button"
                role="menuitem"
                onClick={() => { onChange(t.id); setOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-sm text-left hover:bg-accent/40 transition-colors"
              >
                <span
                  aria-hidden
                  className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-white/20 shrink-0"
                  style={{ background: t.swatch }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm leading-tight">{t.label}</span>
                  <span className="block text-[10px] text-muted-foreground leading-tight">{t.description}</span>
                </span>
                {active && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
          <div className="h-px bg-border/60 my-1" />
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Modalità
          </div>
          <div className="flex items-center gap-1 px-2 pb-2">
            <button
              type="button"
              onClick={() => onModeChange("light")}
              className={"flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-sm transition-colors " + (mode === "light" ? "bg-primary text-primary-foreground" : "hover:bg-accent/40")}
            ><Sun className="h-3.5 w-3.5" /> Chiaro</button>
            <button
              type="button"
              onClick={() => onModeChange("dark")}
              className={"flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 text-xs rounded-sm transition-colors " + (mode === "dark" ? "bg-primary text-primary-foreground" : "hover:bg-accent/40")}
            ><Moon className="h-3.5 w-3.5" /> Scuro</button>
          </div>
          <div className="h-px bg-border/60 my-1" />
          <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            Intensità testo
          </div>
          <div className="px-2 pb-2">
            <TextIntensityRow inline />
          </div>
        </div>
      )}
    </div>
  );
}

const INTENSITY_STEPS: { value: TextIntensity; hint: string; size: string }[] = [
  { value: "soft", hint: "Tenue", size: "text-[10px]" },
  { value: "normal", hint: "Normale", size: "text-xs" },
  { value: "strong", hint: "Forte", size: "text-sm" },
  { value: "max", hint: "Massimo", size: "text-base font-semibold" },
];

function TextIntensityRow({ inline = false }: { inline?: boolean }): React.ReactElement {
  const { intensity, setIntensity } = useTextIntensity();
  const buttons = (
    <div className="flex items-center gap-1 ml-auto rounded-md border border-border/60 p-0.5">
      {INTENSITY_STEPS.map((s) => {
        const active = s.value === intensity;
        return (
          <button
            key={s.value}
            type="button"
            onClick={() => setIntensity(s.value)}
            title={`Intensità testo: ${s.hint}`}
            aria-label={`Intensità testo ${s.hint}`}
            aria-pressed={active}
            className={
              "px-1.5 py-0.5 leading-none rounded-sm transition-colors min-w-[22px] " +
              s.size +
              " " +
              (active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            Aa
          </button>
        );
      })}
    </div>
  );
  if (inline) return buttons;
  return (
    <div className="flex items-center gap-2">
      <Type className="h-4 w-4 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground mr-1">Testo</span>
      {buttons}
    </div>
  );
}
