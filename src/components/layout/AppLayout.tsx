import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { CreditCounter } from "./CreditCounter";
import { ActiveProcessIndicator } from "./ActiveProcessIndicator";
import { CommandPalette } from "@/components/CommandPalette";
import { Search, Menu } from "lucide-react";
import { useDeepSearchRunner, DeepSearchContext } from "@/hooks/useDeepSearchRunner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();
  const deepSearch = useDeepSearchRunner();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const currentPath = location.pathname;
  const isHomeRoute = currentPath === "/";
  const isCampaignsPage = currentPath === "/campaigns";
  const isOperationsRoute = currentPath === "/operations";

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <DeepSearchContext.Provider value={deepSearch}>
      <div className="flex min-h-screen w-full bg-background" onClick={() => sidebarOpen && setSidebarOpen(false)}>
        {!isHomeRoute && (
          <div
            className={`fixed left-0 top-0 z-50 h-full transition-transform duration-200 ease-out ${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            }`}
            onMouseLeave={() => setSidebarOpen(false)}
          >
            <AppSidebar collapsed={false} onToggle={() => setSidebarOpen(false)} />
          </div>
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!isHomeRoute && (
            <header className="sticky top-0 z-30 h-12 border-b border-border bg-background/80 backdrop-blur-md">
              <div className="flex h-full items-center justify-between px-4">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setSidebarOpen((o) => !o)}
                    aria-label="Toggle sidebar"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  <ActiveProcessIndicator />
                  <div id="campaign-header-controls" className="flex min-w-0 flex-1 items-center gap-3" />
                </div>
                <div className="flex items-center gap-2">
                  <CreditCounter />
                  {!isCampaignsPage && (
                    <button
                      onClick={() => setCommandOpen(true)}
                      className="flex h-8 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Search…</span>
                      <kbd className="hidden h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground/70 sm:inline-flex">
                        ⌘K
                      </kbd>
                    </button>
                  )}
                </div>
              </div>
            </header>
          )}

          <main
            className={cn(
              "flex-1 min-h-0",
              isHomeRoute ? "overflow-hidden" : isOperationsRoute ? "overflow-hidden" : "overflow-auto p-4"
            )}
          >
            <Outlet />
          </main>
        </div>

        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </DeepSearchContext.Provider>
  );
}
