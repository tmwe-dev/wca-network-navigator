/**
 * LayoutSidebarNav — Navigation groups for the sidebar
 */
import * as React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { prefetchRoute } from "@/lib/prefetchRoutes";
import { LogOut, Command, Wifi, WifiOff, Sun, Moon, Compass } from "lucide-react";
import { Button } from "../atoms/Button";
import { navGroupsDef } from "./navConfig";
import { MainMenu } from "./MainMenu";

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
}

export function LayoutSidebarNav({
  profileName,
  wcaStatusColor,
  wcaStatusLabel,
  wcaSessionActive,
  onWcaReconnect,
  isDark,
  onToggleTheme,
  onSignOut,
  onMobileClose,
  onOpenCommandPalette,
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
            {profileName ? <p className="text-[10px] text-muted-foreground truncate">{profileName}</p> : null}
          </div>
        </div>
      </div>
      {onOpenCommandPalette && (
        <button
          onClick={() => {
            onOpenCommandPalette();
            onMobileClose?.();
          }}
          className="mx-3 mt-2 mb-1 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/15 transition-colors"
          aria-label="Apri ricerca rapida"
          data-testid="sidebar-command-button"
        >
          <Command className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Cerca rapida</span>
          <kbd className="hidden sm:inline-flex h-4 items-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </button>
      )}
      <div className="flex-1 min-h-0 overflow-hidden">
        <MainMenu onNavigate={onMobileClose} />
      </div>
      <div className="p-2 border-t border-border/50 space-y-1">
        <div className="mx-1 mb-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] leading-tight text-amber-700 dark:text-amber-400">
          Versione legacy: usala solo per funzioni non ancora in V3.
        </div>
        <button
          onClick={() => {
            navigate("/v3/inbox");
            onMobileClose?.();
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          <Compass className="h-3.5 w-3.5" />
          Vai alla V3 (operativo)
        </button>
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
