/**
 * LayoutSidebarNav — Navigation groups for the sidebar
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/prefetchRoutes";
import {
  LogOut, Command, Wifi, WifiOff, Sun, Moon, Search,
} from "lucide-react";
import { Button } from "../atoms/Button";
import { navItemsDef, navGroupsDef } from "./navConfig";

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
}

export function LayoutSidebarNav({
  profileName, wcaStatusColor, wcaStatusLabel, wcaSessionActive,
  onWcaReconnect, isDark, onToggleTheme, onSignOut, onMobileClose,
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
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Command className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground leading-tight">WCA Partners</h2>
            {profileName ? (
              <p className="text-[10px] text-muted-foreground truncate">{profileName}</p>
            ) : null}
          </div>
        </div>
      </div>
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
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors capitalize",
                  isActive(navItem.path)
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
                )}
              >
                {navItem.icon}
                {label}
                {navItem.badge && (
                  <span className="ml-auto text-[9px] font-bold uppercase bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                    {navItem.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      <div className="p-2 border-t border-border/50 space-y-1">
        <button
          onClick={onWcaReconnect}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          {wcaSessionActive === true ? (
            <Wifi className={cn("h-3.5 w-3.5", wcaStatusColor)} />
          ) : (
            <WifiOff className={cn("h-3.5 w-3.5", wcaStatusColor)} />
          )}
          <span className={wcaStatusColor}>{wcaStatusLabel}</span>
        </button>
        <button
          onClick={onToggleTheme}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          {isDark ? t("common.light_mode") : t("common.dark_mode")}
        </button>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={onSignOut}>
          <LogOut className="h-4 w-4" />
          {t("common.logout")}
        </Button>
      </div>
    </>
  );
}
