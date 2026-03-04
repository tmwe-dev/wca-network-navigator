import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import type { ContactFilters, LeadStatus } from "@/hooks/useContacts";

const STATUSES: { value: LeadStatus | ""; label: string }[] = [
  { value: "", label: "Tutti" },
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
}

export function ContactFiltersBar({ filters, onChange, countries, origins }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2 border-b border-border bg-card/50">
      {/* Search */}
      <div className="relative flex-1 min-w-[140px] max-w-[220px]">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Cerca…"
          className="h-7 pl-7 text-xs"
        />
      </div>

      {/* Country */}
      <Select value={filters.country ?? ""} onValueChange={(v) => onChange({ country: v || undefined })}>
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <SelectValue placeholder="Paese" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Tutti</SelectItem>
          {countries.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Origin */}
      <Select value={filters.origin ?? ""} onValueChange={(v) => onChange({ origin: v || undefined })}>
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <SelectValue placeholder="Origine" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">Tutte</SelectItem>
          {origins.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Status */}
      <Select
        value={filters.leadStatus ?? ""}
        onValueChange={(v) => onChange({ leadStatus: (v || undefined) as LeadStatus | undefined })}
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

      {/* Group by */}
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

      {/* Date range */}
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
  );
}
