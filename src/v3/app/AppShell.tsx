/**
 * AppShell V3 — top bar globale unica + guard di accesso + navigazione.
 *
 * La top bar è l'unica dell'app: le maschere non ne montano una propria
 * (vedi PageFrame). Il titolo arriva dal contratto di pagina, non dalle pagine.
 */
import * as React from "react";
import { Link, Navigate, Outlet, useLocation, matchPath } from "react-router-dom";
import { Loader2, LogOut, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import "@/v3/ui/theme.css";
import { supabase } from "@/integrations/supabase/client";
import {
  V3_IMPLEMENTED_PAGES,
  V3_MODULE_LABELS,
  V3_PAGES,
  type V3ModuleId,
  type V3PageDefinition,
} from "./pageContract";

const MODULE_ORDER: readonly V3ModuleId[] = [
  "identita",
  "contatti",
  "messaggi",
  "comprensione",
  "risposta",
  "programmazione",
  "tracciamento",
  "trasversale",
];

function useCurrentPage(): V3PageDefinition | null {
  const { pathname } = useLocation();
  return React.useMemo(() => {
    for (const page of Object.values(V3_PAGES) as V3PageDefinition[]) {
      if (matchPath({ path: page.path, end: true }, pathname)) return page;
    }
    return null;
  }, [pathname]);
}

function NavigationList({ onNavigate }: { onNavigate: () => void }) {
  const { pathname } = useLocation();
  const grouped = React.useMemo(() => {
    const map = new Map<V3ModuleId, V3PageDefinition[]>();
    for (const [, page] of V3_IMPLEMENTED_PAGES) {
      if (page.publicRoute) continue;
      const list = map.get(page.module) ?? [];
      list.push(page);
      map.set(page.module, list);
    }
    return map;
  }, []);

  return (
    <nav className="space-y-4 p-3">
      {MODULE_ORDER.filter((module) => grouped.has(module)).map((module) => (
        <div key={module} className="space-y-1">
          <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {V3_MODULE_LABELS[module]}
          </p>
          {(grouped.get(module) ?? []).map((page) => (
            <Link
              key={page.path}
              to={page.path}
              onClick={onNavigate}
              className={cn(
                "block rounded-md border px-2 py-1.5 text-left text-sm transition-colors",
                pathname === page.path
                  ? "border-primary/60 bg-primary/20 font-medium text-foreground"
                  : "border-transparent text-muted-foreground hover:border-accent/60 hover:bg-accent/15 hover:text-foreground",
              )}
            >
              {page.title}
            </Link>
          ))}
        </div>
      ))}

      <div className="space-y-1 border-t border-border pt-3">
        <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Altro</p>
        <Link
          to="/v2/command"
          onClick={onNavigate}
          className="block rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          Torna alla V2
        </Link>
      </div>
    </nav>
  );
}

export function AppShell(): React.ReactElement {
  const location = useLocation();
  const { status, user } = useAuth();
  const page = useCurrentPage();
  const [navOpen, setNavOpen] = React.useState(false);

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to={V3_PAGES.login.path} state={{ from: location.pathname }} replace />;
  }

  return (
    <div className="v3-root flex h-screen flex-col overflow-hidden text-foreground">
      <header className="v3-glass-plain flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
        <Sheet open={navOpen} onOpenChange={setNavOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Apri navigazione">
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="v3-root w-64 p-0">
            <SheetHeader className="border-b border-border p-3">
              <SheetTitle className="text-sm">Navigator V3</SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-[calc(100%-3.25rem)]">
              <NavigationList onNavigate={() => setNavOpen(false)} />
            </ScrollArea>
          </SheetContent>
        </Sheet>

        <span className="truncate text-sm font-semibold">{page?.title ?? "Navigator"}</span>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground sm:inline">
            {user?.email ?? ""}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Esci"
            onClick={() => void supabase.auth.signOut()}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

export default AppShell;
