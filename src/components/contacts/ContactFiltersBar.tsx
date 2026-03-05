import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FolderOpen } from "lucide-react";
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

export function ContactFiltersBar({ filters, onChange, countries, origins, importGroups }: Props) {
  return (
    <div className="flex flex-col gap-1.5 p-2 border-b border-border bg-card/50">
      {/* Row 1: Group selector */}
      {importGroups && importGroups.length > 0 && (
        <div className="flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Select
            value={filters.importLogId ?? "all"}
            onValueChange={(v) => onChange({ importLogId: v === "all" ? undefined : v })}
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
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
        </div>
      )}

      {/* Row 2: Search + filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[140px] max-w-[220px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={filters.search ?? ""}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Cerca…"
            className="h-7 pl-7 text-xs"
          />
        </div>

        <Select value={filters.country ?? "all"} onValueChange={(v) => onChange({ country: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue placeholder="Paese" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {countries.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.origin ?? "all"} onValueChange={(v) => onChange({ origin: v === "all" ? undefined : v })}>
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue placeholder="Origine" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            {origins.map((o) => (
              <SelectItem key={o} value={o}>{o}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.leadStatus ?? "all"}
          onValueChange={(v) => onChange({ leadStatus: v === "all" ? undefined : v as LeadStatus })}
        >
          <SelectTrigger className="h-7 w-[120px] text-xs">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.groupBy ?? "country"}
          onValueChange={(v) => onChange({ groupBy: v as ContactFilters["groupBy"] })}
        >
          <SelectTrigger className="h-7 w-[110px] text-xs">
            <SelectValue placeholder="Raggruppa" />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((g) => (
              <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) => onChange({ dateFrom: e.target.value || undefined })}
          className="h-7 w-[120px] text-xs"
          placeholder="Da"
        />
        <Input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) => onChange({ dateTo: e.target.value || undefined })}
          className="h-7 w-[120px] text-xs"
          placeholder="A"
        />
      </div>
    </div>
  );
}
