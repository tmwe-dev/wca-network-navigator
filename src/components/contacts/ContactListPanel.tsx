import { useState, useMemo, useCallback, useRef, useEffect, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Megaphone, Briefcase, ClipboardList, Loader2, X, UserPlus, Linkedin,
  Trash2, ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInView } from "@/hooks/useInView";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
const AddContactDialog = lazy(() => import("@/components/shared/AddContactDialog"));
import { useContactsPaginated, type ContactPaginatedFilters } from "@/hooks/useContactsPaginated";
import { useSelection } from "@/hooks/useSelection";
import { Skeleton } from "@/components/ui/skeleton";
import { useContactActions } from "@/hooks/useContactActions";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { countryFlag } from "./contactHelpers";
import { ContactCard } from "./ContactCard";
import { useContactGroupCounts } from "@/hooks/useContactGroups";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTACT_GRID_COLS, CONTACT_GRID_CLASS } from "./contactGridLayout";

interface Props {
  selectedId: string | null;
  onSelect: (contact: any) => void;
}

type SortDir = "asc" | "desc" | null;
interface SortState { field: string; dir: SortDir }

interface InlineFilter { field: string; value: string; label: string }

const SORT_COLUMNS = [
  { field: "company", label: "Azienda", sortKey: "company" },
  { field: "name", label: "Contatto", sortKey: "name" },
  { field: "city", label: "Città", sortKey: "city" },
  { field: "country", label: "Paese", sortKey: "country" },
  { field: "origin", label: "Origine", sortKey: "origin" },
];

export function ContactListPanel({ selectedId, onSelect }: Props) {
  const { filters: gf, setCrmGroupTab, setCrmWcaMatch, setGroupBy } = useGlobalFilters();
  const [addOpen, setAddOpen] = useState(false);
  const selection = useSelection([]);
  const linkedInLookup = useLinkedInLookup();
  const parentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Sort state
  const [sortState, setSortState] = useState<SortState>({ field: "company", dir: "asc" });

  // Inline filters (click on value in card)
  const [inlineFilters, setInlineFilters] = useState<InlineFilter[]>([]);

  const addInlineFilter = useCallback((field: string, value: string) => {
    setInlineFilters(prev => {
      const exists = prev.some(f => f.field === field && f.value === value);
      if (exists) return prev.filter(f => !(f.field === field && f.value === value));
      return [...prev, { field, value, label: `${field}: ${value}` }];
    });
  }, []);

  const removeInlineFilter = useCallback((field: string, value: string) => {
    setInlineFilters(prev => prev.filter(f => !(f.field === field && f.value === value)));
  }, []);

  const groupBy = gf.groupBy || "country";
  const activeGroupTab = gf.crmGroupTab || "";
  const wcaMatch = gf.crmWcaMatch || "all";

  // Group counts for tabs
  const { data: groupCounts } = useContactGroupCounts();
  const tabs = useMemo(() => {
    if (!groupCounts) return [];
    return groupCounts
      .filter(g => g.group_type === groupBy)
      .sort((a, b) => b.contact_count - a.contact_count);
  }, [groupCounts, groupBy]);

  const totalAllGroups = useMemo(() => tabs.reduce((s, t) => s + t.contact_count, 0), [tabs]);

  // Build sort key for server
  const serverSort = useMemo(() => {
    if (!sortState.dir) return "company_asc";
    return `${sortState.field}_${sortState.dir}`;
  }, [sortState]);

  // Build filters for infinite query
  const queryFilters: ContactPaginatedFilters = useMemo(() => {
    const f: ContactPaginatedFilters = {
      holdingPattern: gf.holdingPattern as any,
      search: gf.search,
      sort: serverSort,
    };
    // Group tab filters
    if (activeGroupTab && groupBy === "country") f.countries = [activeGroupTab];
    else if (gf.crmSelectedCountries.size > 0) f.countries = Array.from(gf.crmSelectedCountries);

    if (activeGroupTab && groupBy === "origin") f.origins = [activeGroupTab];
    else if (gf.crmOrigin.size > 0 && gf.crmOrigin.size < 4) f.origins = Array.from(gf.crmOrigin);

    if (activeGroupTab && groupBy === "status") f.leadStatus = activeGroupTab;
    else if (gf.leadStatus && gf.leadStatus !== "all") f.leadStatus = gf.leadStatus;

    if (gf.crmChannel && gf.crmChannel !== "all") f.channel = gf.crmChannel;
    if (gf.crmQuality && gf.crmQuality !== "all") f.quality = gf.crmQuality;
    if (wcaMatch !== "all") f.wcaMatch = wcaMatch as any;

    // Apply inline filters
    const inlineCountries = inlineFilters.filter(f => f.field === "country").map(f => f.value);
    const inlineCities = inlineFilters.filter(f => f.field === "city").map(f => f.value);
    const inlineOrigins = inlineFilters.filter(f => f.field === "origin").map(f => f.value);
    const inlineStatus = inlineFilters.find(f => f.field === "leadStatus");

    if (inlineCountries.length > 0) f.countries = inlineCountries;
    if (inlineCities.length > 0) f.cities = inlineCities;
    if (inlineOrigins.length > 0) f.origins = inlineOrigins;
    if (inlineStatus) f.leadStatus = inlineStatus.value;

    return f;
  }, [gf, activeGroupTab, groupBy, wcaMatch, serverSort, inlineFilters]);

  const {
    data: paginatedData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useContactsPaginated(queryFilters);

  // Flatten all pages (already sorted server-side)
  const contacts = useMemo(() => {
    if (!paginatedData) return [];
    return paginatedData.pages.flatMap(p => p.contacts);
  }, [paginatedData]);

  const totalCount = paginatedData?.pages?.[0]?.total ?? 0;

  // Infinite scroll sentinel
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView();
  useEffect(() => {
    if (loadMoreInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [loadMoreInView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const setFiltersNoop = useCallback(() => {}, []);
  const setSortKeyNoop = useCallback(() => {}, []);

  const actions = useContactActions({
    selection, setFilters: setFiltersNoop as any, setSortKey: setSortKeyNoop as any,
    setOpenGroups, setSelectedGroups,
    currentGroupBy: groupBy, holdingPattern: gf.holdingPattern as "out" | "in" | "all",
  });

  const virtualizer = useVirtualizer({
    count: contacts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 68,
    overscan: 10,
  });

  const isBulk = selection.count > 0;
  const btnClass = "h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:bg-violet-500/10 hover:text-foreground";

  const handleTabClick = (key: string) => {
    setCrmGroupTab(key === activeGroupTab ? "" : key);
  };

  const handleSortClick = (field: string) => {
    setSortState(prev => {
      if (prev.field !== field) return { field, dir: "asc" };
      if (prev.dir === "asc") return { field, dir: "desc" };
      if (prev.dir === "desc") return { field, dir: null };
      return { field, dir: "asc" };
    });
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortState.field !== field || !sortState.dir) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortState.dir === "asc"
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{totalCount} contatti</span>
            <div className="flex gap-1">
              {(["all", "matched", "unmatched"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setCrmWcaMatch(v)}
                  className={cn(
                    "text-[9px] px-1.5 py-0.5 rounded-full transition-colors",
                    wcaMatch === v
                      ? "bg-primary/20 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {v === "all" ? "Tutti" : v === "matched" ? "WCA ✓" : "Solo CRM"}
                </button>
              ))}
            </div>
          </div>
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => setAddOpen(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Nuovo
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Inserisci contatto manualmente</TooltipContent></Tooltip>
        </div>
      </div>

      {/* Group tabs bar with dropdown */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 shrink-0">
        {/* Dropdown for group type */}
        <Select value={groupBy} onValueChange={(v) => { setGroupBy(v as any); setCrmGroupTab(""); }}>
          <SelectTrigger className="h-7 w-[100px] text-[10px] border-border/40 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="country">Paese</SelectItem>
            <SelectItem value="origin">Origine</SelectItem>
            <SelectItem value="status">Stato</SelectItem>
            <SelectItem value="date">Data</SelectItem>
          </SelectContent>
        </Select>

        {/* Scrollable tabs */}
        <div
          ref={tabsRef}
          className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-thin"
          style={{ scrollbarWidth: "thin" }}
        >
          <button
            onClick={() => setCrmGroupTab("")}
            className={cn(
              "shrink-0 text-[10px] px-2 py-1 rounded-md whitespace-nowrap transition-colors",
              !activeGroupTab
                ? "bg-primary/20 text-primary font-semibold"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            Tutti ({totalAllGroups})
          </button>
          {tabs.slice(0, 50).map(t => {
            const isActive = activeGroupTab === t.group_key;
            const label = groupBy === "country"
              ? `${countryFlag(t.group_key)} ${t.group_label}`
              : t.group_label;
            return (
              <button
                key={t.group_key}
                onClick={() => handleTabClick(t.group_key)}
                className={cn(
                  "shrink-0 text-[10px] px-2 py-1 rounded-md whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary/20 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-muted/60"
                )}
              >
                {label} ({t.contact_count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline filter chips */}
      {inlineFilters.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border/30 flex flex-wrap gap-1 shrink-0">
          {inlineFilters.map((f, i) => (
            <span
              key={`${f.field}-${f.value}-${i}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/20"
            >
              {f.value}
              <button
                onClick={() => removeInlineFilter(f.field, f.value)}
                className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-colors"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
          <button
            onClick={() => setInlineFilters([])}
            className="text-[9px] text-muted-foreground hover:text-foreground ml-1"
          >
            Reset
          </button>
        </div>
      )}

      {/* Sortable column header — same grid as ContactCard */}
      <div
        className={cn(CONTACT_GRID_CLASS, "px-2 py-1 border-b border-border/30 shrink-0 bg-muted/30")}
        style={{ gridTemplateColumns: CONTACT_GRID_COLS }}
      >
        <div /> {/* index+checkbox */}
        <div /> {/* flag */}
        {SORT_COLUMNS.map(col => (
          <button
            key={col.field}
            onClick={() => handleSortClick(col.sortKey)}
            className={cn(
              "flex items-center gap-0.5 text-[9px] font-medium transition-colors text-left",
              sortState.field === col.sortKey && sortState.dir ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {col.label}
            <SortIcon field={col.sortKey} />
          </button>
        ))}
      </div>

      {/* Bulk actions */}
      {isBulk && (
        <div className="px-3 py-1.5 border-b border-violet-500/15 bg-gradient-to-r from-violet-500/[0.06] to-purple-500/[0.04] backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-violet-300 mr-1">{selection.count} sel.</span>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className={btnClass}
                onClick={() => actions.handleAICommand({ type: "send_to_workspace", contact_ids: Array.from(selection.selectedIds) })}>
                <Briefcase className="w-3.5 h-3.5" /> Workspace
              </Button>
            </TooltipTrigger><TooltipContent className="text-xs">Invia al Workspace Email</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className={btnClass}
                onClick={() => actions.handleAICommand({ type: "create_jobs", contact_ids: Array.from(selection.selectedIds) })}>
                <ClipboardList className="w-3.5 h-3.5" /> Job
              </Button>
            </TooltipTrigger><TooltipContent className="text-xs">Crea Job Campagna</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className={btnClass} disabled={actions.deepSearchLoading}
                onClick={() => actions.handleDeepSearch(Array.from(selection.selectedIds).slice(0, 20))}>
                {actions.deepSearchLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Deep Search
              </Button>
            </TooltipTrigger><TooltipContent className="text-xs">Arricchisci con Deep Search (max 20)</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className={btnClass} disabled={actions.linkedInLookupLoading || linkedInLookup.progress.status === "running"}
                onClick={() => actions.handleLinkedInLookup(Array.from(selection.selectedIds), linkedInLookup.lookupBatch)}>
                {actions.linkedInLookupLoading || linkedInLookup.progress.status === "running" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Linkedin className="w-3.5 h-3.5" />} LinkedIn
              </Button>
            </TooltipTrigger><TooltipContent className="text-xs">Cerca URL LinkedIn via Google</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className={btnClass} onClick={actions.handleBulkCampaign}>
                <Megaphone className="w-3.5 h-3.5" /> Campagna
              </Button>
            </TooltipTrigger><TooltipContent className="text-xs">Aggiungi a Campagna</TooltipContent></Tooltip>
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost"
                className="h-7 px-2.5 text-xs gap-1.5 text-destructive hover:bg-destructive/10"
                onClick={async () => {
                  const ids = Array.from(selection.selectedIds);
                  if (!confirm(`Eliminare ${ids.length} contatti?`)) return;
                  const { error } = await supabase.from("imported_contacts").delete().in("id", ids);
                  if (error) { toast({ title: "Errore", description: error.message, variant: "destructive" }); return; }
                  toast({ title: `✅ ${ids.length} contatti eliminati` });
                  selection.clear();
                  qc.invalidateQueries({ queryKey: ["contacts-paginated"] });
                  qc.invalidateQueries({ queryKey: ["contact-group-counts"] });
                }}>
                <Trash2 className="w-3.5 h-3.5" /> Elimina
              </Button>
            </TooltipTrigger><TooltipContent className="text-xs">Elimina contatti selezionati</TooltipContent></Tooltip>
            <button onClick={() => { selection.clear(); setSelectedGroups(new Set()); }}
              className="ml-auto hover:bg-violet-500/20 rounded-full p-0.5 transition-colors text-violet-400">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {linkedInLookup.progress.status === "running" && (
        <div className="px-3 py-1.5 border-b border-border/30 bg-muted/50 shrink-0">
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin text-primary" />
            <span className="truncate font-medium">{linkedInLookup.progress.currentName}</span>
            <span className="ml-auto shrink-0">{linkedInLookup.progress.current}/{linkedInLookup.progress.total}</span>
          </div>
          <div className="flex gap-2 mt-0.5 text-[9px]">
            <span className="text-green-500">✓ {linkedInLookup.progress.found}</span>
            <span className="text-muted-foreground">✗ {linkedInLookup.progress.notFound}</span>
            <span className="text-muted-foreground">⟳ {linkedInLookup.progress.skipped}</span>
            <button onClick={linkedInLookup.abort} className="ml-auto text-destructive hover:underline">Stop</button>
          </div>
        </div>
      )}

      {/* Flat contact list with infinite scroll */}
      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-3 space-y-2">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nessun contatto trovato</p>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const c = contacts[vItem.index];
              return (
                <div
                  key={c.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: vItem.size,
                    transform: `translateY(${vItem.start}px)`,
                  }}
                >
                  <ContactCard
                    c={c}
                    isActive={selectedId === c.id}
                    isSelected={selection.selectedIds.has(c.id)}
                    onSelect={() => onSelect(c)}
                    onToggle={() => selection.toggle(c.id)}
                    index={vItem.index}
                    onFilterClick={addInlineFilter}
                  />
                </div>
              );
            })}
          </div>
        )}
        {/* Infinite scroll sentinel */}
        <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
          {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {addOpen && (
        <Suspense fallback={null}>
          <AddContactDialog open={addOpen} onOpenChange={setAddOpen} defaultDestination="contacts" />
        </Suspense>
      )}
    </div>
  );
}
