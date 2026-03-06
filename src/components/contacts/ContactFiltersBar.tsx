import { useState } from "react";
import { format, parse } from "date-fns";
import { it } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Search, FolderOpen, Globe, MapPin, Tag, CalendarIcon, Plane, PlaneLanding, List,
  ArrowUpAZ, X
} from "lucide-react";
import type { ContactFilters, LeadStatus } from "@/hooks/useContacts";
import type { ImportGroup } from "@/hooks/useImportGroups";
import type { ContactGroupCount } from "@/hooks/useContactGroups";
import { cn } from "@/lib/utils";
import { ContactAIBar, type AICommand } from "./ContactAIBar";

const STATUSES: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "in_progress", label: "In corso" },
  { value: "negotiation", label: "Trattativa" },
  { value: "converted", label: "Cliente" },
  { value: "lost", label: "Perso" },
];

const GROUP_MODES = [
  { value: "country", icon: Globe, label: "Paese" },
  { value: "origin", icon: MapPin, label: "Origine" },
  { value: "status", icon: Tag, label: "Status" },
  { value: "date", icon: CalendarIcon, label: "Data" },
] as const;

const SORT_OPTIONS = [
  { value: "company", label: "Azienda A→Z" },
  { value: "name", label: "Nome A→Z" },
  { value: "city", label: "Città A→Z" },
  { value: "date", label: "Data ↓" },
];

interface Props {
  filters: ContactFilters;
  onChange: (f: Partial<ContactFilters>) => void;
  countries: string[];
  origins: string[];
  importGroups?: ImportGroup[];
  groupCounts?: ContactGroupCount[];
  totalContacts?: number;
  selectedCount?: number;
  sortKey: string;
  onSortChange: (key: string) => void;
  onAICommand?: (cmd: AICommand) => void;
}

function DatePickerButton({ value, onChange, placeholder }: {
  value?: string;
  onChange: (v: string | undefined) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value + "T00:00:00") : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-7 flex-1 justify-start text-left text-[10px] font-normal px-2 gap-1.5 min-w-0",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="w-3 h-3 shrink-0" />
          {date ? format(date, "dd/MM/yyyy") : <span className="truncate">{placeholder}</span>}
          {date && (
            <X
              className="w-3 h-3 ml-auto shrink-0 hover:text-destructive"
              onClick={(e) => { e.stopPropagation(); onChange(undefined); }}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => {
            onChange(d ? format(d, "yyyy-MM-dd") : undefined);
            setOpen(false);
          }}
          initialFocus
          locale={it}
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

export function ContactFiltersBar({
  filters, onChange, countries, origins, importGroups, groupCounts,
  totalContacts, selectedCount, sortKey, onSortChange, onAICommand
}: Props) {
  const currentGroupBy = filters.groupBy || "country";

  const countryCounts: Record<string, number> = {};
  const originCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  (groupCounts ?? []).forEach((g) => {
    if (g.group_type === "country") countryCounts[g.group_key] = g.contact_count;
    else if (g.group_type === "origin") originCounts[g.group_key] = g.contact_count;
    else if (g.group_type === "status") statusCounts[g.group_key] = g.contact_count;
  });

  const hasActiveFilters = !!(filters.country || filters.origin || filters.leadStatus || filters.dateFrom || filters.dateTo || filters.importLogId || filters.search);

  const activeGroup = importGroups?.find((g) => g.id === filters.importLogId);
  const [basketOpen, setBasketOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 p-2 border-b border-border bg-card/50 shrink-0">
      {/* Row 0: Active basket header */}
      {importGroups && importGroups.length > 0 && (
        <Popover open={basketOpen} onOpenChange={setBasketOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between h-8 px-3 text-xs gap-2 border-primary/20 bg-primary/5 hover:bg-primary/10"
            >
              <span className="flex items-center gap-2 min-w-0">
                <FolderOpen className="w-3.5 h-3.5 shrink-0 text-primary" />
                {activeGroup ? (
                  <>
                    <span className="font-semibold truncate">{activeGroup.group_name}</span>
                    <span className="text-muted-foreground shrink-0">({activeGroup.imported_rows})</span>
                  </>
                ) : (
                  <>
                    <span className="font-medium truncate">Tutti i cestini</span>
                    <span className="text-muted-foreground shrink-0">({totalContacts ?? 0})</span>
                  </>
                )}
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">▾ Cambia</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1 max-h-64 overflow-y-auto" align="start">
            <button
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent text-left",
                !filters.importLogId && "bg-accent font-semibold"
              )}
              onClick={() => { onChange({ importLogId: undefined }); setBasketOpen(false); }}
            >
              <FolderOpen className="w-3 h-3 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">Tutti i cestini</span>
              <span className="text-muted-foreground">{totalContacts ?? 0}</span>
            </button>
            <Separator className="my-1" />
            {importGroups.map((g) => (
              <button
                key={g.id}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-accent text-left",
                  filters.importLogId === g.id && "bg-accent font-semibold"
                )}
                onClick={() => { onChange({ importLogId: g.id }); setBasketOpen(false); }}
              >
                <FolderOpen className="w-3 h-3 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{g.group_name}</span>
                <span className="text-muted-foreground">{g.imported_rows}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      )}

      {/* AI Bar */}
      {onAICommand && (
        <ContactAIBar
          filters={filters}
          totalContacts={totalContacts ?? 0}
          selectedCount={selectedCount ?? 0}
          sortKey={sortKey}
          onAICommand={onAICommand}
        />
      )}

      {/* Row 1: Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Cerca azienda, nome, email…"
          className="h-7 pl-8 text-xs"
        />
      </div>

      {/* Row 2: Group + Holding Pattern */}
      <div className="flex items-center gap-1 flex-wrap">
        {GROUP_MODES.map(({ value, icon: Icon, label }) => (
          <Button
            key={value}
            variant={currentGroupBy === value ? "default" : "ghost"}
            size="sm"
            className={cn("h-6 w-6 p-0", currentGroupBy === value && "shadow-sm")}
            title={label}
            onClick={() => onChange({ groupBy: value as ContactFilters["groupBy"] })}
          >
            <Icon className="w-3 h-3" />
          </Button>
        ))}

        <Separator orientation="vertical" className="h-4 mx-1" />

        {([
          { value: "all" as const, icon: List, label: "Tutti" },
          { value: "in" as const, icon: Plane, label: "In circuito" },
          { value: "out" as const, icon: PlaneLanding, label: "Da lavorare" },
        ]).map(({ value, icon: Icon, label }) => {
          const active = (filters.holdingPattern ?? "all") === value;
          return (
            <Button
              key={value}
              variant={active ? "default" : "ghost"}
              size="sm"
              className={cn("h-6 px-1.5 gap-1 text-[10px]", active && "shadow-sm")}
              onClick={() => onChange({ holdingPattern: value })}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          );
        })}

        {hasActiveFilters && (
          <>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 gap-1 text-[10px] text-destructive hover:text-destructive"
              onClick={() => onChange({
                country: undefined, origin: undefined, leadStatus: undefined,
                dateFrom: undefined, dateTo: undefined, importLogId: undefined, search: ""
              })}
            >
              <X className="w-3 h-3" /> Reset
            </Button>
          </>
        )}
      </div>

      {/* Row 3: Inline filters grid (3 cols — basket removed) */}
      <div className="grid grid-cols-3 gap-1.5">
        <Select value={filters.country ?? "all"} onValueChange={(v) => onChange({ country: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-7 text-[10px]">
            <Globe className="w-3 h-3 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Paese" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i paesi</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>
                {c}{countryCounts[c] ? ` (${countryCounts[c]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.origin ?? "all"} onValueChange={(v) => onChange({ origin: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-7 text-[10px]">
            <MapPin className="w-3 h-3 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Origine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte le origini</SelectItem>
            {origins.map((o) => (
              <SelectItem key={o} value={o}>
                {o}{originCounts[o] ? ` (${originCounts[o]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.leadStatus ?? "all"}
          onValueChange={(v) => onChange({ leadStatus: v === "all" ? undefined : v as LeadStatus })}
        >
          <SelectTrigger className="h-7 text-[10px]">
            <Tag className="w-3 h-3 shrink-0 text-muted-foreground" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}{s.value !== "all" && statusCounts[s.value] ? ` (${statusCounts[s.value]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Row 4: Date pickers + Sort */}
      <div className="flex items-center gap-1.5">
        <DatePickerButton
          value={filters.dateFrom}
          onChange={(v) => onChange({ dateFrom: v })}
          placeholder="Dal"
        />
        <span className="text-[10px] text-muted-foreground shrink-0">→</span>
        <DatePickerButton
          value={filters.dateTo}
          onChange={(v) => onChange({ dateTo: v })}
          placeholder="Al"
        />

        <Separator orientation="vertical" className="h-4 mx-0.5" />

        <Select value={sortKey} onValueChange={onSortChange}>
          <SelectTrigger className="h-7 text-[10px] w-auto min-w-[110px]">
            <ArrowUpAZ className="w-3 h-3 shrink-0 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
