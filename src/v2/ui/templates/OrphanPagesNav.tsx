/**
 * OrphanPagesNav — Mostra le pagine "orfane" (raggiungibili solo via deep-link,
 * NON presenti nei 6 destinations principali) in una lista collassabile
 * sotto la nav principale. Migliora la scopribilità senza rompere il design
 * 6-destination della Phase 1.
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SECONDARY_NAV } from "@/v2/navigation/registry";

interface Props {
  readonly onNavigate?: () => void;
}

export function OrphanPagesNav({ onNavigate }: Props): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = React.useState(false);

  const handleClick = (path: string): void => {
    navigate(path);
    onNavigate?.();
  };

  return (
    <div className="mt-3 border-t border-border/50 pt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
        aria-expanded={open}
        data-testid="orphan-pages-toggle"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        <span className="flex-1 text-left">Tutte le pagine</span>
      </button>
      {open && (
        <div className="mt-1 space-y-3 px-1 pb-2">
          {SECONDARY_NAV.map((group) => (
            <div key={group.title}>
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                {group.title}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleClick(item.path)}
                      className={cn(
                        "flex w-full items-center rounded-md px-3 py-1.5 text-xs transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground font-medium"
                          : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
                      )}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
