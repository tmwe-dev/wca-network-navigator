/**
 * Routes v2 — Complete routing with all 37 pages, wrapped in FeatureErrorBoundary
 */
import * as React from "react";
import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useParams, useSearchParams, Outlet } from "react-router-dom";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";

/** Preserva il query param `?agent=` quando si redirige dal vecchio path /v2/agent-chat. */
function AgentChatRedirect() {
  const [searchParams] = useSearchParams();
  const agentId = searchParams.get("agent");
  return <Navigate to={agentId ? `/v2/agents?agent=${agentId}` : "/v2/agents"} replace />;
}

/**
 * Redirect che preserva `location.state` (es. prefilledRecipient) e la
 * query string. Necessario per i caller legacy verso `/v2/email-composer`
 * e `/v2/communicate/outreach/composer` che passano l'email destinatario
 * via state — un `<Navigate>` standard la perderebbe.
 */
function PreserveStateRedirect({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={{ pathname: to, search: location.search }} replace state={location.state} />;
}
import { AuthenticatedLayout } from "./ui/templates/AuthenticatedLayout";
import { PublicLayout } from "./ui/templates/PublicLayout";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useAuth } from "@/providers/AuthProvider";

// ── Lazy pages ───────────────────────────────────────────────────────
const LoginPage = lazy(() => import("./ui/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
// ResetPasswordPage legacy disabilitato — auth passa esclusivamente da TMWE OAuth.
const AuthCallbackPage = lazy(() => import("./ui/pages/AuthCallbackPage").then((m) => ({ default: m.AuthCallbackPage })));
const DashboardPage = lazy(() => import("./ui/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const KpiPage = lazy(() => import("./ui/pages/KpiPage").then((m) => ({ default: m.KpiPage })));
const NetworkPage = lazy(() => import("./ui/pages/NetworkPage").then((m) => ({ default: m.NetworkPage })));
const CRMPage = lazy(() => import("./ui/pages/CRMPage").then((m) => ({ default: m.CRMPage })));
const OutreachPage = lazy(() => import("./ui/pages/OutreachPage").then((m) => ({ default: m.OutreachPage })));
const AgentsPage = lazy(() => import("./ui/pages/AgentsPage").then((m) => ({ default: m.AgentsPage })));
const CampaignsPage = lazy(() => import("./ui/pages/CampaignsPage").then((m) => ({ default: m.Campaigns })));
const SettingsPage = lazy(() => import("./ui/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const DiagnosticsPage = lazy(() => import("./ui/pages/DiagnosticsPage").then((m) => ({ default: m.DiagnosticsPage })));
const ImportPage = lazy(() => import("./ui/pages/ImportPage").then((m) => ({ default: m.ImportPage })));
const StaffPage = lazy(() => import("./ui/pages/StaffPage").then((m) => ({ default: m.StaffPage })));
const AILabPage = lazy(() => import("./ui/pages/AILabPage").then((m) => ({ default: m.AILab })));
const KnowledgeBasePage = lazy(() => import("./ui/pages/KnowledgeBasePage").then((m) => ({ default: m.KnowledgeBasePage })));
const KBSupervisorPage = lazy(() => import("./ui/pages/KBSupervisorPage").then((m) => ({ default: m.KBSupervisorPage })));
const InreachPage = lazy(() => import("./ui/pages/InreachPage").then((m) => ({ default: m.InreachPage })));
const AgendaPage = lazy(() => import("./ui/pages/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const ProspectPage = lazy(() => import("./ui/pages/ProspectPage").then((m) => ({ default: m.ProspectPage })));
const EmailComposerPage = lazy(() => import("./ui/pages/EmailComposerPage").then((m) => ({ default: m.EmailComposerPage })));
const CockpitPage = lazy(() => import("./ui/pages/CockpitPage").then((m) => ({ default: m.CockpitPage })));
const MissionBuilderPage = lazy(() => import("./ui/pages/MissionBuilderPage").then((m) => ({ default: m.MissionBuilderPage })));
const RADashboardPage = lazy(() => import("./ui/pages/RADashboardPage").then((m) => ({ default: m.RADashboard })));
const GlobePage = lazy(() => import("./ui/pages/GlobePage").then((m) => ({ default: m.GlobePage })));
const DeepSearchPage = lazy(() => import("./ui/pages/DeepSearchPage").then((m) => ({ default: m.DeepSearchPage })));
const SortingPage = lazy(() => import("./ui/pages/SortingPage").then((m) => ({ default: m.Sorting })));
const TelemetryPage = lazy(() => import("./ui/pages/TelemetryPage").then((m) => ({ default: m.TelemetryPage })));
const OperationsPage = lazy(() => import("./ui/pages/OperationsPage").then((m) => ({ default: m.OperationsPage })));
const AcquisizionePartnerPage = lazy(() => import("./ui/pages/AcquisizionePartnerPage").then((m) => ({ default: m.AcquisizionePartner })));
const AgentChatHubPage = lazy(() => import("./ui/pages/AgentChatHubPage").then((m) => ({ default: m.AgentChatHub })));
const CommandHelpPage = lazy(() => import("./ui/pages/command/CommandHelpPage").then((m) => ({ default: m.CommandHelpPage })));
const ContactsPage = lazy(() => import("./ui/pages/ContactsPage").then((m) => ({ default: m.ContactsPage })));
const EmailDownloadPage = lazy(() => import("./ui/pages/EmailDownloadPage").then((m) => ({ default: m.EmailDownloadPage })));
const RAExplorerPage = lazy(() => import("./ui/pages/RAExplorerPage").then((m) => ({ default: m.RAExplorer })));
const RAScrapingEnginePage = lazy(() => import("./ui/pages/RAScrapingEnginePage").then((m) => ({ default: m.RAScrapingEngine })));
const RACompanyDetailPage = lazy(() => import("./ui/pages/RACompanyDetailPage").then((m) => ({ default: m.RACompanyDetailPage })));
const CampaignJobsPage = lazy(() => import("./ui/pages/CampaignJobsPage").then((m) => ({ default: m.CampaignJobsPage })));
const AdminUsersPage = lazy(() => import("./ui/pages/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })));
const OnboardingPage = lazy(() => import("./ui/pages/OnboardingPage").then((m) => ({ default: m.Onboarding })));
const GuidaPage = lazy(() => import("./ui/pages/GuidaPage"));
const AIControlCenterPage = lazy(() => import("./ui/pages/AIControlCenterPage").then((m) => ({ default: m.AIControlCenterPage })));
const EmailIntelligencePage = lazy(() => import("./ui/pages/EmailIntelligencePage").then((m) => ({ default: m.EmailIntelligencePage })));
const AlertRoutingPage = lazy(() => import("./ui/pages/AlertRoutingPage").then((m) => ({ default: m.AlertRoutingPage })));
const FunnemailInboxPage = lazy(() => import("./ui/pages/FunnemailInboxPage").then((m) => ({ default: m.FunnemailInboxPage })));
const FunnemailSortingQueuePage = lazy(() => import("./ui/pages/funnemail-inbox/SortingQueuePage").then((m) => ({ default: m.SortingQueuePage })));
const AIArenaPage = lazy(() => import("./ui/pages/AIArenaPage").then((m) => ({ default: m.AIArenaPage })));
const SystemHealthPage = lazy(() => import("@/components/admin/SystemHealthDashboard").then((m) => ({ default: m.SystemHealthDashboard })));
const AnalyticsPage = lazy(() => import("./ui/pages/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const DesignSystemPreviewPage = lazy(() => import("./ui/pages/DesignSystemPreviewPage").then((m) => ({ default: m.DesignSystemPreviewPage })));
const CommandPage = lazy(() => import("./ui/pages/CommandPage").then((m) => ({ default: m.CommandPage })));
const FinderApiPage = lazy(() => import("./ui/pages/FinderApiPage").then((m) => ({ default: m.FinderApiPage })));
const FinderApiSchemaMapPage = lazy(() => import("./ui/pages/finder-api/FinderApiSchemaMapPage").then((m) => ({ default: m.FinderApiSchemaMapPage })));
const EmailForgePage = lazy(() => import("./ui/pages/EmailForgePage").then((m) => ({ default: m.EmailForgePage })));
const ObservabilityPage = lazy(() => import("./ui/pages/ObservabilityPage").then((m) => ({ default: m.ObservabilityPage })));
const E2EStatusPage = lazy(() => import("./ui/pages/E2EStatusPage").then((m) => ({ default: m.E2EStatusPage })));
const MissionsAutopilotPage = lazy(() => import("./ui/pages/MissionsAutopilotPage").then((m) => ({ default: m.MissionsPage })));
const LandingPage = lazy(() => import("./ui/pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const DocsPage = lazy(() => import("./ui/pages/DocsPage").then((m) => ({ default: m.DocsPage })));
const PromptLabPage = lazy(() => import("./ui/pages/PromptLabPage").then((m) => ({ default: m.PromptLabPage })));
const AgentAtlasPage = lazy(() => import("./ui/pages/prompt-lab/atlas/AgentAtlasPage"));
const SuggestionsReviewPage = lazy(() => import("./ui/pages/prompt-lab/SuggestionsReviewPage"));
const ProposalsReviewPage = lazy(() => import("./ui/pages/prompt-lab/ProposalsReviewPage"));
const PromptCatalogPage = lazy(() => import("./ui/pages/PromptCatalogPage"));
const PromptReaderPage = lazy(() => import("./ui/pages/prompt-lab/PromptReaderPage"));
const AiInteractionLogPage = lazy(() => import("./ui/pages/AiInteractionLogPage"));
const DPAPage = lazy(() => import("./ui/pages/DPAPage").then((m) => ({ default: m.DPAPage })));
const GuidedOnboardingPage = lazy(() => import("./ui/pages/GuidedOnboardingPage").then((m) => ({ default: m.GuidedOnboardingPage })));
const AgentPersonaEditorPage = lazy(() => import("./ui/pages/AgentPersonaEditorPage").then((m) => ({ default: m.AgentPersonaEditorPage })));
const AgentCapabilitiesPage = lazy(() => import("./ui/pages/AgentCapabilitiesPage").then((m) => ({ default: m.AgentCapabilitiesPage })));
const AgentTasksPage = lazy(() => import("./ui/pages/AgentTasksPage").then((m) => ({ default: m.AgentTasksPage })));
const CalendarPage = lazy(() => import("./ui/pages/CalendarPage").then((m) => ({ default: m.CalendarPage })));
const NotificationsPage = lazy(() => import("./ui/pages/NotificationsPage"));
const TokenCockpitPage = lazy(() => import("./ui/pages/TokenCockpitPage").then((m) => ({ default: m.TokenCockpitPage })));
const NotFoundPage = lazy(() => import("@/components/shared/NotFound"));

// ── New Section pages (UX Redesign Phase 1) ──────────────────────────
const PipelineSection     = lazy(() => import("./ui/pages/sections/PipelineSection"));
const IntelligenceSection = lazy(() => import("./ui/pages/sections/IntelligenceSection"));
const ExploreSection      = lazy(() => import("./ui/pages/sections/ExploreSection"));
const AgendaSection       = lazy(() => import("./ui/pages/sections/AgendaSection"));

// ── Cestinone (unified pre-send queue) ───────────────────────────────
const CestinonePage = lazy(() => import("./ui/pages/CestinonePage").then((m) => ({ default: m.CestinonePage })));

/** Wraps a lazy page with error boundary and suspense skeleton */
function guardedPage(Page: React.LazyExoticComponent<React.ComponentType>, name: string): React.ReactElement {
  return (
    <FeatureErrorBoundary featureName={name}>
      <Suspense fallback={<PageSkeleton />}>
        <Page />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

function V2AuthGate(): React.ReactElement {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <PageSkeleton />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <AuthenticatedLayout />;
}

/** Auth gate without layout — for fullscreen pages like Command */
function V2AuthGateRaw(): React.ReactElement {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <PageSkeleton />;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/** Alias redirect preserving :id param */
function RACompanyRedirect(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={`/v2/ra-company/${id ?? ""}`} replace />;
}

/**
 * Redirect legacy: /v2/partner-hub era un alias di NetworkPage.
 * Ora consolidato in /v2/explore/network. Preserviamo `?country=XX`
 * applicando il filtro paese globale prima del redirect, così i vecchi
 * bookmark/deep-link continuano a pre-selezionare il paese.
 */
function PartnerHubAlias(): React.ReactElement {
  const [searchParams] = useSearchParams();
  const { batchUpdate } = useGlobalFilters();
  const country = searchParams.get("country")?.trim().toUpperCase();

  useEffect(() => {
    if (!country) return;
    batchUpdate({ networkSelectedCountries: new Set([country]) });
  }, [batchUpdate, country]);

  return <Navigate to="/v2/explore/network" replace />;
}

// ── Router ───────────────────────────────────────────────────────────
export function V2Routes(): React.ReactElement {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Public routes (login, reset-password) */}
        <Route element={<PublicLayout />}>
          <Route path="login" element={guardedPage(LoginPage, "Login")} />
          <Route path="reset-password" element={<Navigate to="/v2/login" replace />} />
          <Route path="auth-callback" element={guardedPage(AuthCallbackPage, "AuthCallback")} />
        </Route>

        {/* Public standalone pages (no layout wrapper) */}
        <Route path="landing" element={guardedPage(LandingPage, "Landing")} />
        <Route path="docs" element={guardedPage(DocsPage, "Docs")} />
        <Route path="dpa" element={guardedPage(DPAPage, "DPA")} />

        {/* Fullscreen authenticated routes (no sidebar/header) */}
        <Route element={<V2AuthGateRaw />}>
          <Route path="command" element={guardedPage(CommandPage, "Command")} />
          <Route path="command/help" element={guardedPage(CommandHelpPage, "CommandHelp")} />
          <Route path="finder-api" element={guardedPage(FinderApiPage, "FinderAPI")} />
          <Route path="finder-api/schema" element={guardedPage(FinderApiSchemaMapPage, "FinderAPISchema")} />
          <Route path="guided-onboarding" element={guardedPage(GuidedOnboardingPage, "GuidedOnboarding")} />
        </Route>

        {/* Authenticated routes */}
        <Route element={<V2AuthGate />}>
          {/* Home V2 → Command (Dashboard accessibile esplicitamente su /v2/dashboard) */}
          <Route index element={<Navigate to="/v2/command" replace />} />
          <Route path="dashboard" element={guardedPage(DashboardPage, "Dashboard")} />

          {/* ── UX Redesign Phase 1: 6-destination sections ── */}
          {/* Pipeline rimossa dal menu — redirect verso Agenda dove ora vive il Kanban */}
          <Route path="pipeline"            element={<Navigate to="/v2/agenda/pipeline" replace />} />
          <Route path="pipeline/kanban"     element={<Navigate to="/v2/agenda/pipeline" replace />} />
          <Route path="pipeline/duplicati"  element={<Navigate to="/v2/agenda/duplicati" replace />} />
          <Route path="pipeline/*"          element={guardedPage(PipelineSection, "Pipeline")} />
          <Route path="intelligence/*" element={guardedPage(IntelligenceSection, "Intelligence")} />
          <Route path="explore/*"      element={guardedPage(ExploreSection,      "Explore")} />

          {/* ── Cestinone: unica coda pre-invio ── */}
          <Route path="cestinone" element={guardedPage(CestinonePage, "Cestinone")} />
          <Route path="todo" element={<Navigate to="/v2/cestinone" replace />} />
          <Route path="approvals" element={<Navigate to="/v2/cestinone" replace />} />

          <Route path="analytics" element={guardedPage(AnalyticsPage, "Analytics")} />
          <Route path="kpi" element={guardedPage(KpiPage, "KPI")} />
          <Route path="network" element={guardedPage(NetworkPage, "Network")} />
          <Route path="partner-hub" element={<PartnerHubAlias />} />

          {/* CRM + figli */}
          <Route path="crm" element={<Navigate to="/v2/pipeline/kanban" replace />} />
          <Route path="crm/contacts" element={<Navigate to="/v2/pipeline/contacts" replace />} />
          <Route path="crm/biglietti" element={<Navigate to="/v2/pipeline/biglietti" replace />} />
          <Route path="crm/business-cards" element={<Navigate to="/v2/pipeline/biglietti" replace />} />
          <Route path="crm/kanban" element={<Navigate to="/v2/pipeline/kanban" replace />} />
          <Route path="crm/prospects" element={guardedPage(ProspectPage, "Prospects")} />
          <Route path="crm/acquisition" element={guardedPage(AcquisizionePartnerPage, "Acquisition")} />
          <Route path="contacts" element={<Navigate to="/v2/pipeline/contacts" replace />} />
          <Route path="business-cards" element={<Navigate to="/v2/pipeline/biglietti" replace />} />
          <Route path="biglietti" element={<Navigate to="/v2/pipeline/biglietti" replace />} />
          <Route path="prospects" element={<Navigate to="/v2/crm/prospects" replace />} />
          <Route path="acquisition" element={<Navigate to="/v2/crm/acquisition" replace />} />

          {/* Deals — feature rimossa: redirect verso Kanban (pipeline contatti) */}
          <Route path="deals" element={<Navigate to="/v2/pipeline/kanban" replace />} />

          {/* Calendar */}
          <Route path="calendar" element={guardedPage(CalendarPage, "Calendar")} />

          {/* Outreach + figli */}
          <Route path="cockpit" element={guardedPage(OutreachPage, "Cockpit")} />
          <Route path="inbox"   element={guardedPage(InreachPage, "Inbox")} />
          <Route path="email"   element={guardedPage(EmailComposerPage, "Email")} />
          {/* Canonical Email Forge under /v2/email/forge (Fase 3) */}
          <Route path="email/forge" element={guardedPage(EmailForgePage, "EmailForge")} />
          {/* Legacy redirects → nuove voci top-level */}
          <Route path="outreach" element={<Navigate to="/v2/cockpit" replace />} />
          <Route path="outreach/composer" element={<PreserveStateRedirect to="/v2/email" />} />
          <Route path="outreach/agenda" element={<Navigate to="/v2/agenda" replace />} />
          <Route path="email-composer" element={<PreserveStateRedirect to="/v2/email" />} />
          <Route path="communicate"            element={<Navigate to="/v2/cockpit" replace />} />
          <Route path="communicate/outreach"   element={<Navigate to="/v2/cockpit" replace />} />
          <Route path="communicate/inbox"      element={<Navigate to="/v2/inbox" replace />} />
          <Route path="communicate/compose"    element={<PreserveStateRedirect to="/v2/email" />} />
          <Route path="communicate/campaigns"  element={<Navigate to="/v2/explore/campaigns" replace />} />
          <Route path="communicate/approve"    element={<Navigate to="/v2/cestinone" replace />} />
          <Route path="communicate/*"          element={<Navigate to="/v2/cockpit" replace />} />
          <Route path="agenda/*" element={guardedPage(AgendaSection, "Agenda")} />
          <Route path="pipeline/agenda" element={<Navigate to="/v2/agenda" replace />} />

          <Route path="inreach" element={<Navigate to="/v2/inbox" replace />} />

          {/* Agents + figli */}
          <Route path="agents" element={<Navigate to="/v2/intelligence/agents" replace />} />
          <Route path="agents/persona" element={guardedPage(AgentPersonaEditorPage, "AgentPersona")} />
          <Route path="agents/missions" element={guardedPage(MissionBuilderPage, "Missions")} />
          <Route path="agents/autopilot" element={guardedPage(MissionsAutopilotPage, "AutopilotMissions")} />
          <Route path="agents/capabilities" element={guardedPage(AgentCapabilitiesPage, "AgentCapabilities")} />
          <Route path="agents/tasks" element={guardedPage(AgentTasksPage, "AgentTasks")} />
          <Route path="missions" element={<Navigate to="/v2/agents/missions" replace />} />
          <Route path="autopilot-missions" element={<Navigate to="/v2/agents/autopilot" replace />} />
          <Route path="agent-capabilities" element={<Navigate to="/v2/agents/capabilities" replace />} />
          <Route path="agent-tasks" element={<Navigate to="/v2/agents/tasks" replace />} />
          <Route path="agent-chat" element={<AgentChatRedirect />} />

          {/* Campaigns + figli */}
          <Route path="campaigns" element={<Navigate to="/v2/explore/campaigns" replace />} />
          <Route path="campaigns/jobs" element={guardedPage(CampaignJobsPage, "CampaignJobs")} />
          <Route path="campaign-jobs" element={<Navigate to="/v2/campaigns/jobs" replace />} />

          {/* AI Staff + figli */}
          <Route path="ai-staff" element={guardedPage(StaffPage, "AIStaff")} />
          <Route path="ai-staff/kb-supervisor" element={guardedPage(KBSupervisorPage, "KBSupervisor")} />
          <Route path="ai-staff/lab" element={guardedPage(AILabPage, "AILab")} />
          {/* Legacy → canonical /v2/email/forge */}
          <Route path="ai-staff/email-forge" element={<Navigate to="/v2/email/forge" replace />} />
          <Route path="ai-staff/prompt-lab" element={guardedPage(PromptLabPage, "PromptLab")} />
          <Route path="prompt-lab" element={<Navigate to="/v2/settings/prompt-lab" replace />} />
          <Route path="prompt-lab/atlas" element={guardedPage(AgentAtlasPage, "AgentAtlas")} />
          <Route path="prompt-lab/suggestions" element={guardedPage(SuggestionsReviewPage, "SuggestionsReview")} />
          <Route path="prompt-lab/proposals" element={guardedPage(ProposalsReviewPage, "ProposalsReview")} />
          <Route path="prompt-lab/catalog" element={guardedPage(PromptCatalogPage, "PromptCatalog")} />
          <Route path="prompt-reader" element={guardedPage(PromptReaderPage, "PromptReader")} />
          <Route path="ai-interactions-log" element={guardedPage(AiInteractionLogPage, "AiInteractionLog")} />
          <Route path="staff" element={<Navigate to="/v2/ai-staff" replace />} />
          <Route path="knowledge-base" element={<Navigate to="/v2/settings/kb" replace />} />
          <Route path="kb-supervisor" element={<Navigate to="/v2/settings/kb" replace />} />
          <Route path="ai-lab" element={<Navigate to="/v2/ai-staff/lab" replace />} />

          {/* Research */}
          <Route path="research" element={guardedPage(RADashboardPage, "Research")} />
          <Route path="globe" element={<Navigate to="/v2/explore/map" replace />} />
          <Route path="deep-search" element={<Navigate to="/v2/explore/deep-search" replace />} />
          <Route path="sorting" element={guardedPage(SortingPage, "Sorting")} />
          <Route path="ra-explorer" element={guardedPage(RAExplorerPage, "RAExplorer")} />
          <Route path="ra-scraping" element={guardedPage(RAScrapingEnginePage, "RAScraping")} />
          <Route path="ra-company/:id" element={guardedPage(RACompanyDetailPage, "RACompanyDetail")} />
          {/* Aliases: /v2/research/* → canonical /v2/ra-* */}
          <Route path="research/explorer" element={<Navigate to="/v2/ra-explorer" replace />} />
          <Route path="research/scraping" element={<Navigate to="/v2/ra-scraping" replace />} />
          <Route path="research/company/:id" element={<RACompanyRedirect />} />

          {/* Partner directory + alias → unificati su Network */}
          <Route path="partner-directory" element={<Navigate to="/v2/explore/network" replace />} />
          <Route path="operations" element={<Navigate to="/v2/explore/network" replace />} />
          <Route path="import" element={<Navigate to="/v2/explore/network" replace />} />
          {/* Mantengo OperationsPage raggiungibile via deep-link legacy se serve */}
          <Route path="operations-legacy" element={guardedPage(OperationsPage, "PartnerDirectory")} />

          {/* Settings + figli admin/system */}
          <Route path="settings" element={guardedPage(SettingsPage, "Settings")} />
          <Route path="settings/admin-users" element={guardedPage(AdminUsersPage, "AdminUsers")} />
          <Route path="settings/email-download" element={guardedPage(EmailDownloadPage, "EmailDownload")} />
          <Route path="settings/diagnostics" element={guardedPage(DiagnosticsPage, "Diagnostics")} />
          <Route path="settings/telemetry" element={guardedPage(TelemetryPage, "Telemetry")} />
          <Route path="settings/observability" element={guardedPage(ObservabilityPage, "Observability")} />
          <Route path="settings/health" element={guardedPage(SystemHealthPage, "SystemHealth")} />
          <Route path="settings/e2e-status" element={guardedPage(E2EStatusPage, "E2EStatus")} />
          <Route path="settings/alert-routing" element={guardedPage(AlertRoutingPage, "AlertRouting")} />
          <Route path="admin-users" element={<Navigate to="/v2/settings/admin-users" replace />} />
          <Route path="email-download" element={<Navigate to="/v2/settings/email-download" replace />} />
          <Route path="diagnostics" element={<Navigate to="/v2/settings/diagnostics" replace />} />
          <Route path="telemetry" element={<Navigate to="/v2/settings/telemetry" replace />} />
          <Route path="observability" element={<Navigate to="/v2/settings/observability" replace />} />
          <Route path="admin/health" element={<Navigate to="/v2/settings/health" replace />} />

          {/* Standalone */}
          <Route path="onboarding" element={guardedPage(OnboardingPage, "Onboarding")} />
          <Route path="guida" element={guardedPage(GuidaPage, "Guida")} />
          <Route path="ai-control" element={<Navigate to="/v2/intelligence/control" replace />} />
          <Route path="email-intelligence" element={guardedPage(EmailIntelligencePage, "EmailIntelligence")} />
          <Route path="funnemail-inbox" element={guardedPage(FunnemailInboxPage, "FunnemailInbox")} />
          <Route path="funnemail-inbox/sorting" element={guardedPage(FunnemailSortingQueuePage, "FunnemailSortingQueue")} />
          <Route path="ai-arena" element={guardedPage(AIArenaPage, "AIArena")} />
          <Route path="token-cockpit" element={guardedPage(TokenCockpitPage, "TokenCockpit")} />
          <Route path="notifications" element={guardedPage(NotificationsPage, "Notifications")} />
          <Route path="design-system-preview" element={guardedPage(DesignSystemPreviewPage, "DesignSystemPreview")} />

          <Route path="*" element={guardedPage(NotFoundPage, "NotFound")} />
        </Route>
      </Routes>
    </Suspense>
  );
}
