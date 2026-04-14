import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { Search, ArrowUpDown, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";

const SORT = [
  { value: "name", label: "Nome" },
  { value: "country", label: "Paese" },
  { value: "contacts", label: "N° contatti" },
  { value: "date_desc", label: "Più recenti" },
];

const QUALITY = [
  { value: "all", label: "Tutti" },
  { value: "with_email", label: "📧 Con email" },
  { value: "with_phone", label: "📱 Con tel" },
  { value: "with_profile", label: "🔗 Con profilo" },
  { value: "no_email", label: "❌ Senza email" },
  { value: "no_contacts", label: "👤 Senza contatti" },
];

export function NetworkFilterSlot() {
  const g = useGlobalFilters();

  const activeCount = [
    g.filters.networkQuality !== "all",
    g.filters.networkSort !== "name",
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Search */}
      <FilterSection icon={Search} label="Cerca">
        <Input
          value={g.filters.networkSearch}
          onChange={e => g.setNetworkSearch(e.target.value)}
          placeholder="Partner, azienda..."
          className="h-7 text-xs bg-muted/30 border-border/40"
        />
      </FilterSection>

      {activeCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-primary font-medium">{activeCount} filtri attivi</span>
          <button onClick={() => {
            g.setNetworkQuality("all");
            g.setNetworkSort("name");
          }} className="text-[9px] text-muted-foreground hover:text-destructive">Reset</button>
        </div>
      )}

      {/* Sort */}
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {SORT.map(o => (
            <Chip key={o.value} active={g.filters.networkSort === o.value} onClick={() => g.setNetworkSort(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Quality */}
      <FilterSection icon={Sparkles} label="Qualità dati">
        <ChipGroup>
          {QUALITY.map(o => (
            <Chip key={o.value} active={g.filters.networkQuality === o.value} onClick={() => g.setNetworkQuality(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>
    </div>
  );
}

function FilterSection({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </label>
      {children}
    </div>
  );
}

function ChipGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1">{children}</div>;
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
