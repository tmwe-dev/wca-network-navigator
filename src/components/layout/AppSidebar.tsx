import { useState, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Users,
  Calendar,
  Download,
  Mail,
  Globe,
  HardDriveDownload,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Settings,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useActiveJobCount } from "@/hooks/useDownloadJobs";
import { useWcaSessionStatus } from "@/hooks/useWcaSessionStatus";

const navItems = [
  { title: "Partner", url: "/", icon: Globe },
  { title: "Campaigns", url: "/campaigns", icon: Mail },
  { title: "Download", url: "/download-management", icon: HardDriveDownload, badgeKey: "download" },
  { title: "Reminders", url: "/reminders", icon: Calendar },
  { title: "Export", url: "/export", icon: Download },
  { title: "Impostazioni", url: "/settings", icon: Settings },
  { title: "WCA", url: "/wca", icon: Wifi },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);
  const activeJobCount = useActiveJobCount();
  const { status: wcaStatus, triggerCheck, checkedAt } = useWcaSessionStatus();

  // Trigger a check on mount
  useEffect(() => {
    triggerCheck();
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <aside
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 h-screen sticky top-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center h-16 px-4 border-b border-sidebar-border",
        collapsed ? "justify-center" : "gap-3"
      )}>
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-sidebar-primary">
          <Globe className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="font-semibold text-sm">WCA Partners</span>
            <span className="text-xs text-sidebar-foreground/70">CRM</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = location.pathname === item.url;
          const showBadge = item.badgeKey === "download" && activeJobCount > 0;
          
          const NavItem = (
            <Link
              key={item.title}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="flex-1">{item.title}</span>}
              {showBadge && (
                <span className={cn(
                  "flex items-center justify-center rounded-full text-[10px] font-bold text-white bg-amber-500 animate-pulse",
                  collapsed ? "absolute -top-1 -right-1 w-4 h-4" : "w-5 h-5"
                )}>
                  {activeJobCount}
                </span>
              )}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.title} delayDuration={0}>
                <TooltipTrigger asChild>{NavItem}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.title}
                  {showBadge && ` (${activeJobCount} attivi)`}
                </TooltipContent>
              </Tooltip>
            );
          }

          return NavItem;
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border space-y-1">
      {/* WCA Session Status */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {wcaStatus === "expired" || wcaStatus === "no_cookie" ? (
              <Link
                to="/settings"
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  "text-destructive hover:bg-destructive/10",
                  collapsed && "justify-center px-0"
                )}
              >
                <span className="relative flex-shrink-0">
                  <WifiOff className="w-4 h-4" />
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
                </span>
                {!collapsed && <span>WCA Scaduto</span>}
              </Link>
            ) : (
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium",
                  wcaStatus === "ok" ? "text-emerald-500" : "text-muted-foreground",
                  collapsed && "justify-center px-0"
                )}
              >
                <span className="relative flex-shrink-0">
                  <Wifi className="w-4 h-4" />
                  {wcaStatus === "ok" && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </span>
                {!collapsed && (
                  <span>{wcaStatus === "ok" ? "WCA Connesso" : "Verifica..."}</span>
                )}
              </div>
            )}
          </TooltipTrigger>
          <TooltipContent side="right">
            {wcaStatus === "ok" ? "Sessione WCA attiva" :
             wcaStatus === "expired" ? "Cookie WCA scaduto - clicca per aggiornare" :
             wcaStatus === "no_cookie" ? "Nessun cookie WCA - clicca per configurare" :
             "Verifica sessione in corso..."}
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTheme}
              className={cn(
                "w-full text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed ? "justify-center px-0" : "justify-start"
              )}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {!collapsed && <span className="ml-3">{isDark ? "Light Mode" : "Dark Mode"}</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">
              {isDark ? "Light Mode" : "Dark Mode"}
            </TooltipContent>
          )}
        </Tooltip>

        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className={cn(
                "w-full text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                collapsed ? "justify-center px-0" : "justify-start"
              )}
            >
              {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
              {!collapsed && <span className="ml-3">Collapse</span>}
            </Button>
          </TooltipTrigger>
          {collapsed && (
            <TooltipContent side="right">Expand</TooltipContent>
          )}
        </Tooltip>
      </div>
    </aside>
  );
}
