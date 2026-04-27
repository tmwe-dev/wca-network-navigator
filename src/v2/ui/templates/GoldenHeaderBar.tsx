/**
 * GoldenHeaderBar — 44px header with auto-derived breadcrumb + action slot.
 * Used by every page that adopts the Golden Layout.
 */
import * as React from "react";
import { useLocation, Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buildCrumbs } from "./breadcrumbConfig";

interface GoldenHeaderBarProps {
  /** Optional override for the trailing entity label (e.g. selected contact name). */
  trailingLabel?: string | null;
  /** Right-side actions (e.g. "+ Nuovo", filter buttons). */
  actions?: React.ReactNode;
  className?: string;
}

export function GoldenHeaderBar({
  trailingLabel,
  actions,
  className,
}: GoldenHeaderBarProps): React.ReactElement {
  const { pathname } = useLocation();
  const crumbs = React.useMemo(() => {
    const base = buildCrumbs(pathname).slice();
    if (trailingLabel) base.push({ label: trailingLabel });
    return base;
  }, [pathname, trailingLabel]);

  return (
    <div
      className={cn(
        "h-11 flex items-center justify-between gap-3 px-4 border-b border-border/40 bg-card/40 backdrop-blur-sm shrink-0",
        className,
      )}
      data-testid="golden-header-bar"
    >
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
        {crumbs.map((c, i) => (
          <React.Fragment key={`${c.label}-${i}`}>
            {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/60 shrink-0" />}
            {c.href ? (
              <Link
                to={c.href}
                className="text-muted-foreground hover:text-foreground transition-colors truncate"
              >
                {c.label}
              </Link>
            ) : (
              <span className="font-medium text-foreground truncate">{c.label}</span>
            )}
          </React.Fragment>
        ))}
      </nav>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
