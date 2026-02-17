import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { CreditCounter } from "./CreditCounter";
import { CommandPalette } from "@/components/CommandPalette";
import { Search, Globe, Users, Bell, Mail, Download, BookOpen, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

const PAGE_INFO: Record<string, { title: string; icon: React.ReactNode }> = {
  "/": { title: "Partner Hub", icon: <Globe className="w-5 h-5" /> },
  "/campaigns": { title: "Email Campaigns", icon: <Mail className="w-5 h-5" /> },
  "/acquisizione": { title: "Acquisizione Partner", icon: <Download className="w-5 h-5" /> },
  "/reminders": { title: "Agenda", icon: <Bell className="w-5 h-5" /> },
  "/settings": { title: "Impostazioni", icon: <Settings className="w-5 h-5" /> },
  "/guida": { title: "Guida Progetto", icon: <BookOpen className="w-5 h-5" /> },
  "/campaign-jobs": { title: "Campaign Jobs", icon: <Mail className="w-5 h-5" /> },
};

export function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();

  // Get current page info
  const currentPath = location.pathname;
  const pageInfo = PAGE_INFO[currentPath] || PAGE_INFO["/"];
  const isDarkPage = currentPath === "/campaigns";
  const isCampaignsPage = isDarkPage;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className={`sticky top-0 z-40 h-16 border-b ${isCampaignsPage ? 'bg-slate-900/95 border-amber-500/20' : 'bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-border'}`}>
          <div className="flex items-center gap-4 h-full px-6">
            {/* Page title */}
            <div className={`flex items-center gap-2 ${isCampaignsPage ? 'text-amber-400' : 'text-foreground'}`}>
              {pageInfo.icon}
              <h1 className="text-lg">{pageInfo.title}</h1>
            </div>

            {/* Campaign controls slot - will be filled by portal */}
            <div id="campaign-header-controls" className="flex items-center gap-4 flex-1" />

            {/* Credit counter */}
            <CreditCounter />

            {/* Search - hide on campaigns page */}
            {!isCampaignsPage && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCommandOpen(true)}
                className="w-64 justify-start text-muted-foreground"
              >
                <Search className="w-4 h-4 mr-2" />
                <span>Search partners...</span>
                <kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
            )}
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
    </div>
  );
}
