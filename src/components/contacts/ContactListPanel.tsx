import { lazy, Suspense, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, Megaphone, Briefcase, ClipboardList, Loader2, X, UserPlus, Linkedin,
  Trash2, ArrowUpDown, ArrowUp, ArrowDown, Plane,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { UnifiedBulkActionBar } from "@/components/shared/UnifiedBulkActionBar";
import { Skeleton } from "@/components/ui/skeleton";
import { countryFlag } from "./contactHelpers";
import { ContactCard } from "./ContactCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONTACT_GRID_COLS, CONTACT_GRID_CLASS } from "./contactGridLayout";
import { useContactListPanel } from "@/hooks/useContactListPanel";
import { PageErrorBoundary } from "@/components/ui/PageErrorBoundary";
import { ListSkeleton } from "@/components/ui/ListSkeleton";
import { ContactSegments, type SegmentKey } from "@/components/contacts/ContactSegments";

const AddContactDialog = lazy(() => import("@/components/shared/AddContactDialog"));

interface Props {
  selectedId: string | null;
  onSelect: (contact: Record<string, unknown>) => void;
}

const SORT_COLUMNS = [
  { field: "company", label: "Azienda", sortKey: "company" },
  { field: "name", label: "Contatto", sortKey: "name" },
  { field: "city", label: "Città", sortKey: "city" },
  { field: "origin", label: "Origine", sortKey: "origin" },
];

export function ContactListPanel({ selectedId, onSelect }: Props) {
  const [activeSegment, setActiveSegment] = useState<SegmentKey>(null);
  const h = useContactListPanel();
  const { state, dispatch, gf, selection, linkedInLookup, parentRef, tabsRef,
    contacts, totalCount, isLoading, isFetchingNextPage, loadMoreRef, virtualizer,
    actions, tabs, totalAllGroups, groupBy, activeGroupTab, wcaMatch,
    setCrmGroupTab, setCrmWcaMatch, setGroupBy,
    addInlineFilter, removeInlineFilter, handleSortClick, handleTabClick,
    handleDelete, handleDeduplicate, handleWcaMatch } = h;

  const isBulk = selection.count > 0;

  const SortIcon = ({ field }: { field: string }) => {
    if (state.sortField !== field || !state.sortDir) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return state.sortDir === "asc" ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  if (isLoading && contacts.length === 0) return <ListSkeleton rows={8} />;

  return (
    <PageErrorBoundary>
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{totalCount} contatti</span>
            {gf.holdingPattern === "out" && <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-sky-500/15 text-sky-400 border border-sky-500/20"><Plane className="w-2.5 h-2.5" /> Fuori circuito</span>}
            {gf.holdingPattern === "in" && <span className="inline-flex items-center gap-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive border border-destructive/20"><Plane className="w-2.5 h-2.5 animate-pulse" /> In circuito</span>}
            <div className="flex gap-1">
              {(["all", "matched", "unmatched"] as const).map(v => (
                <button key={v} onClick={() => setCrmWcaMatch(v)}
                  className={cn("text-[9px] px-1.5 py-0.5 rounded-full transition-colors", wcaMatch === v ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:bg-muted")}>
                  {v === "all" ? "Tutti" : v === "matched" ? "WCA ✓" : "Solo CRM"}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <ContactSegments activeSegment={activeSegment} onSegmentChange={setActiveSegment} />
            <Tooltip><TooltipTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => dispatch({ type: "SET_ADD_OPEN", value: true })}>
                <UserPlus className="w-3.5 h-3.5" /> Nuovo
              </Button>
            </TooltipTrigger><TooltipContent className="text-xs">Inserisci contatto manualmente</TooltipContent></Tooltip>
          </div>
        </div>
      </div>

      {/* Group tabs */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 shrink-0">
        <Select value={groupBy} onValueChange={(v) => { setGroupBy(v); setCrmGroupTab(""); }}>
          <SelectTrigger className="h-7 w-[100px] text-[10px] border-border/40 bg-transparent"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="country">Paese</SelectItem>
            <SelectItem value="origin">Origine</SelectItem>
            <SelectItem value="status">Stato</SelectItem>
            <SelectItem value="date">Data</SelectItem>
          </SelectContent>
        </Select>
        <div ref={tabsRef} className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
          <button onClick={() => setCrmGroupTab("")} className={cn("shrink-0 text-[10px] px-2 py-1 rounded-md whitespace-nowrap transition-colors", !activeGroupTab ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:bg-muted/60")}>
            Tutti ({totalAllGroups})
          </button>
          {tabs.slice(0, 50).map(t => (
            <button key={t.group_key} onClick={() => handleTabClick(t.group_key)}
              className={cn("shrink-0 text-[10px] px-2 py-1 rounded-md whitespace-nowrap transition-colors", activeGroupTab === t.group_key ? "bg-primary/20 text-primary font-semibold" : "text-foreground/80 hover:bg-muted/60")}>
              {groupBy === "country" ? `${countryFlag(t.group_key)} ${t.group_label}` : t.group_label.toUpperCase()} ({t.contact_count})
            </button>
          ))}
        </div>
      </div>

      {/* Inline filter chips */}
      {state.inlineFilters.length > 0 && (
        <div className="px-3 py-1.5 border-b border-border/30 flex flex-wrap gap-1 shrink-0">
          {state.inlineFilters.map((f, i) => (
            <span key={`${f.field}-${f.value}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary border border-primary/20">
              {f.value} ({totalCount})
              <button onClick={() => removeInlineFilter(f.field, f.value)} className="ml-0.5 p-0.5 rounded-full hover:bg-primary/20 transition-colors"><X className="w-2.5 h-2.5" /></button>
            </span>
          ))}
          <button onClick={() => dispatch({ type: "CLEAR_INLINE_FILTERS" })} className="text-[9px] text-muted-foreground hover:text-foreground ml-1">Reset</button>
        </div>
      )}

      {/* Sortable column header */}
      <div className={cn(CONTACT_GRID_CLASS, "px-2 py-1 border-b border-border/30 shrink-0 bg-muted/30")} style={{ gridTemplateColumns: CONTACT_GRID_COLS }}>
        <div className="flex items-center justify-center">
          <Checkbox checked={contacts.length > 0 && selection.selectedIds.size === contacts.length}
            onCheckedChange={(checked) => { if (checked) selection.setSelectedIds(new Set(contacts.map((c) => c.id))); else selection.clear(); }}
            aria-label="Seleziona tutti" className="shrink-0" />
        </div>
        <div />
        {SORT_COLUMNS.map(col => (
          <button key={col.field} onClick={() => handleSortClick(col.sortKey)}
            className={cn("flex items-center gap-0.5 text-[9px] font-medium transition-colors text-left", state.sortField === col.sortKey && state.sortDir ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            {col.label} <SortIcon field={col.sortKey} />
          </button>
        ))}
        <div />
      </div>

      {/* Bulk actions */}
      {isBulk && (
        <UnifiedBulkActionBar count={selection.count} sourceType="contact"
          onClear={() => selection.clear()}
          onWorkspace={() => actions.handleAICommand({ type: "send_to_workspace", contact_ids: Array.from(selection.selectedIds) })}
          onCockpit={() => actions.handleAICommand({ type: "create_jobs", contact_ids: Array.from(selection.selectedIds) })}
          onDeepSearch={() => actions.handleDeepSearch(Array.from(selection.selectedIds).slice(0, 20))}
          deepSearchLoading={actions.deepSearchLoading}
          onLinkedIn={() => actions.handleLinkedInLookup(Array.from(selection.selectedIds), linkedInLookup.lookupBatch)}
          linkedInLoading={actions.linkedInLookupLoading || linkedInLookup.progress.status === "running"}
          onCampaign={actions.handleBulkCampaign}
          onGoogleLogo={() => {
            const ids = Array.from(selection.selectedIds);
            const c = contacts.find(x => ids.includes(x.id));
            if (c?.company_name) window.open(`https://www.google.com/search?q=${encodeURIComponent(c.company_name + " logo")}&tbm=isch`, "_blank");
          }}
          onDelete={handleDelete}
          onDeduplicate={handleDeduplicate}
          onWcaMatch={handleWcaMatch}
        />
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

      {/* Contact list */}
      <div ref={parentRef} className="flex-1 overflow-y-auto min-h-0">
        {isLoading ? (
          <div className="p-3 space-y-2">{Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}</div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="rounded-full bg-muted/40 p-4 mb-4">
              <Search className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">Nessun contatto trovato</h3>
            <p className="text-sm text-muted-foreground max-w-xs mb-4">
              Importa contatti da CSV, scaricali dalla directory WCA, o aggiungili manualmente.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddDialog(true)}>
              <UserPlus className="w-3.5 h-3.5" /> Aggiungi contatto
            </Button>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vItem) => {
              const c = contacts[vItem.index];
              return (
                <div key={c.id} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: vItem.size, transform: `translateY(${vItem.start}px)` }}>
                  <ContactCard c={c} isActive={selectedId === c.id} isSelected={selection.selectedIds.has(c.id)}
                    onSelect={() => {}} onViewDetail={() => onSelect(c)} onToggle={() => selection.toggle(c.id)}
                    index={vItem.index} onFilterClick={addInlineFilter} />
                </div>
              );
            })}
          </div>
        )}
        <div ref={loadMoreRef} className="h-8 flex items-center justify-center">
          {isFetchingNextPage && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {state.addOpen && (
        <Suspense fallback={null}>
          <AddContactDialog open={state.addOpen} onOpenChange={(v) => dispatch({ type: "SET_ADD_OPEN", value: v })} defaultDestination="contacts" />
        </Suspense>
      )}
    </div>
    </PageErrorBoundary>
  );
}
