/**
 * Lab Hub — Single Source Of Truth.
 *
 * Aggiungere un nuovo strumento di test/lab/diagnostica/charts =
 * aggiungere UNA RIGA in `LAB_TABS`.
 *
 * I componenti vengono caricati lazy as-is: nessuna business logic qui.
 * Routing legacy preservato in `src/v2/routes.tsx` via Navigate replace.
 */
import type { ComponentType, LazyExoticComponent } from "react";
import { lazy } from "react";
import {
  Activity,
  BarChart3,
  Beaker,
  BellRing,
  BookOpen,
  Coins,
  Eye,
  FileText,
  FlaskConical,
  GitBranch,
  GitCommit,
  HeartPulse,
  Lightbulb,
  type LucideIcon,
  Mail,
  Map as MapIcon,
  MessageSquare,
  Mic,
  Palette,
  Puzzle,
  Stethoscope,
  TestTube,
  Wand2,
} from "lucide-react";

export type LabTabGroup = "tests" | "prompts" | "observability" | "design";

export interface LabGroupConfig {
  id: LabTabGroup;
  label: string;
  icon: LucideIcon;
}

export interface LabTabConfig {
  id: string;
  label: string;
  icon: LucideIcon;
  group: LabTabGroup;
  Component: LazyExoticComponent<ComponentType<unknown>>;
  legacyPath?: string;
}

export const LAB_GROUPS: readonly LabGroupConfig[] = [
  { id: "tests",         label: "Tests",         icon: FlaskConical },
  { id: "prompts",       label: "Prompts",       icon: Wand2 },
  { id: "observability", label: "Observability", icon: Eye },
  { id: "design",        label: "Design",        icon: Palette },
] as const;

/* eslint-disable react-refresh/only-export-components */
export const LAB_TABS: readonly LabTabConfig[] = [
  // ─── TESTS ───────────────────────────────────────────────
  { id: "scenari",      label: "Scenari AI",    group: "tests", icon: FlaskConical, legacyPath: "/v2/ai-test-hub",
    Component: lazy(() => import("@/v2/ui/pages/AiTestHubPage").then((m) => ({ default: m.AiTestHubPage }))) },
  { id: "ai-lab",       label: "AI Lab Email",  group: "tests", icon: Beaker,
    Component: lazy(() => import("@/v2/ui/pages/AILabPage").then((m) => ({ default: m.AILab }))) },
  { id: "email-lab",    label: "Email Lab",     group: "tests", icon: Mail, legacyPath: "/v2/email-lab",
    Component: lazy(() => import("@/v2/ui/pages/EmailLabPage").then((m) => ({ default: m.EmailLabPage }))) },
  { id: "extensions",   label: "Extensions",    group: "tests", icon: Puzzle,
    Component: lazy(() => import("@/components/test-extensions/TestExtensionsView").then((m) => ({ default: m.TestExtensionsContent }))) },
  { id: "e2e",          label: "E2E Smoke",     group: "tests", icon: Activity, legacyPath: "/v2/settings/e2e-status",
    Component: lazy(() => import("@/v2/ui/pages/E2EStatusPage").then((m) => ({ default: m.E2EStatusPage }))) },

  // ─── PROMPTS ─────────────────────────────────────────────
  { id: "prompt-lab",       label: "Prompt Lab",  group: "prompts", icon: Wand2, legacyPath: "/v2/settings/prompt-lab",
    Component: lazy(() => import("@/v2/ui/pages/PromptLabPage").then((m) => ({ default: m.PromptLabPage }))) },
  { id: "prompt-catalog",   label: "Catalog",     group: "prompts", icon: BookOpen, legacyPath: "/v2/prompt-lab/catalog",
    Component: lazy(() => import("@/v2/ui/pages/PromptCatalogPage")) },
  { id: "prompt-tests",     label: "Regression", group: "prompts", icon: TestTube, legacyPath: "/v2/prompt-lab/tests",
    Component: lazy(() => import("@/v2/ui/pages/PromptTestsPage")) },
  { id: "prompt-atlas",     label: "Atlas",       group: "prompts", icon: MapIcon, legacyPath: "/v2/prompt-lab/atlas",
    Component: lazy(() => import("@/v2/ui/pages/prompt-lab/atlas/AgentAtlasPage")) },
  { id: "prompt-suggest",   label: "Suggestions", group: "prompts", icon: Lightbulb, legacyPath: "/v2/prompt-lab/suggestions",
    Component: lazy(() => import("@/v2/ui/pages/prompt-lab/SuggestionsReviewPage")) },
  { id: "prompt-proposals", label: "Proposals",   group: "prompts", icon: GitBranch, legacyPath: "/v2/prompt-lab/proposals",
    Component: lazy(() => import("@/v2/ui/pages/prompt-lab/ProposalsReviewPage")) },
  { id: "prompt-reader",    label: "Reader",      group: "prompts", icon: FileText, legacyPath: "/v2/settings/prompt-reader",
    Component: lazy(() => import("@/v2/ui/pages/prompt-lab/PromptReaderPage")) },
  { id: "brand-voice",      label: "Brand Voice", group: "prompts", icon: Mic, legacyPath: "/v2/settings/brand-voice",
    Component: lazy(() => import("@/v2/ui/pages/BrandVoicePage").then((m) => ({ default: m.BrandVoicePage }))) },

  // ─── OBSERVABILITY ───────────────────────────────────────
  { id: "diagnostica",     label: "Diagnostica",     group: "observability", icon: Stethoscope, legacyPath: "/v2/settings/diagnostics",
    Component: lazy(() => import("@/v2/ui/pages/DiagnosticsPage").then((m) => ({ default: m.DiagnosticsPage }))) },
  { id: "telemetria",      label: "Telemetria",      group: "observability", icon: BarChart3, legacyPath: "/v2/settings/telemetry",
    Component: lazy(() => import("@/v2/ui/pages/TelemetryPage").then((m) => ({ default: m.TelemetryPage }))) },
  { id: "observability",   label: "Observability",   group: "observability", icon: Eye, legacyPath: "/v2/settings/observability",
    Component: lazy(() => import("@/v2/ui/pages/ObservabilityPage").then((m) => ({ default: m.ObservabilityPage }))) },
  { id: "health",          label: "System Health",   group: "observability", icon: HeartPulse, legacyPath: "/v2/settings/health",
    Component: lazy(() => import("@/components/admin/SystemHealthDashboard").then((m) => ({ default: m.SystemHealthDashboard }))) },
  { id: "alert-routing",   label: "Alert Routing",   group: "observability", icon: BellRing, legacyPath: "/v2/settings/alert-routing",
    Component: lazy(() => import("@/v2/ui/pages/AlertRoutingPage").then((m) => ({ default: m.AlertRoutingPage }))) },
  { id: "ai-log",          label: "AI Interactions", group: "observability", icon: MessageSquare, legacyPath: "/v2/ai-interactions-log",
    Component: lazy(() => import("@/v2/ui/pages/AiInteractionLogPage")) },
  { id: "pipeline-traces", label: "Pipeline Traces", group: "observability", icon: GitCommit, legacyPath: "/v2/pipeline-traces",
    Component: lazy(() => import("@/v2/ui/pages/PipelineTracesPage")) },
  { id: "token-cockpit",   label: "Token Cockpit",   group: "observability", icon: Coins, legacyPath: "/v2/token-cockpit",
    Component: lazy(() => import("@/v2/ui/pages/TokenCockpitPage").then((m) => ({ default: m.TokenCockpitPage }))) },

  // ─── DESIGN ──────────────────────────────────────────────
  { id: "design", label: "Design System", group: "design", icon: Palette, legacyPath: "/v2/design-system-preview",
    Component: lazy(() => import("@/v2/ui/pages/DesignSystemPreviewPage").then((m) => ({ default: m.DesignSystemPreviewPage }))) },
] as const;
/* eslint-enable react-refresh/only-export-components */

export function getLabTabsByGroup(group: LabTabGroup): readonly LabTabConfig[] {
  return LAB_TABS.filter((t) => t.group === group);
}

export function findLabTab(id: string | null | undefined): LabTabConfig | undefined {
  if (!id) return undefined;
  return LAB_TABS.find((t) => t.id === id);
}

export const DEFAULT_LAB_GROUP: LabTabGroup = "tests";
export const DEFAULT_LAB_TAB_BY_GROUP: Record<LabTabGroup, string> = {
  tests: "scenari",
  prompts: "prompt-lab",
  observability: "diagnostica",
  design: "design",
};