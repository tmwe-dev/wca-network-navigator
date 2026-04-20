/**
 * navConfig — Single source of truth for V2 navigation.
 * Used by LayoutSidebarNav (hamburger), FloatingDock (left dock), MobileBottomNav.
 * All paths MUST exist in src/v2/routes.tsx.
 */
import * as React from "react";
import {
  Globe, Users, Mail, Bot, Megaphone, Settings,
  LayoutDashboard, ArrowDownLeft, Calendar, Earth,
  ArrowUpDown, Command, Gamepad2, MessageSquare,
  BrainCircuit, ShieldCheck, BarChart3, Rocket,
  UserCog, BookOpen, Wand2,
} from "lucide-react";

export interface NavItemDef {
  readonly labelKey: string;
  readonly path: string;
  readonly icon: React.ReactNode;
  /** If true, shown in the FloatingDock as a top-level shortcut. */
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

export const navGroupsDef: readonly NavGroupDef[] = [
  {
    titleKey: "nav.group_ai_command",
    items: [
      { labelKey: "nav.command", path: "/v2/command", icon: <MessageSquare className="h-4 w-4" />, pinned: true, pinOrder: 2, badge: "NEW" },
    ],
  },
  {
    titleKey: "nav.group_overview",
    items: [
      { labelKey: "nav.dashboard", path: "/v2", icon: <LayoutDashboard className="h-4 w-4" />, pinned: true, pinOrder: 1 },
      { labelKey: "nav.network", path: "/v2/network", icon: <Globe className="h-4 w-4" />, pinned: true, pinOrder: 3 },
      { labelKey: "nav.globe", path: "/v2/globe", icon: <Earth className="h-4 w-4" /> },
      { labelKey: "nav.crm", path: "/v2/crm", icon: <Users className="h-4 w-4" />, pinned: true, pinOrder: 4 },
    ],
  },
  {
    titleKey: "nav.group_communication",
    items: [
      { labelKey: "nav.outreach", path: "/v2/outreach", icon: <Mail className="h-4 w-4" />, pinned: true, pinOrder: 5 },
      { labelKey: "nav.inreach", path: "/v2/inreach", icon: <ArrowDownLeft className="h-4 w-4" />, pinned: true, pinOrder: 6 },
      { labelKey: "nav.agenda", path: "/v2/outreach/agenda", icon: <Calendar className="h-4 w-4" /> },
      { labelKey: "nav.campaigns", path: "/v2/campaigns", icon: <Megaphone className="h-4 w-4" /> },
      { labelKey: "nav.approvals", path: "/v2/sorting", icon: <ArrowUpDown className="h-4 w-4" /> },
      { labelKey: "nav.ai_arena", path: "/v2/ai-arena", icon: <Gamepad2 className="h-4 w-4" /> },
    ],
  },
  {
    titleKey: "nav.group_intelligence",
    items: [
      { labelKey: "nav.email_intelligence", path: "/v2/email-intelligence", icon: <BrainCircuit className="h-4 w-4" /> },
      { labelKey: "Email Forge", path: "/v2/ai-staff/email-forge", icon: <Wand2 className="h-4 w-4" /> },
      { labelKey: "nav.research", path: "/v2/research", icon: <BarChart3 className="h-4 w-4" /> },
    ],
  },
  {
    titleKey: "nav.group_ai_operations",
    items: [
      { labelKey: "nav.agents", path: "/v2/agents", icon: <Bot className="h-4 w-4" />, pinned: true, pinOrder: 7 },
      { labelKey: "nav.missions", path: "/v2/agents/missions", icon: <Rocket className="h-4 w-4" /> },
      { labelKey: "nav.ai_staff", path: "/v2/ai-staff", icon: <UserCog className="h-4 w-4" /> },
      { labelKey: "nav.ai_control", path: "/v2/ai-control", icon: <ShieldCheck className="h-4 w-4" /> },
    ],
  },
  {
    titleKey: "nav.group_system",
    items: [
      { labelKey: "nav.settings", path: "/v2/settings", icon: <Settings className="h-4 w-4" />, pinned: true, pinOrder: 8 },
      { labelKey: "nav.guide", path: "/v2/guida", icon: <BookOpen className="h-4 w-4" /> },
    ],
  },
];

/** Flat ordered list of pinned items for the FloatingDock. */
export const pinnedNavItems: readonly NavItemDef[] = navGroupsDef
  .flatMap((g) => g.items)
  .filter((i) => i.pinned)
  .slice()
  .sort((a, b) => (a.pinOrder ?? 999) - (b.pinOrder ?? 999));

/** Helper used by MobileBottomNav for the 4 main destinations. */
export const mobileBottomNavPaths = ["/v2", "/v2/crm", "/v2/outreach", "/v2/settings"] as const;
