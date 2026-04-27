/**
 * SectionTabs — Horizontal tab strip rendered above section content.
 * Each tab routes to a sub-path under the section root.
 *
 * Phase 1: wraps the existing pages with no behavioral change beyond the strip.
 */
import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export interface SectionTab {
  readonly key: string;
  readonly label: string;
  readonly to: string;
  readonly badge?: string;
}

interface SectionTabsProps {
  tabs: readonly SectionTab[];
  /** Section root path (used to detect "default" tab on bare root). */
  rootPath: string;
  /** Page content. */
  children: React.ReactNode;
  className?: string;
  /**
   * Comportamento dell'area contenuto:
   * - "auto"   (default): scroll verticale gestito dal contenitore.
   *   Adatto a pagine documento/dashboard senza altezza fissa interna.
   * - "contain": overflow nascosto, il figlio gestisce i propri scroll.
   *   Adatto a pagine split-panel (GoldenLayout, Inbox, Outreach…).
   */
  contentOverflow?: "auto" | "contain";
}

export function SectionTabs({
  tabs,
  rootPath,
  children,
  className,
  contentOverflow = "auto",
}: SectionTabsProps): React.ReactElement {
  const { pathname } = useLocation();
  const isRoot = pathname === rootPath || pathname === `${rootPath}/`;

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      <div className="shrink-0 border-b border-border/40 bg-card/30 px-2 overflow-x-auto">
        <div className="flex items-center gap-0.5 min-w-max">
          {tabs.map((tab, idx) => {
            const active = isRoot
              ? idx === 0
              : pathname === tab.to || pathname.startsWith(`${tab.to}/`);
            return (
              <NavLink
                key={tab.key}
                to={tab.to}
                className={cn(
                  "relative px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="ml-1.5 text-[9px] font-bold uppercase bg-primary/15 text-primary px-1 py-0.5 rounded">
                    {tab.badge}
                  </span>
                )}
                {active && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
      <div
        className={cn(
          "flex-1 min-h-0",
          contentOverflow === "contain" ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {children}
      </div>
    </div>
  );
}
