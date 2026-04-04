import { useState, useMemo, useCallback, lazy, Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Megaphone, Briefcase, ClipboardList, Loader2, X, UserPlus, Linkedin, Upload,
} from "lucide-react";
import { ImportQuickAccessDialog } from "@/components/shared/ImportQuickAccessDialog";
import { useLinkedInLookup } from "@/hooks/useLinkedInLookup";
const AddContactDialog = lazy(() => import("@/components/shared/AddContactDialog"));
import { GroupStrip } from "./GroupStrip";
import { ExpandedGroupContent } from "./ExpandedGroupContent";
import { useContactGroupCounts } from "@/hooks/useContactGroups";
import { useImportGroups } from "@/hooks/useImportGroups";
import { useSelection } from "@/hooks/useSelection";
import { Skeleton } from "@/components/ui/skeleton";
import { useContactActions } from "@/hooks/useContactActions";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import type { SortKey } from "./contactHelpers";
import type { ContactFilters } from "@/hooks/useContacts";

interface Props {
  selectedId: string | null;
  onSelect: (contact: any) => void;
}

export function ContactListPanel({ selectedId, onSelect }: Props) {
  const { filters: gf } = useGlobalFilters();

  // Map global filters to local ContactFilters shape
  const filters: ContactFilters = useMemo(() => ({
    groupBy: gf.groupBy as any,
    holdingPattern: gf.holdingPattern as any,
    search: gf.search,
  }), [gf.groupBy, gf.holdingPattern, gf.search]);

  const sortKey = (gf.sortBy || "company") as SortKey;

  const { data: allGroupCounts, isLoading: groupsLoading } = useContactGroupCounts();
  const { data: importGroups } = useImportGroups();
  const selection = useSelection([]);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [addOpen, setAddOpen] = useState(false);
  const linkedInLookup = useLinkedInLookup();

  const currentGroupBy = filters.groupBy || "country";

  const groups = useMemo(() => {
    if (!allGroupCounts) return [];
    let filtered = allGroupCounts.filter((g) => g.group_type === currentGroupBy);
    const search = filters.search?.trim().toLowerCase();
    if (search) filtered = filtered.filter((g) => g.group_label.toLowerCase().includes(search) || g.group_key.toLowerCase().includes(search));
    return filtered.sort((a, b) => b.contact_count - a.contact_count);
  }, [allGroupCounts, currentGroupBy, filters.search]);

  const totalContacts = useMemo(() => groups.reduce((s, g) => s + g.contact_count, 0), [groups]);

  const setFiltersNoop = useCallback(() => {}, []);
  const setSortKeyNoop = useCallback(() => {}, []);

  const actions = useContactActions({
    selection, setFilters: setFiltersNoop as any, setSortKey: setSortKeyNoop as any,
    setOpenGroups, setSelectedGroups,
    currentGroupBy, holdingPattern: filters.holdingPattern,
  });

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((prev) => { const next = new Set(prev); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }, []);

  const isBulk = selection.count > 0;
  const btnClass = "h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:bg-violet-500/10 hover:text-foreground";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with count */}
      <div className="px-3 py-2 border-b border-border/30 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{totalContacts} contatti • {groups.length} gruppi</span>
          <Tooltip><TooltipTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => setAddOpen(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Nuovo
            </Button>
          </TooltipTrigger><TooltipContent className="text-xs">Inserisci contatto manualmente</TooltipContent></Tooltip>
        </div>
      </div>

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

      <div className="flex-1 overflow-y-auto min-h-0">
        {groupsLoading ? (
          <div className="p-3 space-y-2">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>
        ) : groups.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nessun contatto trovato</p>
        ) : (
          groups.map((group) => {
            const isOpen = openGroups.has(group.group_key);
            const groupSelKey = `${currentGroupBy}:${group.group_key}`;
            return (
              <div key={group.group_key}>
                <GroupStrip group={group} groupBy={currentGroupBy} isOpen={isOpen}
                  onToggle={() => toggleGroup(group.group_key)}
                  onDeepSearch={() => actions.handleGroupDeepSearch(group)}
                  onAlias={() => actions.handleGroupAlias(group)}
                  onLinkedInLookup={() => actions.handleGroupLinkedInLookup(group, linkedInLookup.lookupBatch)}
                  isGroupSelected={selectedGroups.has(groupSelKey)}
                  onToggleGroupSelect={() => actions.handleToggleGroupSelect(group)}
                  isAliasLoading={actions.aliasLoading} isDeepSearchLoading={actions.deepSearchLoading}
                  isLinkedInLookupLoading={actions.linkedInLookupLoading || linkedInLookup.progress.status === "running"}
                />
                {isOpen && (
                  <ExpandedGroupContent groupType={currentGroupBy} groupKey={group.group_key}
                    selectedId={selectedId} onSelect={onSelect} selection={selection}
                    holdingPattern={filters.holdingPattern} sortKey={sortKey} searchFilter={filters.search}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {addOpen && (
        <Suspense fallback={null}>
          <AddContactDialog open={addOpen} onOpenChange={setAddOpen} defaultDestination="contacts" />
        </Suspense>
      )}
    </div>
  );
}
