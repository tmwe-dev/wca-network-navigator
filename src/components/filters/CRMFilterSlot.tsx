import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";
import { Search, Layers, ArrowUpDown, Users, Database, Sparkles, Wifi, Plane, Mail, Phone, MessageCircle } from "lucide-react";
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
  { value: "date_desc", label: "Più recenti" },
  { value: "interaction", label: "Ultimo contatto" },
];

const ORIGIN = [
  { value: "wca", label: "WCA" },
  { value: "import", label: "Import" },
  { value: "report_aziende", label: "RA" },
  { value: "bca", label: "BCA" },
];

const QUALITY = [
  { value: "all", label: "Tutti" },
  { value: "enriched", label: "Arricchiti" },
  { value: "not_enriched", label: "Non arricchiti" },
  { value: "with_alias", label: "Con alias" },
  { value: "no_alias", label: "Senza alias" },
];

const CHANNEL = [
  { value: "all", label: "Tutti" },
  { value: "with_email", label: "📧 Email" },
  { value: "with_phone", label: "📱 Tel" },
  { value: "with_linkedin", label: "🔗 LI" },
  { value: "with_whatsapp", label: "💬 WA" },
];

export function CRMFilterSlot() {
  const g = useGlobalFilters();

  const activeCount = [
    g.filters.leadStatus !== "all",
    g.filters.holdingPattern !== "out",
    g.filters.crmQuality !== "all",
    g.filters.crmChannel !== "all",
  ].filter(Boolean).length;

  const toggleOrigin = (o: string) => {
    const next = new Set(g.filters.crmOrigin);
    if (next.has(o)) { if (next.size > 1) next.delete(o); } else next.add(o);
    g.setCrmOrigin(next);
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <FilterSection icon={Search} label="Cerca">
        <Input
          value={g.filters.search}
          onChange={e => g.setSearch(e.target.value)}
          placeholder="Contatto, azienda..."
          className="h-7 text-xs bg-muted/30 border-border/40"
        />
      </FilterSection>

      {/* Active count */}
      {activeCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-primary font-medium">{activeCount} filtri attivi</span>
          <button onClick={() => {
            g.setLeadStatus("all");
            g.setHoldingPattern("out");
            g.setCrmQuality("all");
            g.setCrmChannel("all");
          }} className="text-[9px] text-muted-foreground hover:text-destructive">Reset</button>
        </div>
      )}

      {/* Group by */}
      <FilterSection icon={Layers} label="Raggruppa">
        <ChipGroup>
          {GROUPBY.map(o => (
            <Chip key={o.value} active={g.filters.groupBy === o.value} onClick={() => g.setGroupBy(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Sort */}
      <FilterSection icon={ArrowUpDown} label="Ordina">
        <ChipGroup>
          {SORT.map(o => (
            <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setSortBy(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Origin */}
      <FilterSection icon={Database} label="Origine">
        <ChipGroup>
          {ORIGIN.map(o => (
            <Chip key={o.value} active={g.filters.crmOrigin.has(o.value)} onClick={() => toggleOrigin(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Lead status */}
      <FilterSection icon={Users} label="Stato lead">
        <ChipGroup>
          {LEAD_STATUS.map(o => (
            <Chip key={o.value} active={g.filters.leadStatus === o.value} onClick={() => g.setLeadStatus(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Holding */}
      <FilterSection icon={Plane} label="Circuito">
        <ChipGroup>
          {HOLDING.map(o => (
            <Chip key={o.value} active={g.filters.holdingPattern === o.value} onClick={() => g.setHoldingPattern(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Channel */}
      <FilterSection icon={Wifi} label="Canale">
        <ChipGroup>
          {CHANNEL.map(o => (
            <Chip key={o.value} active={g.filters.crmChannel === o.value} onClick={() => g.setCrmChannel(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>

      {/* Quality */}
      <FilterSection icon={Sparkles} label="Qualità dati">
        <ChipGroup>
          {QUALITY.map(o => (
            <Chip key={o.value} active={g.filters.crmQuality === o.value} onClick={() => g.setCrmQuality(o.value)}>{o.label}</Chip>
          ))}
        </ChipGroup>
      </FilterSection>
    </div>
  );
}

/* ── Shared sub-components ── */

function FilterSection({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
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
