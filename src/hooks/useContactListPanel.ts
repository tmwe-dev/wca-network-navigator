import { useReducer, useRef, useEffect, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInView } from "@/hooks/useInView";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { useContactsPaginated, type ContactPaginatedFilters } from "@/hooks/useContactsPaginated";
import { useSelection } from "@/hooks/useSelection";
import { useContactActions } from "@/hooks/useContactActions";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useContactGroupCounts } from "@/hooks/useContactGroups";
import { rpcMatchContactsToWca } from "@/data/rpc";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";

type SortDir = "asc" | "desc" | null;

interface InlineFilter {
  field: string;
  value: string;
  label: string;
}

interface ListState {
  sortField: string;
  sortDir: SortDir;
  inlineFilters: InlineFilter[];
  addOpen: boolean;
}

type ListAction =
  | { type: "SET_SORT"; field: string; dir: SortDir }
  | { type: "ADD_INLINE_FILTER"; filter: InlineFilter }
  | { type: "REMOVE_INLINE_FILTER"; field: string; value: string }
  | { type: "CLEAR_INLINE_FILTERS" }
  | { type: "SET_ADD_OPEN"; value: boolean };

function listReducer(state: ListState, action: ListAction): ListState {
  switch (action.type) {
    case "SET_SORT":
      return { ...state, sortField: action.field, sortDir: action.dir };
    case "ADD_INLINE_FILTER": {
      const exists = state.inlineFilters.some(
        (f) => f.field === action.filter.field && f.value === action.filter.value,
      );
      if (exists) {
        return {
          ...state,
          inlineFilters: state.inlineFilters.filter(
            (f) => !(f.field === action.filter.field && f.value === action.filter.value),
          ),
        };
      }
      return { ...state, inlineFilters: [...state.inlineFilters, action.filter] };
    }
    case "REMOVE_INLINE_FILTER":
      return {
        ...state,
        inlineFilters: state.inlineFilters.filter(
          (f) => !(f.field === action.field && f.value === action.value),
        ),
      };
    case "CLEAR_INLINE_FILTERS":
      return { ...state, inlineFilters: [] };
    case "SET_ADD_OPEN":
      return { ...state, addOpen: action.value };
    default:
      return state;
  }
}

interface ContactRow {
  id: string;
  company_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  country: string | null;
  city: string | null;
  origin: string | null;
  lead_status: string;
  [key: string]: unknown;
}

interface WcaMatchResult {
  matched_count?: number;
}

interface DeduplicateResult {
  mergedGroups?: number;
  deletedRecords?: number;
}

export function useContactListPanel() {
  const { filters: gf, setCrmGroupTab, setCrmWcaMatch, setGroupBy } = useGlobalFilters();
  const selection = useSelection([]);
  const linkedInLookup = useLinkedInLookup();
  const parentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const [state, dispatch] = useReducer(listReducer, {
    sortField: "company",
    sortDir: "asc",
    inlineFilters: [],
    addOpen: false,
  });

  const [_openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [_selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  const groupBy = gf.groupBy || "country";
  const activeGroupTab = gf.crmGroupTab || "";
  const wcaMatch = gf.crmWcaMatch || "all";

  const { data: groupCounts } = useContactGroupCounts();
  const tabs = useMemo(() => {
    if (!groupCounts) return [];
    return groupCounts
      .filter((g) => g.group_type === groupBy)
      .sort((a, b) => a.group_label.localeCompare(b.group_label));
  }, [groupCounts, groupBy]);

  const totalAllGroups = useMemo(() => tabs.reduce((s, t) => s + t.contact_count, 0), [tabs]);

  const serverSort = useMemo(() => {
    if (!state.sortDir) return "company_asc";
    return `${state.sortField}_${state.sortDir}`;
  }, [state.sortField, state.sortDir]);

  const queryFilters: ContactPaginatedFilters = useMemo(() => {
    const f: ContactPaginatedFilters = {
      holdingPattern: gf.holdingPattern as "out" | "in" | "all" | undefined,
      search: gf.search,
      sort: serverSort,
    };
    if (activeGroupTab && groupBy === "country") f.countries = [activeGroupTab];
    else if (gf.crmSelectedCountries.size > 0) f.countries = Array.from(gf.crmSelectedCountries);
    if (activeGroupTab && groupBy === "origin") f.origins = [activeGroupTab];
    else if (gf.crmOrigin.size > 0 && gf.crmOrigin.size < 4) f.origins = Array.from(gf.crmOrigin);
    if (activeGroupTab && groupBy === "status") f.leadStatus = activeGroupTab;
    else if (gf.leadStatus && gf.leadStatus !== "all") f.leadStatus = gf.leadStatus;
    if (gf.crmChannel && gf.crmChannel !== "all") f.channel = gf.crmChannel;
    if (gf.crmQuality && gf.crmQuality !== "all") f.quality = gf.crmQuality;
    if (wcaMatch !== "all") f.wcaMatch = wcaMatch as "matched" | "unmatched";

    const inlineCountries = state.inlineFilters.filter((fl) => fl.field === "country").map((fl) => fl.value);
    const inlineCities = state.inlineFilters.filter((fl) => fl.field === "city").map((fl) => fl.value);
    const inlineOrigins = state.inlineFilters.filter((fl) => fl.field === "origin").map((fl) => fl.value);
    const inlineCompanies = state.inlineFilters.filter((fl) => fl.field === "company").map((fl) => fl.value);
    const inlineNames = state.inlineFilters.filter((fl) => fl.field === "name").map((fl) => fl.value);
    const inlineStatus = state.inlineFilters.find((fl) => fl.field === "leadStatus");

    if (inlineCountries.length > 0) f.countries = inlineCountries;
    if (inlineCities.length > 0) f.cities = inlineCities;
    if (inlineOrigins.length > 0) f.origins = inlineOrigins;
    if (inlineCompanies.length > 0) f.companies = inlineCompanies;
    if (inlineNames.length > 0) f.names = inlineNames;
    if (inlineStatus) f.leadStatus = inlineStatus.value;

    return f;
  }, [gf, activeGroupTab, groupBy, wcaMatch, serverSort, state.inlineFilters]);

  const {
    data: paginatedData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useContactsPaginated(queryFilters);

  const contacts: ContactRow[] = useMemo(() => {
    if (!paginatedData) return [];
    return paginatedData.pages.flatMap((p) => p.contacts) as ContactRow[];
  }, [paginatedData]);

  const totalCount = paginatedData?.pages?.[0]?.total ?? 0;

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView();
  useEffect(() => {
    if (loadMoreInView && hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [loadMoreInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const setFiltersNoop = useCallback(() => {}, []);
  const setSortKeyNoop = useCallback(() => {}, []);

  const actions = useContactActions({
    selection,
    setFilters: setFiltersNoop as () => void,
    setSortKey: setSortKeyNoop as () => void,
    setOpenGroups,
    setSelectedGroups,
    currentGroupBy: groupBy,
    holdingPattern: gf.holdingPattern as "out" | "in" | "all",
  });

  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 10,
  });

  const addInlineFilter = useCallback((field: string, value: string) => {
    dispatch({ type: "ADD_INLINE_FILTER", filter: { field, value, label: `${field}: ${value}` } });
  }, []);

  const removeInlineFilter = useCallback((field: string, value: string) => {
    dispatch({ type: "REMOVE_INLINE_FILTER", field, value });
  }, []);

  const handleSortClick = useCallback((field: string) => {
    const current = state.sortField === field ? state.sortDir : null;
    let nextDir: SortDir;
    if (current === null) nextDir = "asc";
    else if (current === "asc") nextDir = "desc";
    else nextDir = null;
    dispatch({ type: "SET_SORT", field, dir: nextDir });
  }, [state.sortField, state.sortDir]);

  const handleTabClick = useCallback((key: string) => {
    setCrmGroupTab(key === activeGroupTab ? "" : key);
  }, [activeGroupTab, setCrmGroupTab]);

  const handleDelete = useCallback(async () => {
    const ids = Array.from(selection.selectedIds);
    if (!confirm(`Eliminare ${ids.length} contatti?`)) return;
    try {
      const { deleteContacts } = await import("@/data/contacts");
      await deleteContacts(ids);
    } catch (err: unknown) {
      toast({ title: "Errore", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return;
    }
    toast({ title: `✅ ${ids.length} contatti eliminati` });
    selection.clear();
    qc.invalidateQueries({ queryKey: ["contacts-paginated"] });
    qc.invalidateQueries({ queryKey: queryKeys.contacts.groupCounts });
  }, [selection, qc]);

  const handleDeduplicate = useCallback(async () => {
    try {
      const data = await invokeEdge<DeduplicateResult>("deduplicate-contacts", {
        body: { contactIds: Array.from(selection.selectedIds) },
        context: "ContactListPanel.deduplicate_contacts",
      });
      toast({ title: `✅ Consolidati ${data?.mergedGroups || 0} gruppi, rimossi ${data?.deletedRecords || 0} duplicati` });
      selection.clear();
      qc.invalidateQueries({ queryKey: ["contacts-paginated"] });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.groupCounts });
    } catch (err: unknown) {
      toast({ title: "Errore", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  }, [selection, qc]);

  const handleWcaMatch = useCallback(async () => {
    try {
      const data = await rpcMatchContactsToWca();
      const result = data as WcaMatchResult | null;
      toast({ title: `✅ WCA Match completato — ${result?.matched_count || 0} associazioni trovate` });
      selection.clear();
      qc.invalidateQueries({ queryKey: ["contacts-paginated"] });
      qc.invalidateQueries({ queryKey: queryKeys.contacts.groupCounts });
    } catch (e: unknown) {
      toast({ title: "Errore", description: e instanceof Error ? e.message : String(e), variant: "destructive" });
    }
  }, [selection, qc]);

  return {
    state,
    dispatch,
    gf,
    selection,
    linkedInLookup,
    parentRef,
    tabsRef,
    contacts,
    totalCount,
    isLoading,
    isFetchingNextPage,
    loadMoreRef,
    virtualizer,
    actions,
    tabs,
    totalAllGroups,
    groupBy,
    activeGroupTab,
    wcaMatch,
    setCrmGroupTab,
    setCrmWcaMatch,
    setGroupBy,
    addInlineFilter,
    removeInlineFilter,
    handleSortClick,
    handleTabClick,
    handleDelete,
    handleDeduplicate: selection.count >= 2 ? handleDeduplicate : undefined,
    handleWcaMatch,
  };
}
