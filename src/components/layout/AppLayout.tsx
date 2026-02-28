import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AppSidebar } from "./AppSidebar";
import { CreditCounter } from "./CreditCounter";
import { CommandPalette } from "@/components/CommandPalette";
import { Search } from "lucide-react";
import { useDeepSearchRunner, DeepSearchContext } from "@/hooks/useDeepSearchRunner";

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const location = useLocation();
  const deepSearch = useDeepSearchRunner();

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const currentPath = location.pathname;
  const isCampaignsPage = currentPath === "/campaigns";
  const isOperationsRoute = currentPath === "/" || currentPath === "/operations";

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
      <div className="flex min-h-screen w-full bg-background">
        {/* Hover trigger */}
        <div
          className="fixed left-0 top-0 w-[3px] h-full z-50"
          onMouseEnter={() => setSidebarOpen(true)}
        />

        {/* Backdrop */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-[2px]"
              onClick={() => setSidebarOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Sidebar drawer */}
        <div
          className={`fixed left-0 top-0 h-full z-50 transition-transform duration-200 ease-out ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          onMouseLeave={() => setSidebarOpen(false)}
        >
          <AppSidebar collapsed={false} onToggle={() => setSidebarOpen(false)} />
        </div>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Top bar */}
          <header className="sticky top-0 z-30 h-12 border-b border-border bg-background/80 backdrop-blur-md">
            <div className="flex items-center justify-between h-full px-4">
              <div id="campaign-header-controls" className="flex items-center gap-3 flex-1 min-w-0" />
              <div className="flex items-center gap-2">
                <CreditCounter />
                {!isCampaignsPage && (
                  <button
                    onClick={() => setCommandOpen(true)}
                    className="flex items-center gap-2 h-8 px-3 rounded-md border border-border bg-muted/40 text-muted-foreground text-[13px] hover:bg-muted transition-colors"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Search…</span>
                    <kbd className="hidden sm:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground/70">
                      ⌘K
                    </kbd>
                  </button>
                )}
              </div>
            </div>
          </header>

          {/* Content with page transitions */}
          <main
            className={`flex-1 min-h-0 ${
              isOperationsRoute ? "overflow-hidden" : "p-4 overflow-auto"
            }`}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </div>
    </DeepSearchContext.Provider>
  );
}
