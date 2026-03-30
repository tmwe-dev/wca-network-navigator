import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export type WorkspaceFilterKey = "with_email" | "no_email" | "with_contact" | "no_contact" | "with_alias" | "no_alias" | "enriched" | "not_enriched";
export type EmailGenFilter = "all" | "generated" | "to_generate";
export type SortingFilterMode = "all" | "unreviewed" | "reviewed" | "today" | "immediate" | "scheduled";

export interface GlobalFilterState {
  search: string;
  sortBy: string;
  origin: Set<string>;
  quality: string;
  groupBy: string;
  holdingPattern: string;
  leadStatus: string;
  outreachTab: string;
  // Workspace filters
  workspaceFilters: Set<WorkspaceFilterKey>;
  emailGenFilter: EmailGenFilter;
  workspaceCountries: Set<string>;
  // Sorting filters
  sortingFilter: SortingFilterMode;
  sortingSearch: string;
}

interface GlobalFiltersCtxValue {
  filters: GlobalFilterState;
  setSearch: (q: string) => void;
  setSortBy: (s: string) => void;
  setOrigin: (o: Set<string>) => void;
  setQuality: (q: string) => void;
  setGroupBy: (g: string) => void;
  setHoldingPattern: (h: string) => void;
  setLeadStatus: (l: string) => void;
  resetFilters: () => void;
  currentRoute: string;
}

const defaults: GlobalFilterState = {
  search: "",
  sortBy: "name",
  origin: new Set(["wca", "import", "report_aziende"]),
  quality: "all",
  groupBy: "country",
  holdingPattern: "out",
  leadStatus: "all",
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
  const setGroupBy = useCallback((g: string) => setFilters(p => ({ ...p, groupBy: g })), []);
  const setHoldingPattern = useCallback((h: string) => setFilters(p => ({ ...p, holdingPattern: h })), []);
  const setLeadStatus = useCallback((l: string) => setFilters(p => ({ ...p, leadStatus: l })), []);
  const resetFilters = useCallback(() => setFilters({ ...defaults, origin: new Set(defaults.origin) }), []);

  return (
    <Ctx.Provider value={{ filters, setSearch, setSortBy, setOrigin, setQuality, setGroupBy, setHoldingPattern, setLeadStatus, resetFilters, currentRoute: location.pathname }}>
      {children}
    </Ctx.Provider>
  );
}
