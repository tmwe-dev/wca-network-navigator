import { useState, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlidersHorizontal, Search, RotateCcw, Check } from "lucide-react";
import { useGlobalFilters, type WorkspaceFilterKey, type EmailGenFilter, type SortingFilterMode } from "@/contexts/GlobalFiltersContext";
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

/* ── Workspace filter definitions ── */
const WS_FILTER_SECTIONS: { label: string; chips: { key: WorkspaceFilterKey; label: string }[] }[] = [
  {
    label: "Dati Contatto",
    chips: [
      { key: "with_email", label: "Con email" },
      { key: "no_email", label: "Senza email" },
      { key: "with_contact", label: "Con contatto" },
      { key: "no_contact", label: "Senza contatto" },
    ],
  },
  {
    label: "Arricchimento",
    chips: [
      { key: "enriched", label: "Arricchito" },
      { key: "not_enriched", label: "Non arricchito" },
      { key: "with_alias", label: "Con alias" },
      { key: "no_alias", label: "Senza alias" },
    ],
  },
];

const EMAIL_GEN_OPTIONS: { key: EmailGenFilter; label: string }[] = [
  { key: "all", label: "Tutte" },
  { key: "generated", label: "Generata" },
  { key: "to_generate", label: "Da generare" },
];

/* ── Sorting filter definitions ── */
const SORTING_FILTER_OPTIONS: { key: SortingFilterMode; label: string }[] = [
  { key: "all", label: "Tutti" },
  { key: "immediate", label: "⚡ Immediati" },
  { key: "scheduled", label: "🕐 Programmati" },
  { key: "unreviewed", label: "Da rivedere" },
  { key: "reviewed", label: "Rivisti" },
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

  const toggleWsFilter = (key: WorkspaceFilterKey) => {
    const next = new Set(g.filters.workspaceFilters);
    if (next.has(key)) next.delete(key); else next.add(key);
    g.setWorkspaceFilters(next);
  };

  const route = g.currentRoute;
  const isOutreach = route === "/outreach";
  const outTab = g.filters.outreachTab;
  const showOrigin = ["/outreach", "/crm"].includes(route) && !isOutreach;
  const showQuality = ["/network", "/operations"].includes(route);
  const showContacts = route === "/contacts" || route === "/crm";
  const showWorkspace = isOutreach && outTab === "workspace";
  const showSorting = isOutreach && outTab === "inuscita";

  const activeCount = useMemo(() => {
    let c = 0;
    if (g.filters.search) c++;
    if (g.filters.sortBy !== "name") c++;
    if (g.filters.quality !== "all") c++;
    if (g.filters.origin.size < 3) c++;
    if (g.filters.groupBy !== "country") c++;
    if (g.filters.holdingPattern !== "out") c++;
    if (g.filters.leadStatus !== "all") c++;
    if (g.filters.workspaceFilters.size > 0) c++;
    if (g.filters.emailGenFilter !== "all") c++;
    if (g.filters.workspaceCountries.size > 0) c++;
    if (g.filters.sortingFilter !== "all") c++;
    if (g.filters.sortingSearch) c++;
    return c;
  }, [g.filters]);

  const searchPlaceholder = showSorting ? "Cerca azienda o contatto..." : showWorkspace ? "Cerca partner, contatto..." : "Cerca partner, contatto...";

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
              <p className="text-[11px] text-muted-foreground">
                {showWorkspace ? "Filtri Workspace" : showSorting ? "Filtri In Uscita" : "Filtra i dati della vista corrente"}
              </p>
            </div>
            {activeCount > 0 && (
              <span className="text-[10px] bg-primary/15 text-primary px-2 py-0.5 rounded-full font-semibold">{activeCount} attivi</span>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Global Search */}
          {!showSorting && (
            <FilterSection title="Cerca">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={localSearch} onChange={e => setLocalSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="pl-9 h-9 text-sm bg-muted/30 border-border/40"
                  onKeyDown={e => e.key === "Enter" && handleApply()}
                />
              </div>
            </FilterSection>
          )}

          {/* Sorting-specific search */}
          {showSorting && (
            <FilterSection title="Cerca">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={g.filters.sortingSearch}
                  onChange={e => g.setSortingSearch(e.target.value)}
                  placeholder="Cerca azienda o contatto..."
                  className="pl-9 h-9 text-sm bg-muted/30 border-border/40"
                />
              </div>
            </FilterSection>
          )}

          {/* Sort (non-outreach) */}
          {!showWorkspace && !showSorting && (
            <FilterSection title="Ordinamento">
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map(opt => (
                  <ChipButton key={opt.value} active={g.filters.sortBy === opt.value} onClick={() => g.setSortBy(opt.value)}>
                    {opt.label}
                  </ChipButton>
                ))}
              </div>
            </FilterSection>
          )}

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

          {/* ── WORKSPACE FILTERS ── */}
          {showWorkspace && (
            <>
              <FilterSection title="Stato Email">
                <div className="flex flex-wrap gap-1.5">
                  {EMAIL_GEN_OPTIONS.map(opt => (
                    <ChipButton key={opt.key} active={g.filters.emailGenFilter === opt.key} onClick={() => g.setEmailGenFilter(opt.key)}>
                      {opt.label}
                    </ChipButton>
                  ))}
                </div>
              </FilterSection>

              {WS_FILTER_SECTIONS.map(section => (
                <FilterSection key={section.label} title={section.label}>
                  <div className="flex flex-wrap gap-1.5">
                    {section.chips.map(chip => (
                      <ChipButton key={chip.key} active={g.filters.workspaceFilters.has(chip.key)} onClick={() => toggleWsFilter(chip.key)}>
                        {chip.label}
                      </ChipButton>
                    ))}
                  </div>
                </FilterSection>
              ))}
            </>
          )}

          {/* ── SORTING FILTERS ── */}
          {showSorting && (
            <FilterSection title="Stato coda">
              <div className="flex flex-wrap gap-1.5">
                {SORTING_FILTER_OPTIONS.map(opt => (
                  <ChipButton key={opt.key} active={g.filters.sortingFilter === opt.key} onClick={() => g.setSortingFilter(opt.key)}>
                    {opt.label}
                  </ChipButton>
                ))}
              </div>
            </FilterSection>
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
