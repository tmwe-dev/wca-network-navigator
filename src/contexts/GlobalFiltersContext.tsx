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
  workspaceFilters: Set<WorkspaceFilterKey>;
  emailGenFilter: EmailGenFilter;
  workspaceCountries: Set<string>;
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
  setOutreachTab: (t: string) => void;
  setWorkspaceFilters: (f: Set<WorkspaceFilterKey>) => void;
  setEmailGenFilter: (f: EmailGenFilter) => void;
  setWorkspaceCountries: (c: Set<string>) => void;
  setSortingFilter: (f: SortingFilterMode) => void;
  setSortingSearch: (s: string) => void;
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
  outreachTab: "cockpit",
  workspaceFilters: new Set(),
  emailGenFilter: "all",
  workspaceCountries: new Set(),
  sortingFilter: "all",
  sortingSearch: "",
};

const Ctx = createContext<GlobalFiltersCtxValue | null>(null);

export function useGlobalFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return ctx;
}

function cloneDefaults(): GlobalFilterState {
  return { ...defaults, origin: new Set(defaults.origin), workspaceFilters: new Set(), workspaceCountries: new Set() };
}

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [filters, setFilters] = useState<GlobalFilterState>(cloneDefaults);

  const setSearch = useCallback((q: string) => setFilters(p => ({ ...p, search: q })), []);
  const setSortBy = useCallback((s: string) => setFilters(p => ({ ...p, sortBy: s })), []);
  const setOrigin = useCallback((o: Set<string>) => setFilters(p => ({ ...p, origin: o })), []);
  const setQuality = useCallback((q: string) => setFilters(p => ({ ...p, quality: q })), []);
  const setGroupBy = useCallback((g: string) => setFilters(p => ({ ...p, groupBy: g })), []);
  const setHoldingPattern = useCallback((h: string) => setFilters(p => ({ ...p, holdingPattern: h })), []);
  const setLeadStatus = useCallback((l: string) => setFilters(p => ({ ...p, leadStatus: l })), []);
  const setOutreachTab = useCallback((t: string) => setFilters(p => ({ ...p, outreachTab: t })), []);
  const setWorkspaceFilters = useCallback((f: Set<WorkspaceFilterKey>) => setFilters(p => ({ ...p, workspaceFilters: f })), []);
  const setEmailGenFilter = useCallback((f: EmailGenFilter) => setFilters(p => ({ ...p, emailGenFilter: f })), []);
  const setWorkspaceCountries = useCallback((c: Set<string>) => setFilters(p => ({ ...p, workspaceCountries: c })), []);
  const setSortingFilter = useCallback((f: SortingFilterMode) => setFilters(p => ({ ...p, sortingFilter: f })), []);
  const setSortingSearch = useCallback((s: string) => setFilters(p => ({ ...p, sortingSearch: s })), []);
  const resetFilters = useCallback(() => setFilters(cloneDefaults()), []);

  return (
    <Ctx.Provider value={{
      filters, setSearch, setSortBy, setOrigin, setQuality, setGroupBy, setHoldingPattern, setLeadStatus,
      setOutreachTab, setWorkspaceFilters, setEmailGenFilter, setWorkspaceCountries,
      setSortingFilter, setSortingSearch, resetFilters, currentRoute: location.pathname,
    }}>
      {children}
    </Ctx.Provider>
  );
}
