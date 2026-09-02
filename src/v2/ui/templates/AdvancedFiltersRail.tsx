import * as React from "react";
import { useLocation } from "react-router-dom";
import { PanelRightClose, SlidersHorizontal, Check, Settings2, RotateCcw, ArrowUpDown, Sparkles, Layers, Timer, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FilterSection, ChipGroup, Chip } from "@/components/global/filters-drawer/shared";
import { resolveFilterRule } from "@/v2/navigation/pageContract";

/**
 * Linguetta DESTRA — "Filtri avanzati".
 * Complementare a `ContextFiltersRail` (linguetta SINISTRA, filtri contestuali
 * della pagina): qui vivono i controlli trasversali (ordinamento, qualità,
 * raggruppamento, holding pattern, stato lead) + reset globale.
 * Stesso pattern overlay: la linguetta resta sempre visibile e diventa il
 * tasto di chiusura quando il pannello è aperto.
 */

const SORT_OPTIONS = [
  { value: "recent", label: "Più recenti" },
  { value: "name", label: "Nome" },
  { value: "score", label: "Score" },
  { value: "country", label: "Paese" },
];

const QUALITY_OPTIONS = [
  { value: "all", label: "Tutte" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Bassa" },
];

const GROUP_OPTIONS = [
  { value: "none", label: "Nessuno" },
  { value: "country", label: "Paese" },
  { value: "company", label: "Azienda" },
  { value: "status", label: "Stato" },
];

const HOLDING_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "active", label: "In holding" },
  { value: "released", label: "Rilasciati" },
];

const LEAD_STATUS_OPTIONS = [
  { value: "all", label: "Tutti" },
  { value: "new", label: "Nuovo" },
  { value: "first_touch_sent", label: "Primo contatto" },
  { value: "holding", label: "In attesa" },
  { value: "engaged", label: "Agganciato" },
  { value: "negotiation", label: "Trattativa" },
];

export function AdvancedFiltersRail(): React.ReactElement | null {
  const { pathname } = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);
  const g = useGlobalFilters();
  const [networkView, setNetworkView] = React.useState<"partners" | "bca">(() => {
    try {
      return (sessionStorage.getItem("network-view") as "partners" | "bca") || "partners";
    } catch {
      return "partners";
    }
  });

  React.useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ view: "partners" | "bca" }>).detail;
      if (detail?.view === "partners" || detail?.view === "bca") setNetworkView(detail.view);
    };
    window.addEventListener("network-view-change", onChange);
    return () => window.removeEventListener("network-view-change", onChange);
  }, []);

  React.useEffect(() => {
    setIsOpen(false);
  }, [pathname, networkView]);

  React.useEffect(() => {
    const onOpenDrawer = (e: Event) => {
      const detail = (e as CustomEvent<{ drawer?: string }>).detail;
      if (detail?.drawer === "advanced-filters") setIsOpen(true);
    };
    window.addEventListener("open-drawer", onOpenDrawer);
    return () => window.removeEventListener("open-drawer", onOpenDrawer);
  }, []);

  // Mostrata solo dove esistono filtri contestuali (stesse pagine "dati").
  const rule = resolveFilterRule(pathname, networkView);
  if (!rule) return null;

  return (
    <>
      {/* Linguetta SEMPRE visibile, ancorata al bordo DESTRO */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={[
          "fixed top-1/2 -translate-y-1/2 z-[70] flex h-14 w-7 items-center justify-center rounded-l-lg border border-r-0 border-primary/30 bg-primary/20 text-primary backdrop-blur-md transition-all duration-200 hover:border-primary/50 hover:bg-primary/25",
          isOpen ? "right-[88vw] sm:right-80" : "right-0",
        ].join(" ")}
        aria-label={isOpen ? "Chiudi filtri avanzati" : "Apri filtri avanzati"}
        aria-expanded={isOpen}
        data-testid="advanced-filters-toggle"
      >
        {isOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <Settings2 className="h-3.5 w-3.5" />}
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={[
          "fixed inset-0 z-[55] bg-black/40 backdrop-blur-[1px] transition-opacity duration-200",
          isOpen ? "opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      />

      {/* Pannello — slide-in da DESTRA */}
      <aside
        data-testid="advanced-filters-panel"
        className={[
          "fixed right-0 top-0 z-[60] flex h-[100dvh] w-[88vw] max-w-xs sm:w-80 flex-col border-l border-border/40 bg-card/95 backdrop-blur-md shadow-2xl transition-transform duration-200 ease-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-label="Filtri avanzati"
        aria-hidden={!isOpen}
      >
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border/40 px-4">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-bold uppercase text-foreground">Filtri avanzati</h2>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-md bg-card/60 dark:bg-card/40 border border-primary/60 px-2.5 text-[11px] font-semibold text-primary hover:bg-primary/15 hover:border-primary transition-colors"
            aria-label="Conferma e chiudi filtri avanzati"
          >
            <Check className="h-3 w-3" /> Conferma
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-4 [&>section+section]:border-t [&>section+section]:border-border/40 [&>section+section]:pt-4">
          <FilterSection icon={Sparkles} label="Ricerca trasversale">
            <Input
              value={g.filters.search}
              onChange={(e) => g.setFilter("search", e.target.value)}
              placeholder="Cerca in tutta la pagina..."
              className="h-8 text-xs bg-muted/30 border-border/40"
            />
          </FilterSection>

          <FilterSection icon={ArrowUpDown} label="Ordinamento">
            <ChipGroup columns={2}>
              {SORT_OPTIONS.map((o) => (
                <Chip key={o.value} active={g.filters.sortBy === o.value} onClick={() => g.setFilter("sortBy", o.value)} block>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Target} label="Qualità dato">
            <ChipGroup columns={2}>
              {QUALITY_OPTIONS.map((o) => (
                <Chip key={o.value} active={g.filters.quality === o.value} onClick={() => g.setFilter("quality", o.value)} block>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Layers} label="Raggruppamento">
            <ChipGroup columns={2}>
              {GROUP_OPTIONS.map((o) => (
                <Chip key={o.value} active={g.filters.groupBy === o.value} onClick={() => g.setFilter("groupBy", o.value)} block>
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Timer} label="Holding pattern">
            <ChipGroup columns={3}>
              {HOLDING_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  active={g.filters.holdingPattern === o.value}
                  onClick={() => g.setFilter("holdingPattern", o.value)}
                  block
                >
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>

          <FilterSection icon={Target} label="Stato lead">
            <ChipGroup columns={2}>
              {LEAD_STATUS_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  active={g.filters.leadStatus === o.value}
                  onClick={() => g.setFilter("leadStatus", o.value)}
                  block
                >
                  {o.label}
                </Chip>
              ))}
            </ChipGroup>
          </FilterSection>
        </div>

        <div className="shrink-0 border-t border-border/40 bg-card/60 px-4 py-3 space-y-2">
          <button
            type="button"
            onClick={() => g.resetFilters()}
            className="w-full inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border/60 bg-background/40 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Azzera filtri
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-card/60 dark:bg-card/40 border border-primary/60 text-primary text-xs font-semibold hover:bg-primary/15 hover:border-primary transition-colors"
          >
            <Check className="h-3.5 w-3.5" /> Conferma e chiudi
          </button>
        </div>
      </aside>
    </>
  );
}

export default AdvancedFiltersRail;
