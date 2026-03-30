import { useState, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, Search, RotateCcw, Check } from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { cn } from "@/lib/utils";

interface FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SORT_OPTIONS = [
  { value: "name", label: "Nome A-Z" },
  { value: "country", label: "Paese" },
  { value: "priority", label: "Priorità" },
  { value: "company", label: "Azienda" },
];

const ORIGIN_OPTIONS = [
  { value: "wca", label: "WCA", color: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
  { value: "import", label: "Import", color: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" },
  { value: "report_aziende", label: "Report Aziende", color: "bg-amber-500/15 border-amber-500/30 text-amber-400" },
];

const QUALITY_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "no_profile", label: "No Profilo" },
  { value: "no_email", label: "No Email" },
  { value: "no_phone", label: "No Telefono" },
  { value: "no_deep_search", label: "No Deep Search" },
];

const GROUPBY_OPTIONS = [
  { value: "country", label: "Paese" },
  { value: "origin", label: "Origine" },
  { value: "lead_status", label: "Stato" },
  { value: "import_group", label: "Gruppo Import" },
];

const HOLDING_OPTIONS = [
  { value: "out", label: "Fuori circuito" },
  { value: "in", label: "In circuito" },
  { value: "all", label: "Tutti" },
];

const LEAD_STATUS_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "contacted", label: "Contattato" },
  { value: "qualified", label: "Qualificato" },
  { value: "converted", label: "Convertito" },
];

export function FiltersDrawer({ open, onOpenChange }: FiltersDrawerProps) {
  const g = useGlobalFilters();
  const [localSearch, setLocalSearch] = useState(g.filters.search);

  const handleApply = () => {
    g.setSearch(localSearch);
    onOpenChange(false);
  };

  const handleReset = () => {
    g.resetFilters();
    setLocalSearch("");
  };

  const toggleOrigin = (val: string) => {
    const next = new Set(g.filters.origin);
    if (next.has(val)) { if (next.size > 1) next.delete(val); } else next.add(val);
    g.setOrigin(next);
  };

  const route = g.currentRoute;
  const showOrigin = ["/outreach", "/crm"].includes(route);
  const showQuality = ["/network", "/operations"].includes(route);
  const showContacts = route === "/contacts" || route === "/crm";

  const activeCount = useMemo(() => {
    let c = 0;
    if (g.filters.search) c++;
    if (g.filters.sortBy !== "name") c++;
    if (g.filters.quality !== "all") c++;
    if (g.filters.origin.size < 3) c++;
    if (g.filters.groupBy !== "country") c++;
    if (g.filters.holdingPattern !== "out") c++;
    if (g.filters.leadStatus !== "all") c++;
    return c;
  }, [g.filters]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[320px] sm:max-w-[360px] p-0 flex flex-col border-r border-primary/10 bg-background/95 backdrop-blur-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-transparent to-primary/[0.04]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <SlidersHorizontal className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-foreground">Filtri & Ordinamento</h3>
              <p className="text-[11px] text-muted-foreground">Filtra i dati della vista corrente</p>
            </div>
            {activeCount > 0 && (
              <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">{activeCount} attivi</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Search */}
          <FilterSection title="Cerca">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={localSearch} onChange={e => setLocalSearch(e.target.value)}
                placeholder="Cerca partner, contatto..."
                className="pl-9 h-9 text-sm bg-muted/30 border-border/40"
                onKeyDown={e => e.key === "Enter" && handleApply()}
              />
            </div>
          </FilterSection>

          {/* Sort */}
          <FilterSection title="Ordinamento">
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map(opt => (
                <ChipButton key={opt.value} active={g.filters.sortBy === opt.value} onClick={() => g.setSortBy(opt.value)}>
                  {opt.label}
                </ChipButton>
              ))}
            </div>
          </FilterSection>

          {/* Origin */}
          {showOrigin && (
            <FilterSection title="Origine dati">
              <div className="flex flex-wrap gap-1.5">
                {ORIGIN_OPTIONS.map(opt => (
                  <button
                    key={opt.value} onClick={() => toggleOrigin(opt.value)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border flex items-center gap-1.5",
                      g.filters.origin.has(opt.value) ? opt.color : "border-border/40 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {g.filters.origin.has(opt.value) && <Check className="w-3 h-3" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Quality */}
          {showQuality && (
            <FilterSection title="Qualità dati">
              <div className="flex flex-wrap gap-1.5">
                {QUALITY_OPTIONS.map(opt => (
                  <ChipButton key={opt.value} active={g.filters.quality === opt.value} onClick={() => g.setQuality(opt.value)}>
                    {opt.label}
                  </ChipButton>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Contacts-specific */}
          {showContacts && (
            <>
              <FilterSection title="Raggruppa per">
                <div className="flex flex-wrap gap-1.5">
                  {GROUPBY_OPTIONS.map(opt => (
                    <ChipButton key={opt.value} active={g.filters.groupBy === opt.value} onClick={() => g.setGroupBy(opt.value)}>
                      {opt.label}
                    </ChipButton>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Circuito attesa">
                <div className="flex flex-wrap gap-1.5">
                  {HOLDING_OPTIONS.map(opt => (
                    <ChipButton key={opt.value} active={g.filters.holdingPattern === opt.value} onClick={() => g.setHoldingPattern(opt.value)}>
                      {opt.label}
                    </ChipButton>
                  ))}
                </div>
              </FilterSection>

              <FilterSection title="Stato lead">
                <div className="flex flex-wrap gap-1.5">
                  {LEAD_STATUS_OPTIONS.map(opt => (
                    <ChipButton key={opt.value} active={g.filters.leadStatus === opt.value} onClick={() => g.setLeadStatus(opt.value)}>
                      {opt.label}
                    </ChipButton>
                  ))}
                </div>
              </FilterSection>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-9 gap-1.5 text-xs" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
          <Button size="sm" className="flex-1 h-9 gap-1.5 text-xs" onClick={handleApply}>
            <Check className="w-3.5 h-3.5" /> Applica
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
      {children}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
        active
          ? "bg-primary/15 border-primary/30 text-primary shadow-sm shadow-primary/5"
          : "border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
