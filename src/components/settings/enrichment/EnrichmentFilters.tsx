import { Search, Building2, Mail, Filter, CheckCircle2, ImageOff, Linkedin, XCircle, Globe, LinkIcon, Users, LayoutDashboard, SortAsc, SortDesc } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type SourceFilter = "all" | "wca" | "contacts" | "email" | "cockpit";
export type EnrichFilter = "all" | "with-logo" | "no-logo" | "with-linkedin" | "no-linkedin" | "with-domain" | "no-domain";
export type SortField = "name" | "domain" | "source";
export type SortDir = "asc" | "desc";

const SOURCE_OPTIONS: { value: SourceFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Tutte le fonti", icon: <Users className="w-3.5 h-3.5" /> },
  { value: "wca", label: "WCA Partner", icon: <Building2 className="w-3.5 h-3.5" /> },
  { value: "contacts", label: "Contatti", icon: <Search className="w-3.5 h-3.5" /> },
  { value: "email", label: "Mittenti Email", icon: <Mail className="w-3.5 h-3.5" /> },
  { value: "cockpit", label: "Cockpit", icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
];

const ENRICH_OPTIONS: { value: EnrichFilter; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Tutti", icon: <Filter className="w-3.5 h-3.5" /> },
  { value: "with-logo", label: "Con logo", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  { value: "no-logo", label: "Senza logo", icon: <ImageOff className="w-3.5 h-3.5" /> },
  { value: "with-linkedin", label: "Con LinkedIn", icon: <Linkedin className="w-3.5 h-3.5" /> },
  { value: "no-linkedin", label: "Senza LinkedIn", icon: <XCircle className="w-3.5 h-3.5" /> },
  { value: "with-domain", label: "Con dominio", icon: <Globe className="w-3.5 h-3.5" /> },
  { value: "no-domain", label: "Senza dominio", icon: <LinkIcon className="w-3.5 h-3.5" /> },
];

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  source: SourceFilter;
  onSourceChange: (v: SourceFilter) => void;
  enrichFilter: EnrichFilter;
  onEnrichFilterChange: (v: EnrichFilter) => void;
  sortField: SortField;
  sortDir: SortDir;
  onToggleSort: (field: SortField) => void;
}

export function EnrichmentFilters({
  search, onSearchChange,
  source, onSourceChange,
  enrichFilter, onEnrichFilterChange,
  sortField, sortDir, onToggleSort,
}: Props) {
  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
        <Input
          placeholder="Cerca..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          className="pl-7 h-7 text-[11px] bg-muted/30 border-border/40"
        />
      </div>

      {/* Source */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Fonte</div>
        <div className="space-y-0.5">
          {SOURCE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onSourceChange(opt.value)}
              className={cn(
                "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-colors",
                source === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Status */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Stato Dati</div>
        <div className="space-y-0.5">
          {ENRICH_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onEnrichFilterChange(opt.value)}
              className={cn(
                "w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] transition-colors",
                enrichFilter === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 px-1">Ordina per</div>
        <div className="space-y-0.5">
          {([
            { field: "name" as SortField, label: "Nome" },
            { field: "domain" as SortField, label: "Dominio" },
            { field: "source" as SortField, label: "Fonte" },
          ]).map(opt => (
            <button
              key={opt.field}
              onClick={() => onToggleSort(opt.field)}
              className={cn(
                "w-full flex items-center justify-between px-2 py-1.5 rounded-md text-[11px] transition-colors",
                sortField === opt.field
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {opt.label}
              {sortField === opt.field && (
                sortDir === "asc" ? <SortAsc className="w-3 h-3" /> : <SortDesc className="w-3 h-3" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
