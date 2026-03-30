import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export interface GlobalFilterState {
  search: string;
  sortBy: string;
  origin: Set<string>;
  quality: string; // "all" | "no_profile" | "no_email" | "no_phone" | "no_deep_search"
}

interface GlobalFiltersCtxValue {
  filters: GlobalFilterState;
  setSearch: (q: string) => void;
  setSortBy: (s: string) => void;
  setOrigin: (o: Set<string>) => void;
  setQuality: (q: string) => void;
  resetFilters: () => void;
  currentRoute: string;
}

const defaults: GlobalFilterState = {
  search: "",
  sortBy: "name",
  origin: new Set(["wca", "import", "report_aziende"]),
  quality: "all",
};

const Ctx = createContext<GlobalFiltersCtxValue | null>(null);

export function useGlobalFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return ctx;
}

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [filters, setFilters] = useState<GlobalFilterState>({ ...defaults, origin: new Set(defaults.origin) });

  const setSearch = useCallback((q: string) => setFilters(p => ({ ...p, search: q })), []);
  const setSortBy = useCallback((s: string) => setFilters(p => ({ ...p, sortBy: s })), []);
  const setOrigin = useCallback((o: Set<string>) => setFilters(p => ({ ...p, origin: o })), []);
  const setQuality = useCallback((q: string) => setFilters(p => ({ ...p, quality: q })), []);
  const resetFilters = useCallback(() => setFilters({ ...defaults, origin: new Set(defaults.origin) }), []);

  return (
    <Ctx.Provider value={{ filters, setSearch, setSortBy, setOrigin, setQuality, resetFilters, currentRoute: location.pathname }}>
      {children}
    </Ctx.Provider>
  );
}
