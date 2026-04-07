import { createContext, useContext, useReducer, useCallback, type ReactNode, type Dispatch } from "react";
import { useLocation } from "react-router-dom";

// ── Exported filter types ────────────────────────────────────────────

export type WorkspaceFilterKey = "with_email" | "no_email" | "with_contact" | "no_contact" | "with_alias" | "no_alias" | "enriched" | "not_enriched";
export type EmailGenFilter = "all" | "generated" | "to_generate";
export type SortingFilterMode = "all" | "unreviewed" | "reviewed" | "today" | "immediate" | "scheduled";
export type CockpitChannelFilter = "with_email" | "with_linkedin" | "with_phone" | "with_whatsapp";
export type CockpitQualityFilter = "enriched" | "not_enriched" | "with_alias" | "no_alias";

// ── State type ───────────────────────────────────────────────────────

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
  // Attività
  attivitaStatus: string;
  attivitaPriority: string;
  // Network
  networkSearch: string;
  networkQuality: string;
  networkSort: string;
  networkSelectedCountries: Set<string>;
  networkDirectoryOnly: boolean;
  // Email
  emailCategory: string;
  emailSort: string;
  // CRM extra
  crmOrigin: Set<string>;
  crmQuality: string;
  crmChannel: string;
  crmSelectedCountries: Set<string>;
  crmActiveTab: string;
  crmGroupTab: string;
  crmWcaMatch: string;
}

// ── Action types (discriminated union, grouped by domain) ────────────

export type FilterAction =
  // General
  | { type: "SET_SEARCH"; payload: string }
  | { type: "SET_SORT_BY"; payload: string }
  | { type: "SET_ORIGIN"; payload: Set<string> }
  | { type: "SET_QUALITY"; payload: string }
  | { type: "SET_GROUP_BY"; payload: string }
  | { type: "SET_HOLDING_PATTERN"; payload: string }
  | { type: "SET_LEAD_STATUS"; payload: string }
  | { type: "RESET" }
  // Network
  | { type: "SET_NETWORK_SEARCH"; payload: string }
  | { type: "SET_NETWORK_QUALITY"; payload: string }
  | { type: "SET_NETWORK_SORT"; payload: string }
  | { type: "SET_NETWORK_SELECTED_COUNTRIES"; payload: Set<string> }
  | { type: "SET_NETWORK_DIRECTORY_ONLY"; payload: boolean }
  // Outreach / Cockpit
  | { type: "SET_OUTREACH_TAB"; payload: string }
  | { type: "SET_COCKPIT_COUNTRIES"; payload: Set<string> }
  | { type: "SET_COCKPIT_CHANNELS"; payload: Set<CockpitChannelFilter> }
  | { type: "SET_COCKPIT_QUALITY"; payload: Set<CockpitQualityFilter> }
  | { type: "SET_COCKPIT_STATUS"; payload: string }
  | { type: "SET_ATTIVITA_STATUS"; payload: string }
  | { type: "SET_ATTIVITA_PRIORITY"; payload: string }
  // CRM
  | { type: "SET_CRM_ORIGIN"; payload: Set<string> }
  | { type: "SET_CRM_QUALITY"; payload: string }
  | { type: "SET_CRM_CHANNEL"; payload: string }
  | { type: "SET_CRM_SELECTED_COUNTRIES"; payload: Set<string> }
  | { type: "SET_CRM_ACTIVE_TAB"; payload: string }
  | { type: "SET_CRM_GROUP_TAB"; payload: string }
  | { type: "SET_CRM_WCA_MATCH"; payload: string }
  // Email
  | { type: "SET_EMAIL_CATEGORY"; payload: string }
  | { type: "SET_EMAIL_SORT"; payload: string }
  | { type: "SET_EMAIL_GEN_FILTER"; payload: EmailGenFilter }
  // Workspace
  | { type: "SET_WORKSPACE_FILTERS"; payload: Set<WorkspaceFilterKey> }
  | { type: "SET_WORKSPACE_COUNTRIES"; payload: Set<string> }
  // Sorting
  | { type: "SET_SORTING_FILTER"; payload: SortingFilterMode }
  | { type: "SET_SORTING_SEARCH"; payload: string };

// ── Defaults ─────────────────────────────────────────────────────────

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

// ── Reducer ──────────────────────────────────────────────────────────

export function filtersReducer(state: GlobalFilterState, action: FilterAction): GlobalFilterState {
  switch (action.type) {
    // General
    case "SET_SEARCH":               return { ...state, search: action.payload };
    case "SET_SORT_BY":              return { ...state, sortBy: action.payload };
    case "SET_ORIGIN":               return { ...state, origin: action.payload };
    case "SET_QUALITY":              return { ...state, quality: action.payload };
    case "SET_GROUP_BY":             return { ...state, groupBy: action.payload };
    case "SET_HOLDING_PATTERN":      return { ...state, holdingPattern: action.payload };
    case "SET_LEAD_STATUS":          return { ...state, leadStatus: action.payload };
    case "RESET":                    return cloneDefaults();
    // Network
    case "SET_NETWORK_SEARCH":               return { ...state, networkSearch: action.payload };
    case "SET_NETWORK_QUALITY":              return { ...state, networkQuality: action.payload };
    case "SET_NETWORK_SORT":                 return { ...state, networkSort: action.payload };
    case "SET_NETWORK_SELECTED_COUNTRIES":   return { ...state, networkSelectedCountries: action.payload };
    case "SET_NETWORK_DIRECTORY_ONLY":       return { ...state, networkDirectoryOnly: action.payload };
    // Outreach / Cockpit
    case "SET_OUTREACH_TAB":         return { ...state, outreachTab: action.payload };
    case "SET_COCKPIT_COUNTRIES":    return { ...state, cockpitCountries: action.payload };
    case "SET_COCKPIT_CHANNELS":     return { ...state, cockpitChannels: action.payload };
    case "SET_COCKPIT_QUALITY":      return { ...state, cockpitQuality: action.payload };
    case "SET_COCKPIT_STATUS":       return { ...state, cockpitStatus: action.payload };
    case "SET_ATTIVITA_STATUS":      return { ...state, attivitaStatus: action.payload };
    case "SET_ATTIVITA_PRIORITY":    return { ...state, attivitaPriority: action.payload };
    // CRM
    case "SET_CRM_ORIGIN":               return { ...state, crmOrigin: action.payload };
    case "SET_CRM_QUALITY":              return { ...state, crmQuality: action.payload };
    case "SET_CRM_CHANNEL":              return { ...state, crmChannel: action.payload };
    case "SET_CRM_SELECTED_COUNTRIES":   return { ...state, crmSelectedCountries: action.payload };
    case "SET_CRM_ACTIVE_TAB":           return { ...state, crmActiveTab: action.payload };
    case "SET_CRM_GROUP_TAB":            return { ...state, crmGroupTab: action.payload };
    case "SET_CRM_WCA_MATCH":            return { ...state, crmWcaMatch: action.payload };
    // Email
    case "SET_EMAIL_CATEGORY":       return { ...state, emailCategory: action.payload };
    case "SET_EMAIL_SORT":           return { ...state, emailSort: action.payload };
    case "SET_EMAIL_GEN_FILTER":     return { ...state, emailGenFilter: action.payload };
    // Workspace
    case "SET_WORKSPACE_FILTERS":    return { ...state, workspaceFilters: action.payload };
    case "SET_WORKSPACE_COUNTRIES":  return { ...state, workspaceCountries: action.payload };
    // Sorting
    case "SET_SORTING_FILTER":       return { ...state, sortingFilter: action.payload };
    case "SET_SORTING_SEARCH":       return { ...state, sortingSearch: action.payload };
    default:
      return state;
  }
}

// ── Context value type ───────────────────────────────────────────────

interface GlobalFiltersCtxValue {
  filters: GlobalFilterState;
  dispatch: Dispatch<FilterAction>;
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
  setCockpitCountries: (c: Set<string>) => void;
  setCockpitChannels: (c: Set<CockpitChannelFilter>) => void;
  setCockpitQuality: (c: Set<CockpitQualityFilter>) => void;
  setCockpitStatus: (s: string) => void;
  setAttivitaStatus: (s: string) => void;
  setAttivitaPriority: (s: string) => void;
  setNetworkSearch: (s: string) => void;
  setNetworkQuality: (s: string) => void;
  setNetworkSort: (s: string) => void;
  setNetworkSelectedCountries: (c: Set<string>) => void;
  setNetworkDirectoryOnly: (v: boolean) => void;
  setEmailCategory: (s: string) => void;
  setEmailSort: (s: string) => void;
  setCrmOrigin: (o: Set<string>) => void;
  setCrmQuality: (s: string) => void;
  setCrmChannel: (s: string) => void;
  setCrmSelectedCountries: (c: Set<string>) => void;
  setCrmActiveTab: (t: string) => void;
  setCrmGroupTab: (t: string) => void;
  setCrmWcaMatch: (t: string) => void;
  resetFilters: () => void;
  currentRoute: string;
}

const Ctx = createContext<GlobalFiltersCtxValue | null>(null);

export function useGlobalFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return ctx;
}

// ── Provider ─────────────────────────────────────────────────────────

export function GlobalFiltersProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [filters, dispatch] = useReducer(filtersReducer, undefined, cloneDefaults);

  // Backward-compatible setter wrappers
  const setSearch = useCallback((q: string) => dispatch({ type: "SET_SEARCH", payload: q }), []);
  const setSortBy = useCallback((s: string) => dispatch({ type: "SET_SORT_BY", payload: s }), []);
  const setOrigin = useCallback((o: Set<string>) => dispatch({ type: "SET_ORIGIN", payload: o }), []);
  const setQuality = useCallback((q: string) => dispatch({ type: "SET_QUALITY", payload: q }), []);
  const setGroupBy = useCallback((g: string) => dispatch({ type: "SET_GROUP_BY", payload: g }), []);
  const setHoldingPattern = useCallback((h: string) => dispatch({ type: "SET_HOLDING_PATTERN", payload: h }), []);
  const setLeadStatus = useCallback((l: string) => dispatch({ type: "SET_LEAD_STATUS", payload: l }), []);
  const setOutreachTab = useCallback((t: string) => dispatch({ type: "SET_OUTREACH_TAB", payload: t }), []);
  const setWorkspaceFilters = useCallback((f: Set<WorkspaceFilterKey>) => dispatch({ type: "SET_WORKSPACE_FILTERS", payload: f }), []);
  const setEmailGenFilter = useCallback((f: EmailGenFilter) => dispatch({ type: "SET_EMAIL_GEN_FILTER", payload: f }), []);
  const setWorkspaceCountries = useCallback((c: Set<string>) => dispatch({ type: "SET_WORKSPACE_COUNTRIES", payload: c }), []);
  const setSortingFilter = useCallback((f: SortingFilterMode) => dispatch({ type: "SET_SORTING_FILTER", payload: f }), []);
  const setSortingSearch = useCallback((s: string) => dispatch({ type: "SET_SORTING_SEARCH", payload: s }), []);
  const setCockpitCountries = useCallback((c: Set<string>) => dispatch({ type: "SET_COCKPIT_COUNTRIES", payload: c }), []);
  const setCockpitChannels = useCallback((c: Set<CockpitChannelFilter>) => dispatch({ type: "SET_COCKPIT_CHANNELS", payload: c }), []);
  const setCockpitQuality = useCallback((c: Set<CockpitQualityFilter>) => dispatch({ type: "SET_COCKPIT_QUALITY", payload: c }), []);
  const setCockpitStatus = useCallback((s: string) => dispatch({ type: "SET_COCKPIT_STATUS", payload: s }), []);
  const setAttivitaStatus = useCallback((s: string) => dispatch({ type: "SET_ATTIVITA_STATUS", payload: s }), []);
  const setAttivitaPriority = useCallback((s: string) => dispatch({ type: "SET_ATTIVITA_PRIORITY", payload: s }), []);
  const setNetworkSearch = useCallback((s: string) => dispatch({ type: "SET_NETWORK_SEARCH", payload: s }), []);
  const setNetworkQuality = useCallback((s: string) => dispatch({ type: "SET_NETWORK_QUALITY", payload: s }), []);
  const setNetworkSort = useCallback((s: string) => dispatch({ type: "SET_NETWORK_SORT", payload: s }), []);
  const setNetworkSelectedCountries = useCallback((c: Set<string>) => dispatch({ type: "SET_NETWORK_SELECTED_COUNTRIES", payload: c }), []);
  const setNetworkDirectoryOnly = useCallback((v: boolean) => dispatch({ type: "SET_NETWORK_DIRECTORY_ONLY", payload: v }), []);
  const setEmailCategory = useCallback((s: string) => dispatch({ type: "SET_EMAIL_CATEGORY", payload: s }), []);
  const setEmailSort = useCallback((s: string) => dispatch({ type: "SET_EMAIL_SORT", payload: s }), []);
  const setCrmOrigin = useCallback((o: Set<string>) => dispatch({ type: "SET_CRM_ORIGIN", payload: o }), []);
  const setCrmQuality = useCallback((s: string) => dispatch({ type: "SET_CRM_QUALITY", payload: s }), []);
  const setCrmChannel = useCallback((s: string) => dispatch({ type: "SET_CRM_CHANNEL", payload: s }), []);
  const setCrmSelectedCountries = useCallback((c: Set<string>) => dispatch({ type: "SET_CRM_SELECTED_COUNTRIES", payload: c }), []);
  const setCrmActiveTab = useCallback((t: string) => dispatch({ type: "SET_CRM_ACTIVE_TAB", payload: t }), []);
  const setCrmGroupTab = useCallback((t: string) => dispatch({ type: "SET_CRM_GROUP_TAB", payload: t }), []);
  const setCrmWcaMatch = useCallback((t: string) => dispatch({ type: "SET_CRM_WCA_MATCH", payload: t }), []);
  const resetFilters = useCallback(() => dispatch({ type: "RESET" }), []);

  return (
    <Ctx.Provider value={{
      filters, dispatch,
      setSearch, setSortBy, setOrigin, setQuality, setGroupBy, setHoldingPattern, setLeadStatus,
      setOutreachTab, setWorkspaceFilters, setEmailGenFilter, setWorkspaceCountries,
      setSortingFilter, setSortingSearch,
      setCockpitCountries, setCockpitChannels, setCockpitQuality, setCockpitStatus,
      setAttivitaStatus, setAttivitaPriority,
      setNetworkSearch, setNetworkQuality, setNetworkSort, setNetworkSelectedCountries, setNetworkDirectoryOnly,
      setEmailCategory, setEmailSort,
      setCrmOrigin, setCrmQuality, setCrmChannel, setCrmSelectedCountries, setCrmActiveTab,
      setCrmGroupTab, setCrmWcaMatch,
      resetFilters, currentRoute: location.pathname,
    }}>
      {children}
    </Ctx.Provider>
  );
}
