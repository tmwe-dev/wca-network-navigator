import { useState, useMemo, useCallback, useRef, lazy, Suspense } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Megaphone, Briefcase, ClipboardList, Loader2, X, UserPlus, Linkedin,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
const AddContactDialog = lazy(() => import("@/components/shared/AddContactDialog"));
import { useContacts } from "@/hooks/useContacts";
import { useSelection } from "@/hooks/useSelection";
import { Skeleton } from "@/components/ui/skeleton";
import { useContactActions } from "@/hooks/useContactActions";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { sortContacts, type SortKey, countryFlag } from "./contactHelpers";
import { ContactCard } from "./ContactCard";
import { useContactGroupCounts } from "@/hooks/useContactGroups";
import type { ContactFilters } from "@/hooks/useContacts";

interface Props {
  selectedId: string | null;
  onSelect: (contact: any) => void;
}

export function ContactListPanel({ selectedId, onSelect }: Props) {
  const { filters: gf, setCrmGroupTab, setCrmWcaMatch } = useGlobalFilters();
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const selection = useSelection([]);
  const linkedInLookup = useLinkedInLookup();
  const parentRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  const sortKey = (gf.sortBy || "company") as SortKey;
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

  // Build filters from global state + active group tab
  const queryFilters: ContactFilters = useMemo(() => {
    const f: ContactFilters = {
      holdingPattern: gf.holdingPattern as any,
      search: gf.search,
      page,
      pageSize: 200,
    };
    // Countries
    if (activeGroupTab && groupBy === "country") {
      f.countries = [activeGroupTab];
    } else if (gf.crmSelectedCountries.size > 0) {
      f.countries = Array.from(gf.crmSelectedCountries);
    }
    // Origins
    if (activeGroupTab && groupBy === "origin") {
      f.origins = [activeGroupTab];
    } else if (gf.crmOrigin.size > 0 && gf.crmOrigin.size < 4) {
      f.origins = Array.from(gf.crmOrigin);
    }
    // Lead status
    if (activeGroupTab && groupBy === "status") {
      f.leadStatus = activeGroupTab as any;
    } else if (gf.leadStatus && gf.leadStatus !== "all") {
      f.leadStatus = gf.leadStatus as any;
    }
    // Channel
    if (gf.crmChannel && gf.crmChannel !== "all") {
      f.channel = gf.crmChannel;
    }
    // Quality
    if (gf.crmQuality && gf.crmQuality !== "all") {
      f.quality = gf.crmQuality;
    }
    // WCA match
    if (wcaMatch !== "all") {
      f.wcaMatch = wcaMatch as any;
    }
    return f;
  }, [gf.holdingPattern, gf.search, gf.crmSelectedCountries, gf.crmOrigin, gf.leadStatus, gf.crmChannel, gf.crmQuality, page, activeGroupTab, groupBy, wcaMatch]);

  const { data, isLoading } = useContacts(queryFilters);
  const rawContacts = data?.items ?? [];
  const totalCount = data?.totalCount ?? 0;
  const pageSize = data?.pageSize ?? 200;
  const totalPages = Math.ceil(totalCount / pageSize);

  const contacts = useMemo(() => sortContacts(rawContacts, sortKey), [rawContacts, sortKey]);

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
    estimateSize: () => 52,
    overscan: 10,
  });

  const isBulk = selection.count > 0;
  const btnClass = "h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:bg-violet-500/10 hover:text-foreground";

  const handleTabClick = (key: string) => {
    setCrmGroupTab(key === activeGroupTab ? "" : key);
    setPage(0);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{totalCount} contatti</span>
            {/* WCA match filter chips */}
            <div className="flex gap-1">
              {(["all", "matched", "unmatched"] as const).map(v => (
                <button
                  key={v}
                  onClick={() => { setCrmWcaMatch(v); setPage(0); }}
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

      {/* Group tabs bar */}
      {tabs.length > 0 && (
        <div
          ref={tabsRef}
          className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 overflow-x-auto shrink-0 scrollbar-thin"
          style={{ scrollbarWidth: "thin" }}
        >
          <button
            onClick={() => { setCrmGroupTab(""); setPage(0); }}
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
      )}

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

      {/* Flat contact list */}
      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-3 space-y-2">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
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
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-3 py-1.5 border-t border-border/30 shrink-0">
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
            <ChevronLeft className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] text-muted-foreground">{page + 1} / {totalPages}</span>
          <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}

      {addOpen && (
        <Suspense fallback={null}>
          <AddContactDialog open={addOpen} onOpenChange={setAddOpen} defaultDestination="contacts" />
        </Suspense>
      )}
    </div>
  );
}
