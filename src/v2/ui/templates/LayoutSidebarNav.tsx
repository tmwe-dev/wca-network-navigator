/**
 * LayoutSidebarNav — Navigation groups for the sidebar
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/prefetchRoutes";
import {
  LogOut, Command, Wifi, WifiOff, Sun, Moon,
} from "lucide-react";
import { Button } from "../atoms/Button";
import { navItemsDef, navGroupsDef } from "./navConfig";
import { OrphanPagesNav } from "./OrphanPagesNav";

/** Backward-compatible export for any code referencing navGroups */
export const navGroups = navGroupsDef.map((g) => ({
  title: g.titleKey,
  items: g.items.map((i) => ({ label: i.labelKey, path: i.path, icon: i.icon })),
}));

interface SidebarProps {
  profileName?: string | null;
  wcaStatusColor: string;
  wcaStatusLabel: string;
  wcaSessionActive: boolean | null;
  onWcaReconnect: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignOut: () => void;
  onMobileClose?: () => void;
  onOpenCommandPalette?: () => void;
  /** When true, render compact icon-only mode (w-14 column). */
  collapsed?: boolean;
}

export function LayoutSidebarNav({
  profileName, wcaStatusColor, wcaStatusLabel, wcaSessionActive,
  onWcaReconnect, isDark, onToggleTheme, onSignOut, onMobileClose,
  onOpenCommandPalette, collapsed = false,
}: SidebarProps): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string) => {
    if (path === "/v2") return location.pathname === "/v2";
    return location.pathname.startsWith(path);
  };

  return (
    <>
      <div className={cn("border-b border-border/50", collapsed ? "p-2" : "p-4")}>
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Command className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-foreground leading-tight truncate">WCA Partners</h2>
              {profileName ? (
                <p className="text-[10px] text-muted-foreground truncate">{profileName}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
      {onOpenCommandPalette && (
        <button
          onClick={() => { onOpenCommandPalette(); onMobileClose?.(); }}
          className={cn(
            "mt-2 mb-1 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors",
            collapsed ? "mx-2 justify-center px-2 py-2" : "mx-3 px-3 py-2",
          )}
          aria-label="Apri ricerca rapida"
          data-testid="sidebar-command-button"
          title={collapsed ? "Cerca rapida (⌘K)" : undefined}
        >
          <Command className="h-4 w-4 shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Cerca rapida</span>
              <kbd className="hidden sm:inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </>
          )}
        </button>
      )}
      <nav className="flex-1 min-h-0 p-2 overflow-y-auto overscroll-contain" data-testid="main-sidebar">
        <div className="space-y-1" aria-label="Navigazione principale">
          {navItemsDef.map((navItem) => {
            const navId =
              navItem.path.replace("/v2/", "").replace("/v2", "dashboard").replace(/\//g, "-") ||
              "dashboard";
            const translated = t(navItem.labelKey);
            // Fallback: when the i18n key is not registered yet, show a humanized stem.
            const label =
              translated === navItem.labelKey
                ? navItem.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
                : translated;
            return (
              <button
                key={navItem.path}
                data-testid={`nav-${navId}`}
                onMouseEnter={() => prefetchRoute(navItem.path)}
                onClick={() => { navigate(navItem.path); onMobileClose?.(); }}
                title={collapsed ? label : undefined}
                className={cn(
                  "flex w-full items-center rounded-md text-sm font-medium transition-colors capitalize",
                  collapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
                  isActive(navItem.path)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                )}
              >
                {navItem.icon}
                {!collapsed && label}
                {!collapsed && navItem.badge && (
                  <span className="ml-auto text-[9px] font-bold uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                    {navItem.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!collapsed && <OrphanPagesNav onNavigate={onMobileClose} />}
      </nav>
      <div className="p-2 border-t border-border/50 space-y-1">
        <button
          onClick={onWcaReconnect}
          className={cn(
            "flex w-full items-center rounded-md text-xs text-muted-foreground hover:bg-accent/50 transition-colors",
            collapsed ? "justify-center px-2 py-1.5" : "gap-2 px-3 py-1.5",
          )}
          title={collapsed ? wcaStatusLabel : undefined}
        >
          {wcaSessionActive === true ? (
            <Wifi className={cn("h-3.5 w-3.5", wcaStatusColor)} />
          ) : (
            <WifiOff className={cn("h-3.5 w-3.5", wcaStatusColor)} />
          )}
          {!collapsed && <span className={wcaStatusColor}>{wcaStatusLabel}</span>}
        </button>
        <button
          onClick={onToggleTheme}
          className={cn(
            "flex w-full items-center rounded-md text-xs text-muted-foreground hover:bg-accent/50 transition-colors",
            collapsed ? "justify-center px-2 py-1.5" : "gap-2 px-3 py-1.5",
          )}
          title={collapsed ? (isDark ? t("common.light_mode") : t("common.dark_mode")) : undefined}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {!collapsed && (isDark ? t("common.light_mode") : t("common.dark_mode"))}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className={cn("w-full gap-2", collapsed ? "justify-center px-2" : "justify-start")}
          onClick={onSignOut}
          title={collapsed ? String(t("common.logout")) : undefined}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && t("common.logout")}
        </Button>
      </div>
    </>
  );
}
