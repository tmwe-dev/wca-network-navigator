/**
 * PageHeaderUnified — Header pagina single-row "Kanban-style".
 *
 * Sostituisce la stratificazione GoldenHeaderBar + SectionTabs + header pagina
 * con un'unica banda compatta che mostra:
 *   Riga 1: [icona sezione] Sezione · Pagina corrente   ▸ tab sorelle ⋯ azioni
 *   Riga 2 (opzionale): counter + chip filtri sempre visibili
 *
 * UX: l'utente vede sempre dove si trova (label sezione + pagina in primary)
 * e raggiunge le pagine sorelle in un click, senza menu impilati.
 */
import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderTab {
  readonly key: string;
  readonly label: string;
  readonly to: string;
  readonly count?: number | string;
}

export interface PageHeaderChip {
  readonly key: string;
  readonly label: string;
  readonly icon?: LucideIcon;
  readonly active?: boolean;
  readonly onClick?: () => void;
  /** Tone visivo: default neutro, "primary" evidenziato, "warn" ambra. */
  readonly tone?: "default" | "primary" | "warn";
}

interface PageHeaderUnifiedProps {
  /** Icona della sezione (es. Briefcase per Pipeline, Compass per Esplora). */
  sectionIcon: LucideIcon;
  /** Label macro-sezione (es. "Pipeline", "Esplora"). */
  sectionLabel: string;
  /** Tab sorelle della sezione. La attiva è derivata dal pathname. */
  tabs: readonly PageHeaderTab[];
  /** Path radice della sezione per determinare il default. */
  rootPath: string;
  /** Counter primario (es. "11.349 contatti"). */
  counter?: { value: React.ReactNode; label: string };
  /** Chip filtro sempre visibili sotto al counter. */
  chips?: readonly PageHeaderChip[];
  /** Azione primaria a destra (es. + Nuovo). */
  primaryAction?: React.ReactNode;
  /** Azioni secondarie a destra (kebab, segmenti, ecc.). */
  secondaryActions?: React.ReactNode;
  className?: string;
}

export function PageHeaderUnified({
  sectionIcon: SectionIcon,
  sectionLabel,
  tabs,
  rootPath,
  counter,
  chips,
  primaryAction,
  secondaryActions,
  className,
}: PageHeaderUnifiedProps): React.ReactElement {
  const { pathname } = useLocation();
  const isRoot = pathname === rootPath || pathname === `${rootPath}/`;

  const currentTab = React.useMemo(() => {
    if (isRoot) return tabs[0];
    return (
      tabs.find((t) => pathname === t.to || pathname.startsWith(`${t.to}/`)) ??
      tabs[0]
    );
  }, [tabs, pathname, isRoot]);

  const hasSecondRow = Boolean(counter || (chips && chips.length > 0));

  return (
    <div
      data-testid="page-header-unified"
      className={cn(
        "shrink-0 border-b border-border/40 bg-gradient-to-b from-card/70 to-card/30 backdrop-blur-sm",
        className,
      )}
    >
      {/* Riga 1: identità + tabs + azioni */}
      <div className="flex items-center gap-3 px-4 h-11 min-w-0">
        {/* Identità sezione · pagina */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <SectionIcon className="h-4 w-4" />
          </span>
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {sectionLabel}
            </span>
            <span className="text-muted-foreground/50 text-xs">·</span>
            <span className="text-sm font-bold text-primary truncate">
              {currentTab?.label ?? sectionLabel}
            </span>
          </div>
        </div>

        {/* Tabs sorelle inline */}
        <nav
          aria-label="Pagine sezione"
          className="flex items-center gap-0.5 min-w-0 overflow-x-auto scrollbar-thin"
        >
          {tabs.map((tab) => {
            const active = currentTab?.key === tab.key;
            return (
              <NavLink
                key={tab.key}
                to={tab.to}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                )}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span
                    className={cn(
                      "text-[10px] font-bold rounded px-1.5 py-0.5",
                      active
                        ? "bg-primary/25 text-primary"
                        : "bg-muted/60 text-muted-foreground",
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Azioni a destra */}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          {secondaryActions}
          {primaryAction}
        </div>
      </div>

      {/* Riga 2: counter + chip filtri */}
      {hasSecondRow && (
        <div className="flex items-center gap-2 px-4 h-9 min-w-0 border-t border-border/30 bg-card/20">
          {counter && (
            <span className="text-sm font-semibold text-foreground shrink-0">
              {counter.value}{" "}
              <span className="text-xs font-medium text-muted-foreground">
                {counter.label}
              </span>
            </span>
          )}
          {chips && chips.length > 0 && (
            <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-thin">
              {counter && <span className="text-muted-foreground/40 mx-1">·</span>}
              {chips.map((chip) => {
                const ChipIcon = chip.icon;
                const toneActive =
                  chip.tone === "warn"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : "bg-primary/15 text-primary border-primary/40";
                return (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={chip.onClick}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors whitespace-nowrap",
                      chip.active
                        ? toneActive
                        : "bg-muted/30 text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50",
                    )}
                  >
                    {ChipIcon && <ChipIcon className="h-3.5 w-3.5" />}
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PageHeaderUnified;