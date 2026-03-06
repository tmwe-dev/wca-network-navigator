import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Search, FolderOpen, Globe, MapPin, Tag, Calendar, Plane, PlaneLanding, List } from "lucide-react";
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
  { value: "date", icon: Calendar, label: "Data" },
] as const;

interface Props {
  filters: ContactFilters;
  onChange: (f: Partial<ContactFilters>) => void;
  countries: string[];
  origins: string[];
  importGroups?: ImportGroup[];
  groupCounts?: ContactGroupCount[];
  totalContacts?: number;
  selectedCount?: number;
  sortKey?: string;
  onAICommand?: (cmd: AICommand) => void;
}

function FilterBlock({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1 min-w-0">
      <label className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <Icon className="w-3 h-3 shrink-0" />
        {label}
      </label>
      {children}
    </div>
  );
}

export function ContactFiltersBar({ filters, onChange, countries, origins, importGroups, groupCounts, totalContacts, selectedCount, sortKey, onAICommand }: Props) {
  const currentGroupBy = filters.groupBy || "country";

  // Build count maps from groupCounts
  const countryCounts: Record<string, number> = {};
  const originCounts: Record<string, number> = {};
  const statusCounts: Record<string, number> = {};

  (groupCounts ?? []).forEach((g) => {
    if (g.group_type === "country") countryCounts[g.group_key] = g.contact_count;
    else if (g.group_type === "origin") originCounts[g.group_key] = g.contact_count;
    else if (g.group_type === "status") statusCounts[g.group_key] = g.contact_count;
  });

  return (
    <div className="flex flex-col gap-2 p-3 border-b border-border bg-card/50 shrink-0 max-h-[40vh] overflow-y-auto">
      {/* Row 0: AI Bar */}
      {onAICommand && (
        <ContactAIBar
          filters={filters}
          totalContacts={totalContacts ?? 0}
          selectedCount={selectedCount ?? 0}
          sortKey={sortKey ?? "company"}
          onAICommand={onAICommand}
        />
      )}
      {/* Row 1: Import group */}
      {importGroups && importGroups.length > 0 && (
        <FilterBlock icon={FolderOpen} label="Gruppo di carico">
          <Select
            value={filters.importLogId ?? "all"}
            onValueChange={(v) => onChange({ importLogId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tutti i gruppi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i gruppi</SelectItem>
              {importGroups.map((g) => (
                <SelectItem key={g.id} value={g.id}>
                  {g.group_name} ({g.imported_rows})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBlock>
      )}

      {/* Row 2: Search */}
      <FilterBlock icon={Search} label="Cerca">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={filters.search ?? ""}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Azienda, nome, email…"
            className="h-8 pl-8 text-xs"
          />
        </div>
      </FilterBlock>

      {/* Row 3: Grouping icons + Holding pattern filter */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Raggruppa:</span>
        {GROUP_MODES.map(({ value, icon: Icon, label }) => (
          <Button
            key={value}
            variant={currentGroupBy === value ? "default" : "ghost"}
            size="sm"
            className={cn(
              "h-7 w-7 p-0",
              currentGroupBy === value && "shadow-sm"
            )}
            title={label}
            onClick={() => onChange({ groupBy: value as ContactFilters["groupBy"] })}
          >
            <Icon className="w-3.5 h-3.5" />
          </Button>
        ))}

        <Separator orientation="vertical" className="h-5 mx-1.5" />

        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mr-1">Circuito:</span>
        {([
          { value: "all" as const, icon: List, label: "Tutti" },
          { value: "in" as const, icon: Plane, label: "In attesa" },
          { value: "out" as const, icon: PlaneLanding, label: "Da lavorare" },
        ]).map(({ value, icon: Icon, label }) => {
          const active = (filters.holdingPattern ?? "all") === value;
          return (
            <Button
              key={value}
              variant={active ? "default" : "ghost"}
              size="sm"
              className={cn("h-7 px-1.5 gap-1 text-[10px]", active && "shadow-sm")}
              title={label}
              onClick={() => onChange({ holdingPattern: value })}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Button>
          );
        })}
      </div>

      {/* Row 4: Filters grid */}
      <div className="grid grid-cols-3 gap-2">
        <FilterBlock icon={Globe} label="Paese">
          <Select value={filters.country ?? "all"} onValueChange={(v) => onChange({ country: v === "all" ? undefined : v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}{countryCounts[c] ? ` (${countryCounts[c]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBlock>

        <FilterBlock icon={MapPin} label="Origine">
          <Select value={filters.origin ?? "all"} onValueChange={(v) => onChange({ origin: v === "all" ? undefined : v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tutte" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte</SelectItem>
              {origins.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}{originCounts[o] ? ` (${originCounts[o]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBlock>

        <FilterBlock icon={Tag} label="Status">
          <Select
            value={filters.leadStatus ?? "all"}
            onValueChange={(v) => onChange({ leadStatus: v === "all" ? undefined : v as LeadStatus })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}{s.value !== "all" && statusCounts[s.value] ? ` (${statusCounts[s.value]})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBlock>
      </div>

      {/* Row 5: Date range */}
      <FilterBlock icon={Calendar} label="Periodo">
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={filters.dateFrom ?? ""}
            onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
            className="h-8 flex-1 text-xs"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={filters.dateTo ?? ""}
            onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
            className="h-8 flex-1 text-xs"
          />
        </div>
      </FilterBlock>
    </div>
  );
}
