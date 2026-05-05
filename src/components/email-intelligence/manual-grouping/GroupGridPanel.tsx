import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, RefreshCw, Plus } from "lucide-react";
import { GroupDropZone } from "../management/GroupDropZone";
import type { SenderAnalysis, EmailSenderGroup } from "@/types/email-management";
import { cn } from "@/lib/utils";
import { LETTER_RANGES, GROUP_SORT_CYCLE, GROUP_SORT_META, type LetterRange, type GroupSort } from "./letterRange";

export function GroupGridPanel(props: {
  groups: EmailSenderGroup[];
  visibleGroups: EmailSenderGroup[];
  groupSortOption: GroupSort;
  onGroupSortChange: (s: GroupSort) => void;
  letterRange: LetterRange;
  onLetterRangeChange: (r: LetterRange) => void;
  hoveredGroupId: string | null;
  highlightedGroupName: string | null;
  assignedByGroup: Map<string, Array<{ id: string; email_address: string; display_name: string | null; company_name: string | null; domain: string | null }>>;
  reloadAssignedRules: () => void;
  loadData: () => void;
  selectedCount: number;
  onBulkAssign: (group: { id: string; nome_gruppo: string }) => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onCreateGroup: () => void;
  onPartnerClick: (sender: SenderAnalysis) => void;
}) {
  const { groups, visibleGroups, groupSortOption, onGroupSortChange,
    letterRange, onLetterRangeChange, hoveredGroupId, highlightedGroupName,
    assignedByGroup, reloadAssignedRules, loadData, selectedCount, onBulkAssign,
    onRefresh, isRefreshing, onCreateGroup, onPartnerClick } = props;
  const sortMeta = GROUP_SORT_META[groupSortOption];
  const SortIcon = sortMeta.Icon;
  return (
    <div className="flex-1 min-h-0 flex flex-col border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b bg-muted/30 flex-shrink-0 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Gruppi ({visibleGroups.length}{letterRange !== "all" ? `/${groups.length}` : ""})
        </span>
        <TooltipProvider delayDuration={300}>
          <div className="flex items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => onGroupSortChange(GROUP_SORT_CYCLE[groupSortOption])}
                  aria-label="Cambia ordinamento gruppi"
                >
                  <SortIcon className="h-3.5 w-3.5 mr-1.5" />
                  {sortMeta.label}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Click per ciclare A→Z, Z→A, più/meno contatti</TooltipContent>
            </Tooltip>
            {onRefresh && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    aria-label="Aggiorna mittenti"
                    className="h-8 w-8"
                  >
                    {isRefreshing
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <RefreshCw className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Aggiorna mittenti</TooltipContent>
              </Tooltip>
            )}
            <Button variant="outline" size="sm" onClick={onCreateGroup} className="h-8">
              <Plus className="h-4 w-4 mr-1" />
              Nuovo gruppo
            </Button>
          </div>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-muted/10 flex-shrink-0 overflow-x-auto">
        {LETTER_RANGES.map((r) => (
          <button
            key={r.value}
            onClick={() => onLetterRangeChange(r.value)}
            className={cn(
              "px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors",
              letterRange === r.value
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <div className="p-3 grid gap-3 content-start grid-cols-1 auto-rows-min">
          {visibleGroups.map((group) => (
            <GroupDropZone
              key={group.id}
              group={group}
              onRefresh={loadData}
              isHovered={hoveredGroupId === group.id}
              isHighlighted={highlightedGroupName === group.nome_gruppo}
              rules={assignedByGroup.get(group.nome_gruppo) || []}
              onRulesChanged={reloadAssignedRules}
              selectedCount={selectedCount}
              onBulkAssign={onBulkAssign}
              onPartnerClick={onPartnerClick}
            />
          ))}
          {groups.length === 0 && (
            <p className="text-muted-foreground text-center w-full py-12">Nessun gruppo — creane uno</p>
          )}
          {groups.length > 0 && visibleGroups.length === 0 && (
            <p className="text-muted-foreground text-center w-full py-12 col-span-full">
              Nessun gruppo nel range selezionato
            </p>
          )}
        </div>
      </div>
    </div>
  );
}