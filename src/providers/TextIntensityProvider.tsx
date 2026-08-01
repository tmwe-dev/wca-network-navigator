import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TextIntensity = "soft" | "normal" | "strong" | "max";

const STORAGE_KEY = "text-intensity";
const VALID: readonly TextIntensity[] = ["soft", "normal", "strong", "max"];

function readInitial(): TextIntensity {
  if (typeof window === "undefined") return "normal";
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v && (VALID as readonly string[]).includes(v)) return v as TextIntensity;
  } catch {
    /* ignore */
  }
  return "normal";
}

function applyToDom(value: TextIntensity): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-text-intensity", value);
}

interface Ctx {
  intensity: TextIntensity;
  setIntensity: (v: TextIntensity) => void;
}

const TextIntensityContext = createContext<Ctx | null>(null);

export function TextIntensityProvider({ children }: { children: ReactNode }) {
  const [intensity, setIntensityState] = useState<TextIntensity>(readInitial);

  useEffect(() => {
    applyToDom(intensity);
    try {
      window.localStorage.setItem(STORAGE_KEY, intensity);
    } catch {
      /* ignore */
    }
  }, [intensity]);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const v = e.newValue;
      if (v && (VALID as readonly string[]).includes(v)) {
        setIntensityState(v as TextIntensity);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const setIntensity = useCallback((v: TextIntensity) => setIntensityState(v), []);

  const value = useMemo<Ctx>(() => ({ intensity, setIntensity }), [intensity, setIntensity]);

  return <TextIntensityContext.Provider value={value}>{children}</TextIntensityContext.Provider>;
}

export function useTextIntensity(): Ctx {
  const ctx = useContext(TextIntensityContext);
  if (!ctx) {
    // Fallback safe se usato fuori dal provider
    return {
      intensity: "normal",
      setIntensity: () => {
        /* noop */
      },
    };
  }
  return ctx;
}