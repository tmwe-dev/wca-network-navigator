import { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Download,
  Search,
  Star,
  Globe,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Partners", url: "/partners", icon: Users },
  { title: "Reminders", url: "/reminders", icon: Calendar },
  { title: "Export", url: "/export", icon: Download },
];

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function AppSidebar({ collapsed, onToggle }: AppSidebarProps) {
  const location = useLocation();
  const [isDark, setIsDark] = useState(false);

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
          const NavItem = (
            <Link
              key={item.title}
              to={item.url}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span>{item.title}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.title} delayDuration={0}>
                <TooltipTrigger asChild>{NavItem}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.title}
                </TooltipContent>
              </Tooltip>
            );
          }

          return NavItem;
        })}
      </nav>

      {/* Footer */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
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
