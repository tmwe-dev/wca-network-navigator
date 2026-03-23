import { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { CreditCounter } from "./CreditCounter";
import { ActiveProcessIndicator } from "./ActiveProcessIndicator";
import { CommandPalette } from "@/components/CommandPalette";
import { Search, Menu, Bot, Send, Calendar, Layers, Sparkles } from "lucide-react";
import { useDeepSearchRunner, DeepSearchContext } from "@/hooks/useDeepSearchRunner";
import { useJobHealthMonitor } from "@/hooks/useJobHealthMonitor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AiAssistantDialog } from "@/components/operations/AiAssistantDialog";
import { toast } from "@/hooks/use-toast";

const IntelliFlowOverlay = lazy(() => import("@/components/intelliflow/IntelliFlowOverlay"));

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [intelliflowOpen, setIntelliflowOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const deepSearch = useDeepSearchRunner();
  useJobHealthMonitor();

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const currentPath = location.pathname;
  const isHomeRoute = currentPath === "/";
  const isCampaignsPage = currentPath === "/campaigns";
  const isFullscreenRoute = ["/", "/network", "/crm", "/outreach", "/agenda", "/operations", "/global", "/reminders", "/settings", "/import", "/hub-operativo", "/email-composer"].includes(currentPath);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setCommandOpen((o) => !o); }
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setAiOpen((o) => !o); }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Global listener for AI UI actions
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      switch (detail.action_type) {
        case "navigate": if (detail.path) navigate(detail.path); break;
        case "show_toast": toast({ title: detail.toast_type === "error" ? "⚠️ Errore" : "✅ Fatto", description: detail.message || "" }); break;
        case "apply_filters": window.dispatchEvent(new CustomEvent("ai-command", { detail: { filters: detail.filters } })); break;
        // V3: No auto-start downloads from AI — user starts manually
      }
    };
    window.addEventListener("ai-ui-action", handler);
    return () => window.removeEventListener("ai-ui-action", handler);
  }, [navigate]);

  return (
    <DeepSearchContext.Provider value={deepSearch}>
      <div className="flex min-h-screen w-full bg-background" onClick={() => sidebarOpen && setSidebarOpen(false)}>
        <div className={`fixed left-0 top-0 z-50 h-full transition-transform duration-200 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} onMouseLeave={() => setSidebarOpen(false)}>
          <AppSidebar collapsed={false} onToggle={() => setSidebarOpen(false)} />
        </div>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!isHomeRoute && (
            <header className="sticky top-0 z-30 h-11 sm:h-12 border-b border-border bg-background/80 backdrop-blur-md">
              <div className="flex h-full items-center justify-between px-2 sm:px-4">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 shrink-0" onClick={() => setSidebarOpen((o) => !o)} aria-label="Toggle sidebar"><Menu className="h-4 w-4" /></Button>
                  <ActiveProcessIndicator />
                  <div id="campaign-header-controls" className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3" />
                </div>
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <CreditCounter />
                  <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate("/workspace")} aria-label="Workspace"><Layers className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate("/email-composer")} aria-label="Email"><Send className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="hidden sm:inline-flex h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate("/reminders")} aria-label="Agenda"><Calendar className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground" onClick={() => setAiOpen(true)} aria-label="AI Assistant"><Bot className="h-4 w-4" /></Button>
                  {!isCampaignsPage && (
                    <button onClick={() => setCommandOpen(true)} className="hidden sm:flex h-8 items-center gap-2 rounded-md border border-border bg-muted/40 px-3 text-[13px] text-muted-foreground transition-colors hover:bg-muted">
                      <Search className="h-3.5 w-3.5" /><span className="hidden md:inline">Search…</span>
                      <kbd className="hidden md:inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] text-muted-foreground/70">⌘K</kbd>
                    </button>
                  )}
                </div>
              </div>
            </header>
          )}

          <main className={cn("flex-1 min-h-0", isFullscreenRoute ? "overflow-hidden" : "overflow-auto p-4")}>
            <Outlet />
          </main>
        </div>

        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
        <AiAssistantDialog open={aiOpen} onClose={() => setAiOpen(false)} context={{ selectedCountries: [], filterMode: currentPath }} />

        <motion.button
          onClick={() => setIntelliflowOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all duration-300"
          style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))", border: "1px solid hsl(var(--primary) / 0.2)", boxShadow: "0 0 30px hsl(var(--primary) / 0.1), 0 8px 32px -8px hsl(0 0% 0% / 0.4)" }}
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
          aria-label="IntelliFlow Workspace"
        >
          <Sparkles className="w-5 h-5 text-primary/70" />
        </motion.button>

        <Suspense fallback={null}>
          <IntelliFlowOverlay open={intelliflowOpen} onClose={() => setIntelliflowOpen(false)} />
        </Suspense>
      </div>
    </DeepSearchContext.Provider>
  );
}
