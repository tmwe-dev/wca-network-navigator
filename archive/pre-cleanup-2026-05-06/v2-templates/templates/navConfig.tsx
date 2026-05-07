/**
 * navConfig — Single source of truth for V2 navigation.
 *
 * UX Redesign 2026-05-02:
 *   Menu reorder — Command è la nuova landing in cima, segue Esplora,
 *   poi Pipeline (rinominata da "Pipeline CRM"), Comunica, Email Intelligence,
 *   Intelligence, Config. La voce Home (path `/v2`) è nascosta dal menu
 *   ma la rotta resta registrata nel router per backward-compat.
 */
import * as React from "react";
import {
  Command, Search, Mail, Brain, Settings, Inbox, Trash2, CalendarDays, Rocket, Sparkles, BookText, Plug, Database,
} from "lucide-react";

export interface NavItemDef {
  readonly labelKey: string;
  readonly path: string;
  readonly icon: React.ReactNode;
  /** If true, shown in the FloatingDock as a top-level shortcut (deprecated). */
  readonly pinned?: boolean;
  /** Pin order in the dock (lower first). */
  readonly pinOrder?: number;
  /** Optional badge (e.g. "NEW"). */
  readonly badge?: string;
}

export interface NavGroupDef {
  readonly titleKey: string;
  readonly items: readonly NavItemDef[];
}

/** The canonical destinations — flat list (no titled group). */
export const navItemsDef: readonly NavItemDef[] = [
  { labelKey: "nav.command",            path: "/v2/command",            icon: <Command className="h-4 w-4" />,  pinned: true, pinOrder: 1 },
  { labelKey: "nav.finder_api",         path: "/v2/finder-api",         icon: <Plug className="h-4 w-4" />,     pinned: true, pinOrder: 1.5, badge: "NEW" },
  { labelKey: "nav.finder_api_catalog", path: "/v2/finder-api/schema",  icon: <Database className="h-4 w-4" />, pinned: true, pinOrder: 1.6, badge: "443" },
  { labelKey: "nav.explore",            path: "/v2/explore/network",    icon: <Search className="h-4 w-4" />,   pinned: true, pinOrder: 2 },
  { labelKey: "nav.cestinone",          path: "/v2/cestinone",          icon: <Trash2 className="h-4 w-4" />,   pinned: true, pinOrder: 4, badge: "NEW" },
  { labelKey: "nav.cockpit",            path: "/v2/cockpit",            icon: <Rocket className="h-4 w-4" />,   pinned: true, pinOrder: 5 },
  { labelKey: "nav.inbox",              path: "/v2/inbox",              icon: <Inbox className="h-4 w-4" />,    pinned: true, pinOrder: 5.1 },
  { labelKey: "nav.email",              path: "/v2/email",              icon: <Mail className="h-4 w-4" />,     pinned: true, pinOrder: 5.2 },
  { labelKey: "nav.agenda",             path: "/v2/agenda",             icon: <CalendarDays className="h-4 w-4" />, pinned: true, pinOrder: 6 },
  { labelKey: "nav.email_intelligence", path: "/v2/email-intelligence", icon: <Brain className="h-4 w-4" />,    pinned: true, pinOrder: 7 },
  { labelKey: "nav.funnemail_inbox",    path: "/v2/funnemail-inbox",    icon: <Sparkles className="h-4 w-4" />, pinned: true, pinOrder: 7.5, badge: "NEW" },
  { labelKey: "nav.intelligence",       path: "/v2/intelligence",       icon: <Brain className="h-4 w-4" />,    pinned: true, pinOrder: 8 },
  { labelKey: "nav.prompt_reader",      path: "/v2/prompt-reader",      icon: <BookText className="h-4 w-4" />, pinned: true, pinOrder: 8.5, badge: "NEW" },
  { labelKey: "nav.config",             path: "/v2/settings",           icon: <Settings className="h-4 w-4" />, pinned: true, pinOrder: 9 },
] as const;

/**
 * Backward-compat: the sidebar still iterates `navGroupsDef`.
 * We expose the 6 entries as a single unnamed group.
 */
export const navGroupsDef: readonly NavGroupDef[] = [
  { titleKey: "nav.group_main", items: navItemsDef },
];

/** Flat ordered list of pinned items (kept for any legacy importers). */
export const pinnedNavItems: readonly NavItemDef[] = navItemsDef
  .slice()
  .sort((a, b) => (a.pinOrder ?? 999) - (b.pinOrder ?? 999));

/** Helper used by MobileBottomNav for the 4 main destinations. */
export const mobileBottomNavPaths = [
  "/v2/command",
  "/v2/inbox",
  "/v2/cockpit",
  "/v2/settings",
] as const;
