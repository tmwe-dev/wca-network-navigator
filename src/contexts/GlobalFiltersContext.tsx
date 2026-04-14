import { createContext, useContext, useReducer, useCallback, useMemo, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

export type WorkspaceFilterKey = "with_email" | "no_email" | "with_contact" | "no_contact" | "with_alias" | "no_alias" | "enriched" | "not_enriched";
export type EmailGenFilter = "all" | "generated" | "to_generate";
export type SortingFilterMode = "all" | "unreviewed" | "reviewed" | "today" | "immediate" | "scheduled";
export type CockpitChannelFilter = "with_email" | "with_linkedin" | "with_phone" | "with_whatsapp";
export type CockpitQualityFilter = "enriched" | "not_enriched" | "with_alias" | "no_alias";

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
  cockpitCountries: Set<string>;
  cockpitChannels: Set<CockpitChannelFilter>;
  cockpitQuality: Set<CockpitQualityFilter>;
  cockpitStatus: string;
  attivitaStatus: string;
  attivitaPriority: string;
  networkSearch: string;
  networkQuality: string;
  networkSort: string;
  networkSelectedCountries: Set<string>;
  networkDirectoryOnly: boolean;
  emailCategory: string;
  emailSort: string;
  crmOrigin: Set<string>;
  crmQuality: string;
  crmChannel: string;
  crmSelectedCountries: Set<string>;
  crmActiveTab: string;
  crmGroupTab: string;
  crmWcaMatch: string;
}

// --- Reducer ---

type FilterAction =
  | { type: "SET"; key: keyof GlobalFilterState; value: string | string[] | boolean | number | null }
  | { type: "BATCH"; updates: Partial<GlobalFilterState> }
  | { type: "RESET" };

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
  cockpitCountries: new Set(),
  cockpitChannels: new Set(),
  cockpitQuality: new Set(),
  cockpitStatus: "all",
  attivitaStatus: "all",
  attivitaPriority: "all",
  networkSearch: "",
  networkQuality: "all",
  networkSort: "name",
  networkSelectedCountries: new Set<string>(),
  networkDirectoryOnly: false,
  emailCategory: "all",
  emailSort: "date_desc",
  crmOrigin: new Set<string>(),
  crmQuality: "all",
  crmChannel: "all",
  crmSelectedCountries: new Set<string>(),
  crmActiveTab: "contatti",
  crmGroupTab: "",
  crmWcaMatch: "all",
};

function cloneDefaults(): GlobalFilterState {
  return {
    ...defaults,
    origin: new Set(defaults.origin),
    workspaceFilters: new Set(),
    workspaceCountries: new Set(),
    cockpitCountries: new Set(),
    cockpitChannels: new Set(),
    cockpitQuality: new Set(),
    crmOrigin: new Set(defaults.crmOrigin),
    networkSelectedCountries: new Set(),
    crmSelectedCountries: new Set(),
  };
}

function filterReducer(state: GlobalFilterState, action: FilterAction): GlobalFilterState {
  switch (action.type) {
    case "SET":
      return { ...state, [action.key]: action.value };
    case "BATCH":
      return { ...state, ...action.updates };
    case "RESET":
      return cloneDefaults();
  }
}

// --- Legacy setter type aliases (backward compat) ---

type SetterName<K extends string> = `set${Capitalize<K>}`;

type LegacySetters = {
  [K in keyof GlobalFilterState as SetterName<K & string>]: (v: GlobalFilterState[K]) => void;
};

interface GlobalFiltersCtxValue extends LegacySetters {
  filters: GlobalFilterState;
  setFilter: <K extends keyof GlobalFilterState>(key: K, value: GlobalFilterState[K]) => void;
  batchUpdate: (updates: Partial<GlobalFilterState>) => void;
  resetFilters: () => void;
  currentRoute: string;
}

const Ctx = createContext<GlobalFiltersCtxValue | null>(null);

export function useGlobalFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return ctx;
}

// Generate setter name from key: "search" → "setSearch"
function toSetterName(key: string): string {
  return `set${key[0].toUpperCase()}${key.slice(1)}`;
}

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [filters, dispatch] = useReducer(filterReducer, undefined, cloneDefaults);

  const setFilter = useCallback(<K extends keyof GlobalFilterState>(key: K, value: GlobalFilterState[K]) => {
    dispatch({ type: "SET", key, value: value as string | number | boolean | string[] | null });
  }, []);

  const batchUpdate = useCallback((updates: Partial<GlobalFilterState>) => {
    dispatch({ type: "BATCH", updates });
  }, []);

  const resetFilters = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  // Auto-generate all 33 legacy setters for backward compatibility
  const legacySetters = useMemo(() => {
    const entries = Object.keys(defaults).map(key => [
      toSetterName(key),
      (val: string) => dispatch({ type: "SET", key: key as keyof GlobalFilterState, value: val }),
    ]);
    return Object.fromEntries(entries) as unknown as LegacySetters;
  }, []);

  const value = useMemo<GlobalFiltersCtxValue>(() => ({
    filters,
    setFilter,
    batchUpdate,
    resetFilters,
    currentRoute: location.pathname,
    ...legacySetters,
  }), [filters, setFilter, batchUpdate, resetFilters, location.pathname, legacySetters]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
