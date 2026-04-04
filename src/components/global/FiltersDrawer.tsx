import { useState, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  SlidersHorizontal, Search, RotateCcw, Check, ArrowUpDown,
  Shield, Database,
} from "lucide-react";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface FiltersDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const QUALITY_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "no_profile", label: "No Profilo" },
  { value: "no_email", label: "No Email" },
  { value: "no_phone", label: "No Telefono" },
  { value: "no_deep_search", label: "No Deep Search" },
];

const ORIGIN_OPTIONS = [
  { value: "wca", label: "WCA", color: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
  { value: "import", label: "Import", color: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" },
  { value: "report_aziende", label: "Report Aziende", color: "bg-amber-500/15 border-amber-500/30 text-amber-400" },
];

/**
 * FiltersDrawer — now serves as "advanced filters" overlay.
 * Basic filters (search, sort, groupBy, leadStatus) are in the contextual filterSlots.
 * This drawer shows only advanced/secondary filters not available in the sidebar.
 */
export function FiltersDrawer({ open, onOpenChange }: FiltersDrawerProps) {
  const g = useGlobalFilters();
  const location = useLocation();
  const [localSearch, setLocalSearch] = useState(g.filters.search);

  const route = location.pathname;
  const isNetwork = route === "/network";
  const isCRM = route === "/crm";
  const isOutreach = route === "/outreach";

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

  const activeCount = useMemo(() => {
    let c = 0;
    if (g.filters.quality !== "all") c++;
    if (g.filters.origin.size < 3) c++;
    return c;
  }, [g.filters]);

  // Only show advanced filters — basic ones are in filterSlots
  const showQuality = isNetwork;
  const showOrigin = isNetwork || isCRM || isOutreach;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[90vw] sm:w-[400px] sm:max-w-[420px] p-0 flex flex-col border-r border-primary/10 bg-background/95 backdrop-blur-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/50 bg-gradient-to-r from-transparent to-primary/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <SlidersHorizontal className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-foreground">Filtri Avanzati</h3>
              <p className="text-xs text-muted-foreground">
                Filtri secondari non presenti nella sidebar
              </p>
            </div>
            {activeCount > 0 && (
              <span className="text-xs bg-primary/15 text-primary px-2.5 py-1 rounded-full font-semibold">{activeCount} attivi</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {/* Search */}
          <FilterSection title="Cerca avanzata" icon={Search}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={localSearch} onChange={e => setLocalSearch(e.target.value)}
                placeholder="Ricerca globale..."
                className="pl-10 h-10 text-sm bg-muted/20 border-border/40"
                onKeyDown={e => e.key === "Enter" && handleApply()}
              />
            </div>
          </FilterSection>

          {/* Quality — Network only */}
          {showQuality && (
            <FilterSection title="Qualità dati" icon={Shield}>
              <div className="flex flex-wrap gap-2">
                {QUALITY_OPTIONS.map(opt => (
                  <ChipButton key={opt.value} active={g.filters.quality === opt.value} onClick={() => g.setQuality(opt.value)}>
                    {opt.label}
                  </ChipButton>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Origin */}
          {showOrigin && (
            <FilterSection title="Origine dati" icon={Database}>
              <div className="flex flex-wrap gap-2">
                {ORIGIN_OPTIONS.map(opt => (
                  <button
                    key={opt.value} onClick={() => toggleOrigin(opt.value)}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-all border flex items-center gap-2",
                      g.filters.origin.has(opt.value) ? opt.color : "border-border/40 text-muted-foreground hover:bg-muted/40"
                    )}
                  >
                    {g.filters.origin.has(opt.value) && <Check className="w-3.5 h-3.5" />}
                    {opt.label}
                  </button>
                ))}
              </div>
            </FilterSection>
          )}

          {/* Info when no advanced filters available */}
          {!showQuality && !showOrigin && (
            <div className="text-center py-8 text-muted-foreground">
              <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Tutti i filtri sono nella sidebar sinistra</p>
              <p className="text-xs mt-1">Nessun filtro avanzato per questa vista</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border/50 bg-muted/20 flex gap-2">
          <Button variant="outline" className="flex-1 h-10 gap-2 text-sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4" /> Reset
          </Button>
          <Button className="flex-1 h-10 gap-2 text-sm" onClick={handleApply}>
            <Check className="w-4 h-4" /> Applica
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FilterSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <p className="text-[13px] text-foreground font-bold">{title}</p>
      </div>
      {children}
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-medium transition-all border",
        active
          ? "bg-primary/15 border-primary/30 text-primary shadow-sm shadow-primary/5"
          : "border-border/40 text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
