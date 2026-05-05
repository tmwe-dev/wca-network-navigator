/**
 * ThemePicker — Selettore globale dei temi (Amber, Lilac, Space, Notte).
 * Applica una delle classi `theme-*` su <html> e persiste in localStorage.
 * Usato sia nell'header (vicino alla campanella) sia nel NavMenuPopover.
 */
import * as React from "react";
import { Palette, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export type ThemeId = "amber" | "lilac" | "space" | "notte";

const STORAGE_KEY = "wcann.theme";
const THEME_CLASSES = ["theme-lilac", "theme-space", "theme-notte"] as const;

const THEMES: ReadonlyArray<{
  id: ThemeId;
  label: string;
  swatch: string; // tailwind/inline color for preview dot
  description: string;
}> = [
  { id: "amber", label: "Amber", swatch: "#b45309", description: "Default — oro caldo" },
  { id: "lilac", label: "Lilac Blue", swatch: "#4f46e5", description: "Indaco / lilla" },
  { id: "space", label: "Space", swatch: "#22d3ee", description: "Notte cosmica + ciano" },
  { id: "notte", label: "Notte", swatch: "#b48232", description: "Marrone notturno" },
];

function applyTheme(id: ThemeId): void {
  const root = document.documentElement;
  THEME_CLASSES.forEach((c) => root.classList.remove(c));
  if (id !== "amber") root.classList.add(`theme-${id}`);
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}

function readStoredTheme(): ThemeId {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "amber" || v === "lilac" || v === "space" || v === "notte") return v;
  } catch {
    /* ignore */
  }
  return "amber";
}

/** Hook che inizializza il tema all'avvio dell'app (chiamato in App). */
export function useInitTheme(): void {
  React.useEffect(() => {
    applyTheme(readStoredTheme());
  }, []);
}

function useCurrentTheme(): [ThemeId, (id: ThemeId) => void] {
  const [current, setCurrent] = React.useState<ThemeId>(() => readStoredTheme());
  const change = React.useCallback((id: ThemeId) => {
    applyTheme(id);
    setCurrent(id);
  }, []);
  return [current, change];
}

interface ThemePickerProps {
  /** Variante visiva del trigger: icona compatta (header) o riga full-width (sidebar/menu). */
  variant?: "icon" | "menu-row";
}

export function ThemePicker({ variant = "icon" }: ThemePickerProps): React.ReactElement {
  const [current, change] = useCurrentTheme();
  const currentTheme = THEMES.find((t) => t.id === current) ?? THEMES[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "icon" ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-foreground/70 hover:text-primary transition-colors"
            aria-label={`Tema corrente: ${currentTheme.label}. Cambia tema`}
            title={`Tema · ${currentTheme.label}`}
          >
            <Palette className="h-4 w-4" />
          </Button>
        ) : (
          <button
            type="button"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left text-foreground/90 hover:bg-white/5 hover:text-foreground w-full"
          >
            <span className="text-muted-foreground"><Palette className="h-4 w-4" /></span>
            <span className="flex-1">Tema</span>
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-full ring-1 ring-white/20"
              style={{ background: currentTheme.swatch }}
            />
            <span className="text-xs text-muted-foreground">{currentTheme.label}</span>
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Tema visivo
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEMES.map((t) => {
          const active = t.id === current;
          return (
            <DropdownMenuItem
              key={t.id}
              onClick={() => change(t.id)}
              className="gap-2"
            >
              <span
                aria-hidden
                className="inline-block h-3 w-3 rounded-full ring-1 ring-white/20 shrink-0"
                style={{ background: t.swatch }}
              />
              <span className="flex-1">
                <span className="block text-sm">{t.label}</span>
                <span className="block text-[10px] text-muted-foreground">{t.description}</span>
              </span>
              {active && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}