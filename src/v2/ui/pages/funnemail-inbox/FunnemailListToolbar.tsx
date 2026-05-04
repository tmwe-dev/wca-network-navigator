/**
 * FunnemailListToolbar — mini-toolbar Ordina / Raggruppa per la lista mail.
 *
 * Logic-less. La selezione è gestita dal parent e persistita in localStorage.
 */
import { ArrowDownAZ, ArrowDownWideNarrow } from "lucide-react";
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
}

const SORT_LABELS: Record<SortMode, string> = {
  date_desc: "Data ↓",
  company_asc: "Azienda A→Z",
  sender_asc: "Mittente A→Z",
  subject_asc: "Oggetto A→Z",
};

const GROUP_LABELS: Record<GroupMode, string> = {
  none: "Nessuno",
  company: "Azienda",
  sender: "Mittente",
};

export function FunnemailListToolbar({ sort, group, onSortChange, onGroupChange }: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-border px-3 py-1.5 text-[10px]">
      <div className="flex items-center gap-1">
        <ArrowDownWideNarrow className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">Ordina</span>
        <Select value={sort} onValueChange={(v) => onSortChange(v as SortMode)}>
          <SelectTrigger className="h-6 w-[120px] text-[10px]">
            <SelectValue>{SORT_LABELS[sort]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
              <SelectItem key={k} value={k} className="text-[11px]">{SORT_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <ArrowDownAZ className="h-3 w-3 text-muted-foreground" />
        <span className="text-muted-foreground">Raggruppa</span>
        <Select value={group} onValueChange={(v) => onGroupChange(v as GroupMode)}>
          <SelectTrigger className="h-6 w-[110px] text-[10px]">
            <SelectValue>{GROUP_LABELS[group]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(GROUP_LABELS) as GroupMode[]).map((k) => (
              <SelectItem key={k} value={k} className="text-[11px]">{GROUP_LABELS[k]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
