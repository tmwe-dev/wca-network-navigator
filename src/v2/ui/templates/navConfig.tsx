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
  Command, Search, Mail, Brain, Settings, Inbox, Trash2, CalendarDays, Rocket, Sparkles, MessageCircle, Linkedin, Target, FlaskConical, Bot, MessagesSquare,
} from "lucide-react";
import { LEAN_MODE, LEAN_NAV_PATHS } from "@/lib/featureFlags";

export interface NavItemDef {
  readonly labelKey: string;
  readonly path: string;
  readonly icon: React.ReactNode;
  /** If true, shown as a top-level shortcut (legacy flag, mantenuto per compat). */
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

/**
 * Lista completa dei destination V2.
 * In Lean Mode la sidebar mostra solo le voci con path in LEAN_NAV_PATHS;
 * le altre restano accessibili via deep-link e popover "Tutte le pagine".
 */
export const FULL_NAV_ITEMS: readonly NavItemDef[] = [
  { labelKey: "nav.command",            path: "/v2/command",            icon: <Command className="h-4 w-4" />,  pinned: true, pinOrder: 1 },
  { labelKey: "nav.missioni",           path: "/v2/agents/autopilot",   icon: <Target className="h-4 w-4" />,   pinned: true, pinOrder: 1.5 },
  { labelKey: "nav.explore",            path: "/v2/explore/network",    icon: <Search className="h-4 w-4" />,   pinned: true, pinOrder: 2 },
  { labelKey: "nav.cestinone",          path: "/v2/cestinone",          icon: <Trash2 className="h-4 w-4" />,   pinned: true, pinOrder: 4, badge: "NEW" },
  { labelKey: "nav.cockpit",            path: "/v2/cockpit",            icon: <Rocket className="h-4 w-4" />,   pinned: true, pinOrder: 5 },
  { labelKey: "nav.comms",              path: "/v2/comms",              icon: <MessagesSquare className="h-4 w-4" />, pinned: true, pinOrder: 5.05, badge: "NEW" },
  { labelKey: "nav.inbox",              path: "/v2/inbox",              icon: <Inbox className="h-4 w-4" />,    pinned: true, pinOrder: 5.1 },
  { labelKey: "nav.email",              path: "/v2/email",              icon: <Mail className="h-4 w-4" />,     pinned: true, pinOrder: 5.2 },
  { labelKey: "nav.agenda",             path: "/v2/agenda",             icon: <CalendarDays className="h-4 w-4" />, pinned: true, pinOrder: 6 },
  { labelKey: "nav.lab",                path: "/v2/lab",                icon: <FlaskConical className="h-4 w-4" />, pinned: true, pinOrder: 6.5 },
  { labelKey: "nav.email_intelligence", path: "/v2/email-intelligence", icon: <Brain className="h-4 w-4" />,    pinned: true, pinOrder: 7 },
  { labelKey: "nav.funnemail_inbox",    path: "/v2/funnemail-inbox",    icon: <Sparkles className="h-4 w-4" />, pinned: true, pinOrder: 7.5, badge: "NEW" },
  { labelKey: "nav.rubrica_whatsapp",   path: "/v2/rubrica/whatsapp",   icon: <MessageCircle className="h-4 w-4" />, pinned: true, pinOrder: 7.7, badge: "NEW" },
  { labelKey: "nav.rubrica_linkedin",   path: "/v2/rubrica/linkedin",   icon: <Linkedin className="h-4 w-4" />, pinned: true, pinOrder: 7.8, badge: "NEW" },
  { labelKey: "nav.agenti",             path: "/v2/intelligence/agents", icon: <Bot className="h-4 w-4" />,     pinned: true, pinOrder: 7.9 },
  { labelKey: "nav.intelligence",       path: "/v2/intelligence",       icon: <Brain className="h-4 w-4" />,    pinned: true, pinOrder: 8 },
  { labelKey: "nav.config",             path: "/v2/settings",           icon: <Settings className="h-4 w-4" />, pinned: true, pinOrder: 9 },
] as const;

/** The destinations shown in the sidebar (filtered by Lean Mode). */
export const navItemsDef: readonly NavItemDef[] = LEAN_MODE
  ? FULL_NAV_ITEMS.filter((i) => LEAN_NAV_PATHS.has(i.path))
  : FULL_NAV_ITEMS;

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

/**
 * MACRO-AREE (Ristrutturazione UX 2026-06, Fase B).
 *
 * Le 7 macro-aree sono l'unica tassonomia con cui l'utente naviga il sistema.
 * Ogni voce del menu principale appartiene a UNA sola macro-area, così il
 * menu è sempre leggibile e nessuno si perde. Le pagine non elencate qui
 * (dev/orfane) restano raggiungibili dalla sezione "Development" del popover.
 *
 * Ordine = ordine di visualizzazione nel menu.
 */
export type MacroAreaKey =
  | "comando"
  | "esplora"
  | "pipeline"
  | "comunica"
  | "cervello"
  | "lab"
  | "config";

export interface MacroAreaDef {
  readonly key: MacroAreaKey;
  readonly label: string;
  /** Path (in ordine) appartenenti a questa macro-area. */
  readonly paths: readonly string[];
}

export const MACRO_AREAS: readonly MacroAreaDef[] = [
  { key: "comando",  label: "Comando",  paths: ["/v2/command", "/v2/agents/autopilot"] },
  { key: "esplora",  label: "Esplora",  paths: ["/v2/explore/network"] },
  { key: "pipeline", label: "Pipeline", paths: ["/v2/cestinone", "/v2/cockpit", "/v2/agenda"] },
  {
    key: "comunica",
    label: "Comunica",
    paths: [
      "/v2/comms",
      "/v2/inbox",
      "/v2/email",
      "/v2/email-intelligence",
      "/v2/funnemail-inbox",
      "/v2/rubrica/whatsapp",
      "/v2/rubrica/linkedin",
    ],
  },
  { key: "cervello", label: "Cervello", paths: ["/v2/intelligence/agents", "/v2/intelligence"] },
  { key: "lab",      label: "Lab",      paths: ["/v2/lab"] },
  { key: "config",   label: "Config",   paths: ["/v2/settings"] },
] as const;

/** Risolve, in ordine macro-area, i gruppi del menu principale con i loro item. */
export interface MacroAreaGroup {
  readonly key: MacroAreaKey;
  readonly label: string;
  readonly items: readonly NavItemDef[];
}

const ITEM_BY_PATH = new Map(FULL_NAV_ITEMS.map((i) => [i.path, i] as const));

/** Menu principale raggruppato nelle 7 macro-aree (item risolti da FULL_NAV_ITEMS). */
export const macroAreaGroups: readonly MacroAreaGroup[] = MACRO_AREAS.map((area) => ({
  key: area.key,
  label: area.label,
  items: area.paths
    .map((p) => ITEM_BY_PATH.get(p))
    .filter((i): i is NavItemDef => Boolean(i)),
})).filter((g) => g.items.length > 0);
