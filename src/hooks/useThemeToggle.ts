import { useCallback, useEffect, useState } from "react";

/**
 * useThemeToggle — minimal dark/light toggle with localStorage persistence.
 *
 * The app currently hard-applies the `dark` class in main.tsx. This hook
 * lets pages add a user-facing toggle without breaking that default.
 *
 *   const { theme, toggle, setTheme } = useThemeToggle();
 */
export type Theme = "light" | "dark";

const STORAGE_KEY = "wca_theme";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  // Default keeps current behaviour: dark.
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export function useThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  return { theme, setTheme, toggle, isDark: theme === "dark" };
}
