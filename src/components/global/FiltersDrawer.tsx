import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal, Search, RotateCcw } from "lucide-react";
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
  { value: "wca", label: "WCA" },
  { value: "import", label: "Import" },
  { value: "report_aziende", label: "Report Aziende" },
];

const QUALITY_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "no_profile", label: "No Profilo" },
  { value: "no_email", label: "No Email" },
  { value: "no_phone", label: "No Telefono" },
  { value: "no_deep_search", label: "No Deep Search" },
];

export function FiltersDrawer({ open, onOpenChange }: FiltersDrawerProps) {
  const { filters, setSearch, setSortBy, setOrigin, setQuality, resetFilters, currentRoute } = useGlobalFilters();
  const [localSearch, setLocalSearch] = useState(filters.search);

  const handleApply = () => {
    setSearch(localSearch);
    onOpenChange(false);
  };

  const handleReset = () => {
    resetFilters();
    setLocalSearch("");
  };

  const toggleOrigin = (val: string) => {
    const next = new Set(filters.origin);
    if (next.has(val)) {
      if (next.size > 1) next.delete(val);
    } else {
      next.add(val);
    }
    setOrigin(next);
  };

  const showOrigin = ["/outreach", "/crm"].includes(currentRoute);
  const showQuality = ["/network", "/operations"].includes(currentRoute);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[320px] sm:max-w-[360px] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-sm">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            Filtri & Ordinamento
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 mt-4 space-y-5 overflow-y-auto">
          {/* Search */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Cerca</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                placeholder="Cerca partner, contatto..."
                className="pl-8 h-8 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleApply()}
              />
            </div>
          </div>

          {/* Sort */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Ordinamento</Label>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSortBy(opt.value)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs transition-all border",
                    filters.sortBy === opt.value
                      ? "bg-primary/15 border-primary/30 text-primary font-medium"
                      : "border-border/50 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Origin filter */}
          {showOrigin && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Origine</Label>
              <div className="flex flex-wrap gap-1.5">
                {ORIGIN_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleOrigin(opt.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs transition-all border",
                      filters.origin.has(opt.value)
                        ? "bg-accent/20 border-accent/30 text-accent-foreground font-medium"
                        : "border-border/50 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quality filter */}
          {showQuality && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Qualità dati</Label>
              <div className="flex flex-wrap gap-1.5">
                {QUALITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setQuality(opt.value)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs transition-all border",
                      filters.quality === opt.value
                        ? "bg-primary/15 border-primary/30 text-primary font-medium"
                        : "border-border/50 text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="flex gap-2 pt-3 border-t border-border/50">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleReset}>
            <RotateCcw className="w-3 h-3" /> Reset
          </Button>
          <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={handleApply}>
            Applica
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
