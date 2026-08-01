/**
 * LayoutIconRail — UNICO menu globale.
 *
 * 2026-05-31: rimossa la barra verticale di icone sempre visibile (duplicava
 * il menu). Resta solo un pulsante hamburger fluttuante in alto a sinistra che
 * apre il NavMenuPopover (Command → Development) e si richiude completamente:
 * niente sidebar permanente a lato.
 */
import * as React from "react";
import { Menu } from "lucide-react";
import { NavMenuPopover } from "./NavMenuPopover";

interface Props {
  currentPath?: string;
}

export function LayoutIconRail({ currentPath }: Props): React.ReactElement {
  return (
    <div className="hidden md:block fixed left-3 top-3 z-50">
      <NavMenuPopover currentPath={currentPath} align="start" side="bottom">
        <button
          type="button"
          aria-label="Apri menu"
          className="h-10 w-10 flex items-center justify-center rounded-md text-primary bg-card/80 backdrop-blur-xl border border-border/40 hover:bg-primary/10 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </NavMenuPopover>
    </div>
  );
}
