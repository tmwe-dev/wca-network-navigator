import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Sparkles, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPartnerType } from "@/lib/countries";

type SortField = "name" | "city" | "contacts";

interface CompanyListFiltersProps {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  typeFilter: string;
  onTypeFilterChange: (v: string) => void;
  partnerTypes: string[];
  aiQuery: string;
  onAiQueryChange: (v: string) => void;
  sortField: SortField;
  sortAsc: boolean;
  onSortToggle: (field: SortField) => void;
  isBcaSource: boolean;
}

export function CompanyListFilters({
  searchQuery, onSearchChange, typeFilter, onTypeFilterChange,
  partnerTypes, aiQuery, onAiQueryChange, sortField, sortAsc,
  onSortToggle, isBcaSource,
}: CompanyListFiltersProps) {
  return (
    <>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Cerca per nome, città, email..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 space-input"
        />
      </div>

      <div className="flex items-center gap-1">
        <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground mr-1" />
        {(["name", "city", "contacts"] as SortField[]).map(field => (
          <button
            key={field}
            onClick={() => onSortToggle(field)}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] transition-colors",
              sortField === field
                ? "bg-primary/20 text-primary"
                : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
            )}
          >
            {field === "name" ? "Nome" : field === "city" ? "Città" : "Contatti"}
            {sortField === field && (sortAsc ? " ↑" : " ↓")}
          </button>
        ))}
      </div>

      {!isBcaSource && (
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={onTypeFilterChange}>
            <SelectTrigger className="w-[180px]">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti i tipi</SelectItem>
              {partnerTypes.map(type => (
                <SelectItem key={type} value={type}>{formatPartnerType(type)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {!isBcaSource && (
        <div className="relative">
          <Sparkles className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400" />
          <Input
            placeholder="Filtra con AI: 'solo IATA certified', 'con servizio pharma'..."
            value={aiQuery}
            onChange={(e) => onAiQueryChange(e.target.value)}
            className="pl-9 bg-card border-emerald-500/40 text-foreground placeholder:text-emerald-400/40 focus-visible:ring-emerald-500/50"
          />
        </div>
      )}
    </>
  );
}
