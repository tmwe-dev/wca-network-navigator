import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FolderOpen, Globe, MapPin, Tag, LayoutGrid, Calendar } from "lucide-react";
import type { ContactFilters, LeadStatus } from "@/hooks/useContacts";
import type { ImportGroup } from "@/hooks/useImportGroups";

const STATUSES: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "in_progress", label: "In corso" },
  { value: "negotiation", label: "Trattativa" },
  { value: "converted", label: "Cliente" },
  { value: "lost", label: "Perso" },
];

const GROUP_OPTIONS = [
  { value: "country", label: "Paese" },
  { value: "origin", label: "Origine" },
  { value: "status", label: "Status" },
  { value: "date", label: "Data" },
];

interface Props {
  filters: ContactFilters;
  onChange: (f: Partial<ContactFilters>) => void;
  countries: string[];
  origins: string[];
  importGroups?: ImportGroup[];
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

export function ContactFiltersBar({ filters, onChange, countries, origins, importGroups }: Props) {
  return (
    <div className="flex flex-col gap-2 p-3 border-b border-border bg-card/50 shrink-0 max-h-[40vh] overflow-y-auto">
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

      {/* Row 3: Filters grid */}
      <div className="grid grid-cols-4 gap-2">
        <FilterBlock icon={Globe} label="Paese">
          <Select value={filters.country ?? "all"} onValueChange={(v) => onChange({ country: v === "all" ? undefined : v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
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
                <SelectItem key={o} value={o}>{o}</SelectItem>
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
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBlock>

        <FilterBlock icon={LayoutGrid} label="Raggruppa per">
          <Select
            value={filters.groupBy ?? "country"}
            onValueChange={(v) => onChange({ groupBy: v as ContactFilters["groupBy"] })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Paese" />
            </SelectTrigger>
            <SelectContent>
              {GROUP_OPTIONS.map((g) => (
                <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterBlock>
      </div>

      {/* Row 4: Date range */}
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
