import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { Search, Layers, ArrowUpDown, Users, Database } from "lucide-react";
import { Input } from "@/components/ui/input";

const GROUPBY = [
  { value: "country", label: "Paese" },
  { value: "origin", label: "Origine" },
  { value: "lead_status", label: "Stato" },
  { value: "import_group", label: "Gruppo" },
];

const HOLDING = [
  { value: "out", label: "Fuori" },
  { value: "in", label: "In" },
  { value: "all", label: "Tutti" },
];

const LEAD_STATUS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "qualified", label: "Qualificato" },
  { value: "converted", label: "Convertito" },
];

const SORT = [
  { value: "name", label: "Nome" },
  { value: "country", label: "Paese" },
  { value: "company", label: "Azienda" },
];

export function CRMFilterSlot() {
  const g = useGlobalFilters();

  return (
    <div className="space-y-3">
      {/* Search */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <Search className="w-3 h-3" /> Cerca
        </label>
        <Input
          value={g.filters.search}
          onChange={e => g.setSearch(e.target.value)}
          placeholder="Contatto..."
          className="h-7 text-xs bg-muted/30 border-border/40"
        />
      </div>

      {/* Group by */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <Layers className="w-3 h-3" /> Raggruppa
        </label>
        <div className="flex flex-wrap gap-1">
          {GROUPBY.map(o => (
            <Chip key={o.value} active={g.filters.groupBy === o.value} onClick={() => g.setGroupBy(o.value)}>{o.label}</Chip>
          ))}
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <ArrowUpDown className="w-3 h-3" /> Ordina
        </label>
        <div className="flex flex-wrap gap-1">
          {SORT.map(o => (
            <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
          ))}
        </div>
      </div>

      {/* Lead status */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <Users className="w-3 h-3" /> Stato lead
        </label>
        <div className="flex flex-wrap gap-1">
          {LEAD_STATUS.map(o => (
            <Chip key={o.value} active={g.filters.leadStatus === o.value} onClick={() => g.setLeadStatus(o.value)}>{o.label}</Chip>
          ))}
        </div>
      </div>

      {/* Holding */}
      <div>
        <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
          <Database className="w-3 h-3" /> Circuito
        </label>
        <div className="flex flex-wrap gap-1">
          {HOLDING.map(o => (
            <Chip key={o.value} active={g.filters.holdingPattern === o.value} onClick={() => g.setHoldingPattern(o.value)}>{o.label}</Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2 py-1 rounded-md text-[10px] font-medium transition-all border",
        active
          ? "bg-primary/15 border-primary/30 text-primary"
          : "border-border/40 text-muted-foreground hover:bg-muted/40"
      )}
    >
      {children}
    </button>
  );
}
