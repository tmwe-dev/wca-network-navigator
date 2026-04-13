/**
 * MobileBottomNav — Fixed bottom navigation for mobile (<768px)
 * Shows 5 core destinations with active state highlighting.
 */
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, Mail, BrainCircuit, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { labelKey: "nav.dashboard", path: "/v2", icon: LayoutDashboard, exact: true },
  { labelKey: "nav.crm", path: "/v2/crm", icon: Users },
  { labelKey: "nav.outreach", path: "/v2/outreach", icon: Mail },
  { labelKey: "nav.email_intelligence", path: "/v2/email-intelligence", icon: BrainCircuit },
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

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path, item.exact);
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
