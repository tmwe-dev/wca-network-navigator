/**
 * navConfig — Single source of truth for V2 navigation.
 *
 * Phase 1 of UX Redesign 2026-04-27:
 *   The menu is reduced to **6 destinations** organized by user mission
 *   (Home, Esplora, Pipeline, Comunica, Intelligence, Config).
 *   Each destination owns its sub-tabs internally; no group flyouts.
 *   FloatingDock is deprecated — `pinnedNavItems` mirrors the 6 entries
 *   only for backward-compat callers.
 */
import * as React from "react";
import {
  LayoutDashboard, Command, Search, Kanban, Mail, Brain, Settings, Inbox, Building2, Users, Contact,
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

/** The 6 canonical destinations — flat list (no titled group). */
export const navItemsDef: readonly NavItemDef[] = [
  { labelKey: "nav.home",         path: "/v2",              icon: <LayoutDashboard className="h-4 w-4" />, pinned: true, pinOrder: 1 },
  { labelKey: "nav.command",      path: "/v2/command",      icon: <Command className="h-4 w-4" />,         pinned: true, pinOrder: 2 },
  { labelKey: "nav.wca_partners", path: "/v2/explore/network", icon: <Building2 className="h-4 w-4" />,    pinned: true, pinOrder: 3 },
  { labelKey: "nav.crm_contacts", path: "/v2/pipeline/contacts", icon: <Users className="h-4 w-4" />,      pinned: true, pinOrder: 4 },
  { labelKey: "nav.business_cards", path: "/v2/pipeline/biglietti", icon: <Contact className="h-4 w-4" />, pinned: true, pinOrder: 5 },
  { labelKey: "nav.crm_pipeline", path: "/v2/pipeline/kanban", icon: <Kanban className="h-4 w-4" />,       pinned: true, pinOrder: 6 },
  { labelKey: "nav.explore",      path: "/v2/explore/map",  icon: <Search className="h-4 w-4" />,          pinned: true, pinOrder: 7 },
  { labelKey: "nav.communicate",  path: "/v2/communicate",  icon: <Mail className="h-4 w-4" />,            pinned: true, pinOrder: 8 },
  { labelKey: "nav.email_intelligence", path: "/v2/email-intelligence", icon: <Inbox className="h-4 w-4" />, pinned: true, pinOrder: 9 },
  { labelKey: "nav.intelligence", path: "/v2/intelligence", icon: <Brain className="h-4 w-4" />,           pinned: true, pinOrder: 10 },
  { labelKey: "nav.config",       path: "/v2/settings",     icon: <Settings className="h-4 w-4" />,        pinned: true, pinOrder: 11 },
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
  "/v2",
  "/v2/pipeline",
  "/v2/communicate",
  "/v2/settings",
] as const;
