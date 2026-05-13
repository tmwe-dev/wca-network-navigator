/**
 * NavMenuPopover — Dropdown di navigazione globale, identico in tutte le
 * pagine. Usato sia in CommandPage (trigger custom "Menu" fixed top-left)
 * sia in LayoutHeader (trigger ☰ standard).
 *
 * Single source of truth: navItemsDef.
 */
import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Layers, LogOut } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { navItemsDef } from "./navConfig";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { ThemePicker } from "@/v2/ui/theme/ThemePicker";
import { SECONDARY_NAV, findSecondaryNavGroup } from "@/v2/navigation/registry";
import { useNavBadgeCountsV2, badgeForPath } from "@/v2/hooks/useNavBadgeCountsV2";

const DEV_PAGE_GROUPS = SECONDARY_NAV;

/** Estrae la radice di sezione: `/v2/intelligence/agents` → `/v2/intelligence`. */
function sectionRoot(path: string): string {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return "/v2";
  return `/${parts[0]}/${parts[1]}`;
}

interface NavMenuPopoverProps {
  /** Trigger element (e.g. icon button). Renders inside <PopoverTrigger asChild>. */
  children: React.ReactNode;
  /** Path corrente, usato per nascondere la voce attiva. */
  currentPath?: string;
  /** Allineamento del contenuto rispetto al trigger. Default: start. */
  align?: "start" | "center" | "end";
}

export function NavMenuPopover({
  children,
  currentPath,
  align = "start",
}: NavMenuPopoverProps): React.ReactElement {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const { signOut } = useAuthV2();
  const { data: badgeCounts } = useNavBadgeCountsV2();

  const handleSelect = (path: string) => {
    setOpen(false);
    nav(path);
  };

  const activeRoot = currentPath ? sectionRoot(currentPath) : null;
  const activeGroupTitle = React.useMemo(
    () => findSecondaryNavGroup(currentPath ?? null),
    [currentPath],
  );
  const isInDev = activeGroupTitle !== null;
  const [openGroup, setOpenGroup] = React.useState<string | null>(activeGroupTitle);
  React.useEffect(() => {
    if (isInDev) {
      setDevOpen(true);
      setOpenGroup(activeGroupTitle);
    }
  }, [isInDev, activeGroupTitle]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        sideOffset={8}
        className="w-72 p-1 bg-background/95 backdrop-blur-xl border-white/10 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex flex-col">
          {navItemsDef.map((item) => {
              const isActive = sectionRoot(item.path) === activeRoot;
              const translated = t(item.labelKey);
              const label =
                translated === item.labelKey
                  ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
                  : translated;
              const count = badgeForPath(badgeCounts, item.path);
              return (
                <button
                  key={item.path}
                  role="menuitem"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleSelect(item.path)}
                  className={
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left capitalize " +
                    (isActive
                      ? "bg-primary/15 text-primary font-semibold"
                      : "text-foreground/90 hover:bg-white/5 hover:text-foreground")
                  }
                >
                  <span className="text-muted-foreground">{item.icon}</span>
                  <span className="flex-1">{label}</span>
                  {count > 0 && (
                    <span
                      className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30"
                      title={`${count} da gestire`}
                      aria-label={`${count} elementi da gestire`}
                    >
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </button>
              );
            })}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            onClick={() => setDevOpen((v) => !v)}
            aria-expanded={devOpen}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left " +
              (isInDev
                ? "bg-primary/15 text-primary font-semibold"
                : "text-foreground/90 hover:bg-white/5 hover:text-foreground")
            }
          >
            <span className="text-muted-foreground"><Layers className="h-4 w-4" /></span>
            <span className="flex-1">Development</span>
            {devOpen ? <ChevronDown className="h-4 w-4 opacity-60" /> : <ChevronRight className="h-4 w-4 opacity-60" />}
          </button>
          {devOpen && (
            <div className="mt-1 space-y-0.5 pb-1 pl-2">
              {DEV_PAGE_GROUPS.map((group) => {
                const isGroupOpen = openGroup === group.title;
                const isGroupActive = activeGroupTitle === group.title;
                return (
                  <div key={group.title}>
                    <button
                      type="button"
                      onClick={() => setOpenGroup(isGroupOpen ? null : group.title)}
                      aria-expanded={isGroupOpen}
                      className={
                        "flex w-full items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-colors text-left " +
                        (isGroupActive
                          ? "bg-primary/15 text-primary font-semibold"
                          : "text-foreground/85 hover:bg-white/5 hover:text-foreground")
                      }
                    >
                      {isGroupOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                      <span className="flex-1">{group.title}</span>
                    </button>
                    {isGroupOpen && (
                      <div className="ml-5 mt-0.5 mb-1 flex flex-col border-l border-white/10 pl-2">
                        {(group.items ?? []).map((item) => {
                          const isActive = currentPath === item.path;
                          return (
                            <button
                              key={item.path}
                              type="button"
                              onClick={() => handleSelect(item.path)}
                              aria-current={isActive ? "page" : undefined}
                              className={
                                "flex items-center px-3 py-1.5 rounded-md text-xs transition-colors text-left " +
                                (isActive
                                  ? "bg-primary/15 text-primary font-semibold"
                                  : "text-foreground/75 hover:bg-white/5 hover:text-foreground")
                              }
                            >
                              {item.label}
                            </button>
                          );
                        })}
                        {(group.subGroups ?? []).map((sg) => (
                          <div key={sg.title} className="mt-1">
                            <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                              {sg.title}
                            </div>
                            <div className="ml-2 flex flex-col border-l border-white/10 pl-2">
                              {sg.items.map((item) => {
                                const isActive = currentPath === item.path;
                                return (
                                  <button
                                    key={item.path}
                                    type="button"
                                    onClick={() => handleSelect(item.path)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={
                                      "flex items-center px-3 py-1.5 rounded-md text-xs transition-colors text-left " +
                                      (isActive
                                        ? "bg-primary/15 text-primary font-semibold"
                                        : "text-foreground/75 hover:bg-white/5 hover:text-foreground")
                                    }
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
              })}
            </div>
          )}
          <div className="my-1 border-t border-white/10" />
          <div className="px-1">
            <ThemePicker variant="menu-row" />
          </div>
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left text-destructive hover:bg-destructive/10"
          >
            <span><LogOut className="h-4 w-4" /></span>
            <span>Logout</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}