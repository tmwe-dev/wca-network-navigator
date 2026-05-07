/**
 * FunnemailListToolbar — mini-toolbar Ordina / Raggruppa per la lista mail.
 *
 * Logic-less. La selezione è gestita dal parent e persistita in localStorage.
 */
import { ArrowDownWideNarrow, CheckSquare, Square, FolderTree, RefreshCw, EyeOff, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type SortMode = "date_desc" | "company_asc" | "sender_asc" | "subject_asc";
export type GroupMode = "none" | "company" | "sender";

interface Props {
  sort: SortMode;
  group: GroupMode;
  onSortChange: (s: SortMode) => void;
  onGroupChange: (g: GroupMode) => void;
  totalCount?: number;
  checkedCount?: number;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  hideRead?: boolean;
  onToggleHideRead?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
}

const SORT_LABELS: Record<SortMode, string> = {
  date_desc: "Più recenti",
  company_asc: "Azienda (A→Z)",
  sender_asc: "Mittente (A→Z)",
  subject_asc: "Oggetto (A→Z)",
};

const GROUP_LABELS: Record<GroupMode, string> = {
  none: "Nessun gruppo",
  company: "Per azienda",
  sender: "Per mittente",
};

export function FunnemailListToolbar({
  sort, group, onSortChange, onGroupChange,
  totalCount = 0, checkedCount = 0, onSelectAll, onClearSelection,
  hideRead, onToggleHideRead, onRefresh, refreshing,
}: Props) {
  const allSelected = totalCount > 0 && checkedCount >= totalCount;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-3 py-2 text-sm sm:flex-nowrap sm:overflow-x-auto">
      {onRefresh && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2 text-xs shrink-0"
          onClick={onRefresh}
          disabled={refreshing}
          title="Aggiorna lista"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      )}
      {onToggleHideRead && (
        <Button
          type="button"
          size="sm"
          variant={hideRead ? "default" : "ghost"}
          className="h-8 gap-1.5 px-2 text-xs shrink-0"
          onClick={onToggleHideRead}
          title={hideRead ? "Mostra anche le lette" : "Nascondi le lette"}
        >
          {hideRead ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span>{hideRead ? "Solo non lette" : "Tutte"}</span>
        </Button>
      )}
      {(onSelectAll || onClearSelection) && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 px-2 text-xs shrink-0"
          onClick={() => (allSelected ? onClearSelection?.() : onSelectAll?.())}
          title={allSelected ? "Deseleziona tutte" : "Seleziona tutte"}
        >
          {allSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
          <span>{checkedCount > 0 ? `${checkedCount}/${totalCount}` : "Seleziona"}</span>
        </Button>
      )}
      <div className="flex items-center gap-1.5 shrink-0">
        <ArrowDownWideNarrow className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Ordina:</span>
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
              <SelectItem key={k} value={k} className="text-sm">{SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <FolderTree className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Raggruppa:</span>
        <Select value={group} onValueChange={(v) => onGroupChange(v as GroupMode)}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <SelectValue>{GROUP_LABELS[group]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(GROUP_LABELS) as GroupMode[]).map((k) => (
              <SelectItem key={k} value={k} className="text-sm">{GROUP_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="ml-0 shrink-0 text-xs text-muted-foreground tabular-nums sm:ml-auto">
        <strong className="text-foreground">{totalCount}</strong> mail
      </span>
    </div>
  );
}
