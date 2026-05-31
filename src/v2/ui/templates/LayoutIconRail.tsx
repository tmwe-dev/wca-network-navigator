/**
 * LayoutIconRail — Stretta barra verticale (w-14) sempre visibile a sinistra
 * con le icone delle voci principali. Hover mostra il nome via Tooltip; click
 * naviga; le voci con sotto-cartelle aprono un Popover laterale.
 *
 * La sidebar completa scorre sopra a questa barra (z superiore).
 */
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Menu } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { navItemsDef } from "./navConfig";
import { sectionRoot, NavMenuPopover } from "./NavMenuPopover";
import { useNavBadgeCountsV2, badgeForPath } from "@/v2/hooks/useNavBadgeCountsV2";

interface Props {
  currentPath?: string;
}

export function LayoutIconRail({ currentPath }: Props): React.ReactElement {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { data: badgeCounts } = useNavBadgeCountsV2();
  const activeRoot = currentPath ? sectionRoot(currentPath) : null;

  const labelOf = (item: { labelKey: string }) => {
    const tr = t(item.labelKey);
    return tr === item.labelKey
      ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
      : tr;
  };

  const handleNav = (path: string) => {
    // Vedi NavMenuPopover: ripuliamo eventuale pointer-events residuo prima
    // di navigare per evitare il "primo click che non funziona".
    requestAnimationFrame(() => {
      document.body.style.pointerEvents = "";
      nav(path);
    });
  };

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 z-40 h-full w-14 flex-col items-center gap-1 border-r border-border/40 bg-card/80 backdrop-blur-xl py-2"
      role="navigation"
      aria-label="Navigazione rapida"
    >
      {/* Menu unico globale: stesso NavMenuPopover usato in Command.
          Garantisce accesso a TUTTE le maschere (incl. Development) da ogni pagina. */}
      <NavMenuPopover currentPath={currentPath} align="start" side="right">
        <button
          type="button"
          aria-label="Apri menu completo"
          className="h-10 w-10 mb-1 flex items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors"
        >
          <Menu className="h-5 w-5" />
        </button>
      </NavMenuPopover>
      <div className="flex-1 w-full flex flex-col items-center gap-0.5 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navItemsDef.map((item) => {
          const isActive = sectionRoot(item.path) === activeRoot;
          const label = labelOf(item);
          const count = badgeForPath(badgeCounts, item.path);

          const button = (
            <button
              type="button"
              onClick={() => handleNav(item.path)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
              className={
                "relative h-10 w-10 flex items-center justify-center rounded-md transition-colors border-l-2 " +
                (isActive
                  ? "bg-primary/15 text-primary border-primary"
                  : "border-transparent text-foreground/75 hover:bg-primary/10 hover:text-primary hover:border-primary/60")
              }
            >
              {item.icon}
              {count > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[1rem] h-4 px-1 inline-flex items-center justify-center rounded-full text-[9px] font-semibold bg-primary text-primary-foreground"
                  aria-label={`${count} da gestire`}
                >
                  {count}
                </span>
              )}
              {item.badge && (
                <span className="absolute -bottom-0.5 -right-0.5 px-1 rounded-sm text-[8px] font-bold bg-accent text-accent-foreground">
                  {item.badge}
                </span>
              )}
            </button>
          );

          return (
            <Tooltip key={item.path} delayDuration={200}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right">{label}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </aside>
  );
}
