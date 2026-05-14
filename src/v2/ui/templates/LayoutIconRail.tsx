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
import { ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { navItemsDef } from "./navConfig";
import { EXPANDABLE_MAIN_NAV, sectionRoot } from "./NavMenuPopover";
import { useNavBadgeCountsV2, badgeForPath } from "@/v2/hooks/useNavBadgeCountsV2";

interface Props {
  currentPath?: string;
}

export function LayoutIconRail({ currentPath }: Props): React.ReactElement {
  const nav = useNavigate();
  const { t } = useTranslation();
  const { data: badgeCounts } = useNavBadgeCountsV2();
  const activeRoot = currentPath ? sectionRoot(currentPath) : null;
  const [openSub, setOpenSub] = React.useState<string | null>(null);

  const labelOf = (item: { labelKey: string }) => {
    const tr = t(item.labelKey);
    return tr === item.labelKey
      ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
      : tr;
  };

  const handleNav = (path: string) => {
    setOpenSub(null);
    nav(path);
  };

  return (
    <aside
      className="hidden md:flex fixed left-0 top-0 z-40 h-full w-14 flex-col items-center gap-1 border-r border-border/40 bg-card/80 backdrop-blur-xl py-2"
      role="navigation"
      aria-label="Navigazione rapida"
    >
      <div className="flex-1 w-full flex flex-col items-center gap-0.5 overflow-y-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {navItemsDef.map((item) => {
          const isActive = sectionRoot(item.path) === activeRoot;
          const label = labelOf(item);
          const count = badgeForPath(badgeCounts, item.path);
          const expandable = EXPANDABLE_MAIN_NAV[item.path];

          const button = (
            <button
              type="button"
              onClick={() => {
                if (expandable && expandable.length > 0) {
                  setOpenSub(openSub === item.path ? null : item.path);
                } else {
                  handleNav(item.path);
                }
              }}
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

          if (expandable && expandable.length > 0) {
            return (
              <Popover
                key={item.path}
                open={openSub === item.path}
                onOpenChange={(o) => setOpenSub(o ? item.path : null)}
              >
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>{button}</PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">{label}</TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="right"
                  align="start"
                  sideOffset={6}
                  className="w-64 p-1 bg-background/95 backdrop-blur-xl border-white/10 max-h-[80vh] overflow-y-auto"
                >
                  <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
                    {label}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNav(item.path)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 rounded-md text-xs text-accent-foreground/80 hover:bg-accent/10 hover:text-accent-foreground"
                  >
                    <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                    Apri pagina
                  </button>
                  <div className="my-1 border-t border-white/10" />
                  {expandable.map((group) => (
                    <div key={group.title} className="pb-1">
                      <div className="px-3 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-foreground/70">
                        {group.title}
                      </div>
                      <div className="ml-2 flex flex-col border-l border-accent/30 pl-2">
                        {(group.items ?? []).map((sub) => (
                          <button
                            key={sub.path}
                            type="button"
                            onClick={() => handleNav(sub.path)}
                            className="flex items-center px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground text-left"
                          >
                            {sub.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
            );
          }

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
