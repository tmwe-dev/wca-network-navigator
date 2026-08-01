/**
 * MobileBottomNav — Fixed bottom navigation for mobile (<768px)
 * Shows 4 destinations + central Mission button (opens MissionDrawer).
 * Items are derived from the canonical navConfig (single source of truth).
 */
import { useNavigate, useLocation } from "react-router-dom";
import { Target } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { navGroupsDef, mobileBottomNavPaths, type NavItemDef } from "@/v2/ui/templates/navConfig";

const allItems: readonly NavItemDef[] = navGroupsDef.flatMap((g) => g.items);
const NAV_ITEMS: readonly NavItemDef[] = mobileBottomNavPaths
  .map((p) => allItems.find((i) => i.path === p))
  .filter((i): i is NavItemDef => Boolean(i));

export function MobileBottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const isActive = (path: string) =>
    path === "/v2" ? location.pathname === "/v2" : location.pathname.startsWith(path);

  const openMission = () => {
    window.dispatchEvent(new CustomEvent("open-drawer", { detail: { drawer: "mission" } }));
  };

  const left = NAV_ITEMS.slice(0, 2);
  const right = NAV_ITEMS.slice(2);

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/95 backdrop-blur-md safe-area-bottom"
    >
      <div className="flex items-end justify-around h-16">
        {left.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn(active && "drop-shadow-sm")}>{item.icon}</span>
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
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className={cn(active && "drop-shadow-sm")}>{item.icon}</span>
              <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
