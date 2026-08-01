/**
 * SectionRailTabs — Tab orizzontali delle 7 sezioni principali integrate
 * nella top bar globale. Evidenzia la sezione attiva derivandola dal
 * pathname corrente. Sostituisce il bisogno di un breadcrumb separato
 * sotto la top bar per le pagine canoniche.
 */
import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { navItemsDef } from "../navConfig";

/** Estrae la radice di sezione da un path tipo `/v2/intelligence/prompt-lab` → `/v2/intelligence`. */
function sectionRoot(path: string): string {
  const parts = path.split("/").filter(Boolean); // ["v2", "intelligence", ...]
  if (parts.length < 2) return "/v2";
  return `/${parts[0]}/${parts[1]}`;
}

export function SectionRailTabs(): React.ReactElement {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const activeRoot = sectionRoot(pathname);

  return (
    <nav
      aria-label="Sezioni principali"
      className="hidden lg:flex items-center gap-0.5 min-w-0 overflow-x-auto"
    >
      {navItemsDef.map((item) => {
        const itemRoot = sectionRoot(item.path);
        const active = activeRoot === itemRoot;
        const translated = t(item.labelKey);
        const label =
          translated === item.labelKey
            ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
            : translated;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            title={label}
            className={cn(
              "relative px-2.5 py-1.5 text-[11px] font-medium tracking-wide whitespace-nowrap rounded-md transition-colors capitalize",
              active
                ? "text-foreground bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
            )}
          >
            {label}
            {active && (
              <span className="absolute -bottom-[7px] left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </NavLink>
        );
      })}
    </nav>
  );
}
