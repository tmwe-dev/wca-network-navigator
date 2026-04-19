/**
 * MobileBottomNav — Fixed bottom navigation for mobile (<768px)
 * Shows 4 destinations + central Mission button (opens MissionDrawer).
 */
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Mail, Settings, Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { labelKey: "nav.dashboard", path: "/v2", icon: LayoutDashboard, exact: true },
  { labelKey: "nav.crm", path: "/v2/crm", icon: Users },
  { labelKey: "nav.outreach", path: "/v2/outreach", icon: Mail },
  { labelKey: "nav.settings", path: "/v2/settings", icon: Settings },
] as const;

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string, exact: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const openMission = () => {
    window.dispatchEvent(new CustomEvent("open-drawer", { detail: { drawer: "mission" } }));
  };

  // Layout: 2 voci + Mission centrale + 2 voci
  const left = NAV_ITEMS.slice(0, 2);
  const right = NAV_ITEMS.slice(2);

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/95 backdrop-blur-md safe-area-bottom"
    >
      <div className="flex items-end justify-around h-16">
        {left.map((item) => {
          const Icon = item.icon;
          const hasExact = "exact" in item && item.exact;
          const active = isActive(item.path, !!hasExact);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-sm")} />
              <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
            </button>
          );
        })}

        {/* Mission Control — central FAB */}
        <button
          onClick={openMission}
          aria-label="Mission Control"
          className="relative flex flex-col items-center justify-center -mt-5 min-h-[56px] w-14"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/30 ring-4 ring-background">
            <Target className="h-5 w-5" />
          </span>
          <span className="text-[10px] font-medium leading-tight text-muted-foreground mt-0.5">Mission</span>
        </button>

        {right.map((item) => {
          const Icon = item.icon;
          const hasExact = "exact" in item && item.exact;
          const active = isActive(item.path, !!hasExact);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-sm")} />
              <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
