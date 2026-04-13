import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  ChevronLeft, ChevronRight, Filter, Mail, Phone,
  Linkedin, MessageCircle, Globe2, X, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CRMFilterSidebarProps {
  readonly sortField: string;
  readonly onSortChange: (field: string) => void;
  readonly groupBy: string;
  readonly onGroupByChange: (group: string) => void;
  readonly activeFilters: Record<string, string[]>;
  readonly onFilterChange: (key: string, values: string[]) => void;
  readonly onClearAll: () => void;
  readonly originCounts?: Record<string, number>;
}

const SORT_OPTIONS = [
  { value: "name", label: "Nome A→Z" },
  { value: "country", label: "Paese" },
  { value: "company", label: "Azienda" },
  { value: "created_at", label: "Più recenti" },
  { value: "last_interaction_at", label: "Ultimo contatto" },
];

const GROUP_OPTIONS = [
  { value: "none", label: "Nessuno" },
  { value: "country", label: "Paese" },
  { value: "origin", label: "Origine" },
  { value: "status", label: "Stato" },
  { value: "group", label: "Gruppo" },
];

const ORIGIN_OPTIONS = [
  { value: "WCA", label: "WCA" },
  { value: "Import", label: "Import" },
  { value: "RA", label: "RA" },
  { value: "BCA", label: "BCA" },
];

const QUALITY_OPTIONS = [
  { value: "has_email", label: "Con Email" },
  { value: "no_email", label: "Senza Email" },
  { value: "enriched", label: "Arricchiti" },
  { value: "not_enriched", label: "Non Arricchiti" },
  { value: "has_alias", label: "Con Alias" },
  { value: "no_alias", label: "Senza Alias" },
];

const CHANNEL_OPTIONS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "phone", label: "Telefono", icon: Phone },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
];

const CIRCUIT_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "in_circuit", label: "🛫 In circuito" },
  { value: "to_work", label: "🛬 Da lavorare" },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">{children}</h4>;
}

function ChipToggle({ label, active, icon: Icon, count, onClick }: {
  label: string; active: boolean; icon?: typeof Mail; count?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all border",
        active
          ? "bg-primary/15 text-primary border-primary/30"
          : "bg-transparent text-muted-foreground border-border/40 hover:bg-muted/30"
      )}
    >
      {Icon && <Icon className="w-3 h-3" />}
      {label}
      {count !== undefined && <Badge variant="secondary" className="text-[8px] h-3 px-1 ml-0.5">{count}</Badge>}
    </button>
  );
}

export function CRMFilterSidebar({
  sortField, onSortChange, groupBy, onGroupByChange,
  activeFilters, onFilterChange, onClearAll, originCounts,
}: CRMFilterSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const activeCount = useMemo(() => {
    return Object.values(activeFilters).reduce((sum, arr) => sum + arr.length, 0);
  }, [activeFilters]);

  const toggleFilter = (key: string, value: string) => {
    const current = activeFilters[key] || [];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    onFilterChange(key, next);
  };

  if (collapsed) {
    return (
      <div className="w-10 shrink-0 border-r border-border/30 flex flex-col items-center pt-2 bg-card/30">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCollapsed(false)}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <div className="mt-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        {activeCount > 0 && (
          <Badge variant="default" className="text-[8px] h-4 px-1 mt-1">{activeCount}</Badge>
        )}
      </div>
    );
  }

  return (
    <div className="w-[260px] shrink-0 border-r border-border/30 bg-card/30 backdrop-blur-sm flex flex-col">
      <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold">Filtri</span>
          {activeCount > 0 && <Badge variant="default" className="text-[8px] h-4 px-1">{activeCount}</Badge>}
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCollapsed(true)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
      </div>

      <ScrollArea className="flex-1 min-h-0">
        <div className="p-3 space-y-4">
          {/* Sort */}
          <div>
            <SectionTitle>Ordinamento</SectionTitle>
            <div className="space-y-0.5">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onSortChange(opt.value)}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-[11px] transition-colors",
                    sortField === opt.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Separator className="border-border/30" />

          {/* Group By */}
          <div>
            <SectionTitle>Raggruppamento</SectionTitle>
            <div className="space-y-0.5">
              {GROUP_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => onGroupByChange(opt.value)}
                  className={cn(
                    "w-full text-left px-2 py-1 rounded text-[11px] transition-colors",
                    groupBy === opt.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-muted/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Separator className="border-border/30" />

          {/* Origin */}
          <div>
            <SectionTitle>Origine</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {ORIGIN_OPTIONS.map(opt => (
                <ChipToggle
                  key={opt.value}
                  label={opt.label}
                  active={(activeFilters.origin || []).includes(opt.value)}
                  count={originCounts?.[opt.value]}
                  onClick={() => toggleFilter("origin", opt.value)}
                />
              ))}
            </div>
          </div>

          <Separator className="border-border/30" />

          {/* Data Quality */}
          <div>
            <SectionTitle>Qualità Dati</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {QUALITY_OPTIONS.map(opt => (
                <ChipToggle
                  key={opt.value}
                  label={opt.label}
                  active={(activeFilters.quality || []).includes(opt.value)}
                  onClick={() => toggleFilter("quality", opt.value)}
                />
              ))}
            </div>
          </div>

          <Separator className="border-border/30" />

          {/* Channels */}
          <div>
            <SectionTitle>Canali</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {CHANNEL_OPTIONS.map(opt => (
                <ChipToggle
                  key={opt.value}
                  label={opt.label}
                  icon={opt.icon}
                  active={(activeFilters.channel || []).includes(opt.value)}
                  onClick={() => toggleFilter("channel", opt.value)}
                />
              ))}
            </div>
          </div>

          <Separator className="border-border/30" />

          {/* Circuit */}
          <div>
            <SectionTitle>Circuito</SectionTitle>
            <div className="flex flex-wrap gap-1">
              {CIRCUIT_OPTIONS.map(opt => (
                <ChipToggle
                  key={opt.value}
                  label={opt.label}
                  active={(activeFilters.circuit || []).includes(opt.value)}
                  onClick={() => toggleFilter("circuit", opt.value)}
                />
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {activeCount > 0 && (
        <div className="px-3 py-2 border-t border-border/30 shrink-0">
          <Button variant="ghost" size="sm" className="w-full h-7 text-[10px] gap-1 text-destructive" onClick={onClearAll}>
            <X className="w-3 h-3" /> Azzera Filtri ({activeCount})
          </Button>
        </div>
      )}
    </div>
  );
}
