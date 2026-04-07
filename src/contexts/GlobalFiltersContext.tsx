import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
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

const Ctx = createContext<GlobalFiltersCtxValue | null>(null);

export function useGlobalFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useGlobalFilters must be used within GlobalFiltersProvider");
  return ctx;
}

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
  const setCockpitCountries = useCallback((c: Set<string>) => setFilters(p => ({ ...p, cockpitCountries: c })), []);
  const setCockpitChannels = useCallback((c: Set<CockpitChannelFilter>) => setFilters(p => ({ ...p, cockpitChannels: c })), []);
  const setCockpitQuality = useCallback((c: Set<CockpitQualityFilter>) => setFilters(p => ({ ...p, cockpitQuality: c })), []);
  const setCockpitStatus = useCallback((s: string) => setFilters(p => ({ ...p, cockpitStatus: s })), []);
  const setAttivitaStatus = useCallback((s: string) => setFilters(p => ({ ...p, attivitaStatus: s })), []);
  const setAttivitaPriority = useCallback((s: string) => setFilters(p => ({ ...p, attivitaPriority: s })), []);
  const setNetworkSearch = useCallback((s: string) => setFilters(p => ({ ...p, networkSearch: s })), []);
  const setNetworkQuality = useCallback((s: string) => setFilters(p => ({ ...p, networkQuality: s })), []);
  const setNetworkSort = useCallback((s: string) => setFilters(p => ({ ...p, networkSort: s })), []);
  const setNetworkSelectedCountries = useCallback((c: Set<string>) => setFilters(p => ({ ...p, networkSelectedCountries: c })), []);
  const setNetworkDirectoryOnly = useCallback((v: boolean) => setFilters(p => ({ ...p, networkDirectoryOnly: v })), []);
  const setEmailCategory = useCallback((s: string) => setFilters(p => ({ ...p, emailCategory: s })), []);
  const setEmailSort = useCallback((s: string) => setFilters(p => ({ ...p, emailSort: s })), []);
  const setCrmOrigin = useCallback((o: Set<string>) => setFilters(p => ({ ...p, crmOrigin: o })), []);
  const setCrmQuality = useCallback((s: string) => setFilters(p => ({ ...p, crmQuality: s })), []);
  const setCrmChannel = useCallback((s: string) => setFilters(p => ({ ...p, crmChannel: s })), []);
  const setCrmSelectedCountries = useCallback((c: Set<string>) => setFilters(p => ({ ...p, crmSelectedCountries: c })), []);
  const setCrmActiveTab = useCallback((t: string) => setFilters(p => ({ ...p, crmActiveTab: t })), []);
  const setCrmGroupTab = useCallback((t: string) => setFilters(p => ({ ...p, crmGroupTab: t })), []);
  const setCrmWcaMatch = useCallback((t: string) => setFilters(p => ({ ...p, crmWcaMatch: t })), []);
  const resetFilters = useCallback(() => setFilters(cloneDefaults()), []);

  return (
    <Ctx.Provider value={{
      filters, setSearch, setSortBy, setOrigin, setQuality, setGroupBy, setHoldingPattern, setLeadStatus,
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
