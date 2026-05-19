/**
 * NavMenuPopover — Dropdown di navigazione globale, identico in tutte le
 * pagine. Usato sia in CommandPage (trigger custom "Menu" fixed top-left)
 * sia in LayoutHeader (trigger ☰ standard).
 *
 * Single source of truth: navItemsDef.
 */
import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Layers, LogOut, Search, X } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { navItemsDef } from "./navConfig";
import { useAuthV2 } from "@/v2/hooks/useAuthV2";
import { ThemePicker } from "@/v2/ui/theme/ThemePicker";
import {
  SECONDARY_NAV,
  findSecondaryNavGroup,
  type SecondaryNavGroup,
} from "@/v2/navigation/registry";
import { useNavBadgeCountsV2, badgeForPath } from "@/v2/hooks/useNavBadgeCountsV2";

const DEV_PAGE_GROUPS = SECONDARY_NAV;

/**
 * Mappa pagine principali con sotto-cartelle navigabili inline nel popover
 * (stesso comportamento di "Development").
 */
export const EXPANDABLE_MAIN_NAV: Record<string, readonly SecondaryNavGroup[]> = {
  // Config → tab della pagina /v2/settings
  "/v2/settings": [
    { title: "Generali", items: [
      { label: "Generale",         path: "/v2/settings?tab=generale" },
      { label: "Connessioni",      path: "/v2/settings?tab=wca" },
      { label: "Estensioni",       path: "/v2/settings?tab=estensioni" },
      { label: "Report Aziende",   path: "/v2/settings?tab=reportaziende" },
      { label: "Notifiche",        path: "/v2/settings?tab=notifiche" },
      { label: "Timing & Schedule",path: "/v2/settings?tab=timing" },
    ]},
    { title: "Agenti", items: [
      { label: "Voce AI",          path: "/v2/settings?tab=voce-ai" },
      { label: "AI & Prompt",      path: "/v2/settings?tab=ai-prompt" },
      { label: "Provider AI",      path: "/v2/settings?tab=provider-ai" },
    ]},
    { title: "Update", items: [
      { label: "Arricchimento",    path: "/v2/settings?tab=enrichment" },
    ]},
    { title: "Import & Export", items: [
      { label: "Backup & Export",  path: "/v2/settings?tab=backup-export" },
      { label: "Importa",          path: "/v2/settings?tab=import-export" },
    ]},
    { title: "Contatori", items: [
      { label: "AI Monitor",       path: "/v2/settings?tab=ai-monitor" },
      { label: "Processi Automatici", path: "/v2/settings?tab=processi-automatici" },
      { label: "Token AI",         path: "/v2/settings?tab=token-ai" },
      { label: "Memoria AI",       path: "/v2/settings?tab=memoria-ai" },
    ]},
    { title: "Report", items: [
      { label: "Audit Trail",      path: "/v2/settings?tab=audit" },
      { label: "Jobs Operativi",   path: "/v2/settings?tab=guida-operativa" },
    ]},
    { title: "Posta", items: [
      { label: "Download Email",   path: "/v2/settings?tab=download-email" },
      { label: "Caselle Aziendali",path: "/v2/settings?tab=caselle-aziendali" },
    ]},
    { title: "Master", items: [
      { label: "Development",      path: "/v2/settings?tab=development" },
    ]},
    { title: "TEST", items: [
      { label: "Lab & Verifiche",  path: "/v2/settings?tab=lab" },
    ]},
    { title: "Team", items: [
      { label: "Operatori",        path: "/v2/settings?tab=operatori" },
      { label: "Ruoli & Permessi", path: "/v2/settings?tab=ruoli" },
      { label: "Ruoli Utenti",     path: "/v2/settings?tab=ruoli-utenti" },
      { label: "Utenti Autorizzati", path: "/v2/settings?tab=utenti" },
      { label: "Team",             path: "/v2/settings?tab=team" },
    ]},
  ],
  // Agenti / Missioni → riusa il gruppo della SECONDARY_NAV
  "/v2/agents/autopilot": (
    SECONDARY_NAV.find((g) => g.title === "Agenti & Missioni")?.subGroups?.map((sg) => ({
      title: sg.title,
      items: sg.items,
    })) ?? []
  ),
  "/v2/funnemail": [
    { title: "Funnemail", items: [
      { label: "Hub", path: "/v2/funnemail" },
      { label: "Posta in arrivo", path: "/v2/funnemail-inbox" },
      { label: "Da smistare", path: "/v2/funnemail-inbox/sorting" },
      { label: "Mail Playground", path: "/v2/funnemail/playground" },
      { label: "Statistiche mittenti", path: "/v2/funnemail/statistiche-mittenti" },
      { label: "Intelligence", path: "/v2/email-intelligence" },
    ]},
  ],
};

/** Estrae la radice di sezione: `/v2/intelligence/agents` → `/v2/intelligence`. */
export function sectionRoot(path: string): string {
  if (path.startsWith("/v2/funnemail") || path.startsWith("/v2/email-intelligence")) {
    return "/v2/funnemail";
  }
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return "/v2";
  return `/${parts[0]}/${parts[1]}`;
}

interface NavMenuPopoverProps {
  /** Trigger element (e.g. icon button). Renders inside <PopoverTrigger asChild>. */
  children: React.ReactNode;
  /** Path corrente, usato per nascondere la voce attiva. */
  currentPath?: string;
  /** Allineamento del contenuto rispetto al trigger. Default: start. */
  align?: "start" | "center" | "end";
  /** Lato in cui aprire il popover. Default: bottom. */
  side?: "top" | "right" | "bottom" | "left";
}

export function NavMenuPopover({
  children,
  currentPath,
  align = "start",
  side = "bottom",
}: NavMenuPopoverProps): React.ReactElement {
  const nav = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [devOpen, setDevOpen] = useState(false);
  const { signOut } = useAuthV2();
  const { data: badgeCounts } = useNavBadgeCountsV2();
  const [query, setQuery] = useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);

  const handleSelect = (path: string) => {
    setOpen(false);
    setQuery("");
    nav(path);
  };

  const activeRoot = currentPath ? sectionRoot(currentPath) : null;
  const activeGroupTitle = React.useMemo(
    () => findSecondaryNavGroup(currentPath ?? null),
    [currentPath],
  );
  const isInDev = activeGroupTitle !== null;
  const [openGroup, setOpenGroup] = React.useState<string | null>(activeGroupTitle);
  const [expandedMain, setExpandedMain] = React.useState<Record<string, boolean>>({});
  const [openSubInMain, setOpenSubInMain] = React.useState<Record<string, string | null>>({});
  React.useEffect(() => {
    if (isInDev) {
      setDevOpen(true);
      setOpenGroup(activeGroupTitle);
    }
  }, [isInDev, activeGroupTitle]);
  React.useEffect(() => {
    // Auto-espandi la voce principale che contiene la rotta corrente
    if (!currentPath) return;
    const next: Record<string, boolean> = {};
    for (const [parentPath] of Object.entries(EXPANDABLE_MAIN_NAV)) {
      if (currentPath.startsWith(parentPath)) next[parentPath] = true;
    }
    if (Object.keys(next).length > 0) {
      setExpandedMain((prev) => ({ ...prev, ...next }));
    }
  }, [currentPath]);

  // Indice piatto per ricerca su tutte le voci (principali, sotto-cartelle,
  // tab Config, pagine Development).
  type SearchEntry = { label: string; path: string; trail: string };
  const searchIndex = React.useMemo<SearchEntry[]>(() => {
    const out: SearchEntry[] = [];
    for (const item of navItemsDef) {
      const translated = t(item.labelKey);
      const label = translated === item.labelKey
        ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
        : translated;
      out.push({ label, path: item.path, trail: label });
      const sub = EXPANDABLE_MAIN_NAV[item.path];
      if (sub) {
        for (const g of sub) {
          for (const it of g.items ?? []) {
            out.push({ label: it.label, path: it.path, trail: `${label} › ${g.title}` });
          }
        }
      }
    }
    for (const group of DEV_PAGE_GROUPS) {
      for (const it of group.items ?? []) {
        out.push({ label: it.label, path: it.path, trail: `Development › ${group.title}` });
      }
      for (const sg of group.subGroups ?? []) {
        for (const it of sg.items) {
          out.push({ label: it.label, path: it.path, trail: `Development › ${group.title} › ${sg.title}` });
        }
      }
    }
    // Dedup per path
    const seen = new Set<string>();
    return out.filter((e) => (seen.has(e.path) ? false : (seen.add(e.path), true)));
  }, [t]);

  const q = query.trim().toLowerCase();
  const results = React.useMemo(() => {
    if (!q) return [] as SearchEntry[];
    return searchIndex
      .filter((e) => e.label.toLowerCase().includes(q) || e.trail.toLowerCase().includes(q))
      .slice(0, 30);
  }, [q, searchIndex]);

  React.useEffect(() => {
    if (open) {
      const id = setTimeout(() => searchRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
    setQuery("");
  }, [open]);

  // Notifica globale apertura/chiusura per nascondere overlay concorrenti
  // (es. linguetta filtri ContextFiltersRail).
  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent("nav-menu-open-change", { detail: { open } }));
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        className="w-72 p-1 bg-background/95 backdrop-blur-xl border-white/10 max-h-[80vh] overflow-y-auto"
      >
        <div className="flex flex-col">
          {/* Barra di ricerca */}
          <div className="relative px-1 pb-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && results.length > 0) {
                  e.preventDefault();
                  handleSelect(results[0].path);
                } else if (e.key === "Escape" && query) {
                  e.preventDefault();
                  setQuery("");
                }
              }}
              placeholder="Cerca pagina…"
              className="w-full h-8 pl-8 pr-7 text-xs rounded-md bg-muted/40 border border-white/10 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 inline-flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5"
                aria-label="Pulisci"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {q && (
            <div className="flex flex-col pb-1">
              {results.length === 0 ? (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">
                  Nessun risultato per "{query}"
                </div>
              ) : (
                results.map((r) => (
                  <button
                    key={r.path}
                    type="button"
                    onClick={() => handleSelect(r.path)}
                    className="flex flex-col items-start px-3 py-1.5 rounded-md text-left hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    <span className="text-xs font-medium text-foreground">{r.label}</span>
                    <span className="text-[10px] text-muted-foreground">{r.trail}</span>
                  </button>
                ))
              )}
              <div className="my-1 border-t border-white/10" />
            </div>
          )}
          {!q && (
          <>
          {navItemsDef.map((item) => {
              const isActive = sectionRoot(item.path) === activeRoot;
              const translated = t(item.labelKey);
              const label =
                translated === item.labelKey
                  ? item.labelKey.replace(/^nav\./, "").replace(/_/g, " ")
                  : translated;
              const count = badgeForPath(badgeCounts, item.path);
              const expandable = EXPANDABLE_MAIN_NAV[item.path];
              if (expandable && expandable.length > 0) {
                const isOpen = expandedMain[item.path] ?? false;
                const subOpen = openSubInMain[item.path] ?? null;
                return (
                  <div key={item.path}>
                     <button
                       type="button"
                       aria-expanded={isOpen}
                       onClick={() =>
                         setExpandedMain((prev) => ({ ...prev, [item.path]: !isOpen }))
                       }
                       className={
                         "flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left capitalize border-l-2 " +
                         (isActive || isOpen
                           ? "bg-primary/15 text-primary border-primary"
                           : "border-transparent text-foreground/90 hover:bg-primary/10 hover:text-primary hover:border-primary/60")
                       }
                     >
                       <span className={isActive || isOpen ? "text-primary" : "text-primary/70"}>{item.icon}</span>
                      <span className="flex-1">{label}</span>
                      {isOpen ? (
                        <ChevronDown className="h-4 w-4 opacity-60" />
                      ) : (
                        <ChevronRight className="h-4 w-4 opacity-60" />
                      )}
                    </button>
                    {isOpen && (
                      <div className="mt-1 space-y-0.5 pb-1 pl-2 ml-3 border-l border-primary/20">
                        <button
                          type="button"
                          onClick={() => handleSelect(item.path)}
                          className="flex w-full items-center px-3 py-1.5 rounded-md text-xs text-accent-foreground/70 hover:bg-accent/10 hover:text-accent-foreground"
                        >
                          ↳ Apri pagina
                        </button>
                        {expandable.map((group) => {
                          const isGroupOpen = subOpen === group.title;
                          return (
                            <div key={group.title}>
                              <button
                                type="button"
                                aria-expanded={isGroupOpen}
                                onClick={() =>
                                  setOpenSubInMain((prev) => ({
                                    ...prev,
                                    [item.path]: isGroupOpen ? null : group.title,
                                  }))
                                }
                                className={
                                  "flex w-full items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-left transition-colors " +
                                  (isGroupOpen
                                    ? "bg-accent/15 text-accent-foreground"
                                    : "text-accent-foreground/80 hover:bg-accent/10 hover:text-accent-foreground")
                                }
                              >
                                {isGroupOpen ? (
                                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                                ) : (
                                  <ChevronRight className="h-3.5 w-3.5 opacity-60" />
                                )}
                                <span className="flex-1">{group.title}</span>
                              </button>
                              {isGroupOpen && (
                                <div className="ml-5 mt-0.5 mb-1 flex flex-col border-l border-accent/30 pl-2">
                                  {(group.items ?? []).map((sub) => (
                                    <button
                                      key={sub.path}
                                      type="button"
                                      onClick={() => handleSelect(sub.path)}
                                      className="flex items-center px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground text-left"
                                    >
                                      {sub.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <button
                  key={item.path}
                  role="menuitem"
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => handleSelect(item.path)}
                  className={
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left capitalize border-l-2 " +
                    (isActive
                      ? "bg-primary/15 text-primary border-primary"
                      : "border-transparent text-foreground/90 hover:bg-primary/10 hover:text-primary hover:border-primary/60")
                  }
                >
                  <span className={isActive ? "text-primary" : "text-primary/70"}>{item.icon}</span>
                  <span className="flex-1">{label}</span>
                  {count > 0 && (
                    <span
                      className="ml-auto inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30"
                      title={`${count} da gestire`}
                      aria-label={`${count} elementi da gestire`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            onClick={() => setDevOpen((v) => !v)}
            aria-expanded={devOpen}
            className={
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left border-l-2 " +
              (isInDev || devOpen
                ? "bg-primary/15 text-primary border-primary"
                : "border-transparent text-foreground/90 hover:bg-primary/10 hover:text-primary hover:border-primary/60")
            }
          >
            <span className={isInDev || devOpen ? "text-primary" : "text-primary/70"}><Layers className="h-4 w-4" /></span>
            <span className="flex-1">Development</span>
            {devOpen ? <ChevronDown className="h-4 w-4 opacity-60" /> : <ChevronRight className="h-4 w-4 opacity-60" />}
          </button>
          {devOpen && (
            <div className="mt-1 space-y-0.5 pb-1 pl-2 ml-3 border-l border-primary/20">
              {DEV_PAGE_GROUPS.map((group) => {
                const isGroupOpen = openGroup === group.title;
                const isGroupActive = activeGroupTitle === group.title;
                return (
                  <div key={group.title}>
                    <button
                      type="button"
                      onClick={() => setOpenGroup(isGroupOpen ? null : group.title)}
                      aria-expanded={isGroupOpen}
                      className={
                        "flex w-full items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors text-left " +
                        (isGroupActive || isGroupOpen
                          ? "bg-accent/15 text-accent-foreground"
                          : "text-accent-foreground/80 hover:bg-accent/10 hover:text-accent-foreground")
                      }
                    >
                      {isGroupOpen ? <ChevronDown className="h-3.5 w-3.5 opacity-60" /> : <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
                      <span className="flex-1">{group.title}</span>
                    </button>
                    {isGroupOpen && (
                      <div className="ml-5 mt-0.5 mb-1 flex flex-col border-l border-accent/30 pl-2">
                        {(group.items ?? []).map((item) => {
                          const isActive = currentPath === item.path;
                          return (
                            <button
                              key={item.path}
                              type="button"
                              onClick={() => handleSelect(item.path)}
                              aria-current={isActive ? "page" : undefined}
                              className={
                                "flex items-center px-3 py-1.5 rounded-md text-xs transition-colors text-left " +
                                (isActive
                                  ? "bg-primary/15 text-primary font-semibold"
                                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground")
                              }
                            >
                              {item.label}
                            </button>
                          );
                        })}
                        {(group.subGroups ?? []).map((sg) => (
                          <div key={sg.title} className="mt-1">
                            <div className="px-2 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                              {sg.title}
                            </div>
                            <div className="ml-2 flex flex-col border-l border-white/10 pl-2">
                              {sg.items.map((item) => {
                                const isActive = currentPath === item.path;
                                return (
                                  <button
                                    key={item.path}
                                    type="button"
                                    onClick={() => handleSelect(item.path)}
                                    aria-current={isActive ? "page" : undefined}
                                    className={
                                      "flex items-center px-3 py-1.5 rounded-md text-xs transition-colors text-left " +
                                      (isActive
                                        ? "bg-primary/15 text-primary font-semibold"
                                        : "text-foreground/75 hover:bg-white/5 hover:text-foreground")
                                    }
                                  >
                                    {item.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          </>
          )}
          <div className="my-1 border-t border-white/10" />
          <div className="px-1">
            <ThemePicker variant="menu-row" />
          </div>
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-left text-destructive hover:bg-destructive/10"
          >
            <span><LogOut className="h-4 w-4" /></span>
            <span>Logout</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}