/**
 * AuthenticatedLayout template — STEP 4
 * Layout con guard auth, sidebar, header.
 */

import * as React from "react";
import { useEffect } from "react";
import { useNavigate, Outlet } from "react-router-dom";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { cn } from "@/lib/utils";
import {
  Globe, Users, Mail, Bot, Megaphone, Settings,
  Activity, LogOut, LayoutDashboard,
} from "lucide-react";
import { Button } from "../atoms/Button";

// ── Sidebar nav items ────────────────────────────────────────────────

interface NavItem {
  readonly label: string;
  readonly path: string;
  readonly icon: React.ReactNode;
}

const navItems: readonly NavItem[] = [
  { label: "Dashboard", path: "/v2", icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: "Network", path: "/v2/network", icon: <Globe className="h-4 w-4" /> },
  { label: "CRM", path: "/v2/crm", icon: <Users className="h-4 w-4" /> },
  { label: "Outreach", path: "/v2/outreach", icon: <Mail className="h-4 w-4" /> },
  { label: "Agenti", path: "/v2/agents", icon: <Bot className="h-4 w-4" /> },
  { label: "Campagne", path: "/v2/campaigns", icon: <Megaphone className="h-4 w-4" /> },
  { label: "Diagnostica", path: "/v2/diagnostics", icon: <Activity className="h-4 w-4" /> },
  { label: "Impostazioni", path: "/v2/settings", icon: <Settings className="h-4 w-4" /> },
];

// ── Component ────────────────────────────────────────────────────────

export function AuthenticatedLayout(): React.ReactElement | null {
  const { isAuthenticated, isLoading, profile, signOut } = useAuthV2();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate("/v2/login", { replace: true });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="hidden md:flex w-60 flex-col border-r bg-card">
        <div className="p-4 border-b">
          <h2 className="text-lg font-bold text-foreground">WCA v2</h2>
          {profile?.displayName ? (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{profile.displayName}</p>
          ) : null}
        </div>
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {navItems.map((navItem) => (
            <button
              key={navItem.path}
              onClick={() => navigate(navItem.path)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {navItem.icon}
              {navItem.label}
            </button>
          ))}
        </nav>
        <div className="p-2 border-t">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Esci
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
