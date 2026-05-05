/**
 * FunnemailListToolbar — mini-toolbar Ordina / Raggruppa per la lista mail.
 *
 * Logic-less. La selezione è gestita dal parent e persistita in localStorage.
 */
import { ArrowDownAZ, ArrowDownWideNarrow, CheckSquare, Square, FolderTree } from "lucide-react";
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
}: Props) {
  const allSelected = totalCount > 0 && checkedCount >= totalCount;
  return (
    <div className="flex flex-nowrap items-center gap-3 border-b border-border px-2 py-1.5 text-[10px] overflow-x-auto">
      {(onSelectAll || onClearSelection) && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 gap-1 px-1.5 text-[10px] shrink-0"
          onClick={() => (allSelected ? onClearSelection?.() : onSelectAll?.())}
          title={allSelected ? "Deseleziona tutte" : "Seleziona tutte"}
        >
          {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
          <span>{checkedCount > 0 ? `${checkedCount}/${totalCount}` : "Seleziona"}</span>
        </Button>
      )}
      <div className="flex items-center gap-1 shrink-0">
        <ArrowDownWideNarrow className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground font-medium">Ordina:</span>
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
          <SelectTrigger className="h-6 w-[140px] text-[10px]">
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
              <SelectItem key={k} value={k} className="text-[11px]">{SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <FolderTree className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground font-medium">Raggruppa:</span>
        <Select value={group} onValueChange={(v) => onGroupChange(v as GroupMode)}>
          <SelectTrigger className="h-6 w-[130px] text-[10px]">
            <SelectValue>{GROUP_LABELS[group]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(GROUP_LABELS) as GroupMode[]).map((k) => (
              <SelectItem key={k} value={k} className="text-[11px]">{GROUP_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground tabular-nums">
        <strong className="text-foreground">{totalCount}</strong> mail
      </span>
    </div>
  );
}
