/**
 * Routes v2 — Complete routing with all 37 pages, wrapped in FeatureErrorBoundary
 */
import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation, useParams, Outlet } from "react-router-dom";
import { AuthenticatedLayout } from "./ui/templates/AuthenticatedLayout";
import { PublicLayout } from "./ui/templates/PublicLayout";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";
import { PageSkeleton } from "@/components/shared/PageSkeleton";
import { useAuth } from "@/providers/AuthProvider";

// ── Lazy pages ───────────────────────────────────────────────────────
const LoginPage = lazy(() => import("./ui/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const ResetPasswordPage = lazy(() => import("./ui/pages/ResetPasswordPage").then((m) => ({ default: m.ResetPasswordPage })));
const DashboardPage = lazy(() => import("./ui/pages/DashboardPage").then((m) => ({ default: m.DashboardPage })));
const NetworkPage = lazy(() => import("./ui/pages/NetworkPage").then((m) => ({ default: m.NetworkPage })));
const CRMPage = lazy(() => import("./ui/pages/CRMPage").then((m) => ({ default: m.CRMPage })));
const OutreachPage = lazy(() => import("./ui/pages/OutreachPage").then((m) => ({ default: m.OutreachPage })));
const AgentsPage = lazy(() => import("./ui/pages/AgentsPage").then((m) => ({ default: m.AgentsPage })));
const CampaignsPage = lazy(() => import("./ui/pages/CampaignsPage").then((m) => ({ default: m.CampaignsPage })));
const SettingsPage = lazy(() => import("./ui/pages/SettingsPage").then((m) => ({ default: m.SettingsPage })));
const DiagnosticsPage = lazy(() => import("./ui/pages/DiagnosticsPage").then((m) => ({ default: m.DiagnosticsPage })));
const ImportPage = lazy(() => import("./ui/pages/ImportPage").then((m) => ({ default: m.ImportPage })));
const StaffPage = lazy(() => import("./ui/pages/StaffPage").then((m) => ({ default: m.StaffPage })));
const AILabPage = lazy(() => import("./ui/pages/AILabPage").then((m) => ({ default: m.AILabPage })));
const KnowledgeBasePage = lazy(() => import("./ui/pages/KnowledgeBasePage").then((m) => ({ default: m.KnowledgeBasePage })));
const KBSupervisorPage = lazy(() => import("./ui/pages/KBSupervisorPage").then((m) => ({ default: m.KBSupervisorPage })));
const InreachPage = lazy(() => import("./ui/pages/InreachPage").then((m) => ({ default: m.InreachPage })));
const AgendaPage = lazy(() => import("./ui/pages/AgendaPage").then((m) => ({ default: m.AgendaPage })));
const ProspectPage = lazy(() => import("./ui/pages/ProspectPage").then((m) => ({ default: m.ProspectPage })));
const EmailComposerPage = lazy(() => import("./ui/pages/EmailComposerPage").then((m) => ({ default: m.EmailComposerPage })));
const CockpitPage = lazy(() => import("./ui/pages/CockpitPage").then((m) => ({ default: m.CockpitPage })));
const MissionBuilderPage = lazy(() => import("./ui/pages/MissionBuilderPage").then((m) => ({ default: m.MissionBuilderPage })));
const RADashboardPage = lazy(() => import("./ui/pages/RADashboardPage").then((m) => ({ default: m.RADashboardPage })));
const GlobePage = lazy(() => import("./ui/pages/GlobePage").then((m) => ({ default: m.GlobePage })));
const DeepSearchPage = lazy(() => import("./ui/pages/DeepSearchPage").then((m) => ({ default: m.DeepSearchPage })));
const SortingPage = lazy(() => import("./ui/pages/SortingPage").then((m) => ({ default: m.SortingPage })));
const TelemetryPage = lazy(() => import("./ui/pages/TelemetryPage").then((m) => ({ default: m.TelemetryPage })));
const OperationsPage = lazy(() => import("./ui/pages/OperationsPage").then((m) => ({ default: m.OperationsPage })));
const AcquisizionePartnerPage = lazy(() => import("./ui/pages/AcquisizionePartnerPage").then((m) => ({ default: m.AcquisizionePartnerPage })));
const AgentChatHubPage = lazy(() => import("./ui/pages/AgentChatHubPage").then((m) => ({ default: m.AgentChatHubPage })));
const ContactsPage = lazy(() => import("./ui/pages/ContactsPage").then((m) => ({ default: m.ContactsPage })));
const EmailDownloadPage = lazy(() => import("./ui/pages/EmailDownloadPage").then((m) => ({ default: m.EmailDownloadPage })));
const RAExplorerPage = lazy(() => import("./ui/pages/RAExplorerPage").then((m) => ({ default: m.RAExplorerPage })));
const RAScrapingEnginePage = lazy(() => import("./ui/pages/RAScrapingEnginePage").then((m) => ({ default: m.RAScrapingEnginePage })));
const RACompanyDetailPage = lazy(() => import("./ui/pages/RACompanyDetailPage").then((m) => ({ default: m.RACompanyDetailPage })));
const CampaignJobsPage = lazy(() => import("./ui/pages/CampaignJobsPage").then((m) => ({ default: m.CampaignJobsPage })));
const AdminUsersPage = lazy(() => import("./ui/pages/AdminUsersPage").then((m) => ({ default: m.AdminUsersPage })));
const OnboardingPage = lazy(() => import("./ui/pages/OnboardingPage").then((m) => ({ default: m.OnboardingPage })));
const GuidaPage = lazy(() => import("./ui/pages/GuidaPage").then((m) => ({ default: m.GuidaPage })));
const AIControlCenterPage = lazy(() => import("./ui/pages/AIControlCenterPage").then((m) => ({ default: m.AIControlCenterPage })));
const EmailIntelligencePage = lazy(() => import("./ui/pages/EmailIntelligencePage").then((m) => ({ default: m.EmailIntelligencePage })));
const AIArenaPage = lazy(() => import("@/pages/AIArena").then((m) => ({ default: m.AIArenaPage })));
const SystemHealthPage = lazy(() => import("@/components/admin/SystemHealthDashboard").then((m) => ({ default: m.SystemHealthDashboard })));
const DesignSystemPreviewPage = lazy(() => import("./ui/pages/DesignSystemPreviewPage").then((m) => ({ default: m.DesignSystemPreviewPage })));
const CommandPage = lazy(() => import("./ui/pages/CommandPage").then((m) => ({ default: m.CommandPage })));
const ObservabilityPage = lazy(() => import("./ui/pages/ObservabilityPage").then((m) => ({ default: m.ObservabilityPage })));
const MissionsAutopilotPage = lazy(() => import("./ui/pages/MissionsAutopilotPage").then((m) => ({ default: m.MissionsPage })));
const LandingPage = lazy(() => import("./ui/pages/LandingPage").then((m) => ({ default: m.LandingPage })));
const DocsPage = lazy(() => import("./ui/pages/DocsPage").then((m) => ({ default: m.DocsPage })));
const DPAPage = lazy(() => import("./ui/pages/DPAPage").then((m) => ({ default: m.DPAPage })));
const GuidedOnboardingPage = lazy(() => import("./ui/pages/GuidedOnboardingPage").then((m) => ({ default: m.GuidedOnboardingPage })));
const AgentPersonaEditorPage = lazy(() => import("./ui/pages/AgentPersonaEditorPage").then((m) => ({ default: m.AgentPersonaEditorPage })));
const AgentCapabilitiesPage = lazy(() => import("./ui/pages/AgentCapabilitiesPage").then((m) => ({ default: m.AgentCapabilitiesPage })));
const AgentTasksPage = lazy(() => import("./ui/pages/AgentTasksPage").then((m) => ({ default: m.AgentTasksPage })));
const NotFoundPage = lazy(() => import("@/pages/NotFound"));

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

// ── Router ───────────────────────────────────────────────────────────
export function V2Routes(): React.ReactElement {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Routes>
        {/* Legacy /v2/login → redirect to unified /auth */}
        <Route path="login" element={<Navigate to="/auth" replace />} />
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="reset-password" element={guardedPage(ResetPasswordPage, "ResetPassword")} />
        </Route>

        {/* Public standalone pages (no layout wrapper) */}
        <Route path="landing" element={guardedPage(LandingPage, "Landing")} />
        <Route path="docs" element={guardedPage(DocsPage, "Docs")} />
        <Route path="dpa" element={guardedPage(DPAPage, "DPA")} />

        {/* Fullscreen authenticated routes (no sidebar/header) */}
        <Route element={<V2AuthGateRaw />}>
          <Route path="command" element={guardedPage(CommandPage, "Command")} />
          <Route path="guided-onboarding" element={guardedPage(GuidedOnboardingPage, "GuidedOnboarding")} />
        </Route>

        {/* Authenticated routes */}
        <Route element={<V2AuthGate />}>
          <Route index element={guardedPage(DashboardPage, "Dashboard")} />
          <Route path="network" element={guardedPage(DeepSearchPage, "Network")} />

          {/* CRM + figli */}
          <Route path="crm" element={guardedPage(CRMPage, "CRM")} />
          <Route path="crm/contacts" element={guardedPage(ContactsPage, "Contacts")} />
          <Route path="crm/prospects" element={guardedPage(ProspectPage, "Prospects")} />
          <Route path="crm/acquisition" element={guardedPage(AcquisizionePartnerPage, "Acquisition")} />
          <Route path="contacts" element={<Navigate to="/v2/crm/contacts" replace />} />
          <Route path="prospects" element={<Navigate to="/v2/crm/prospects" replace />} />
          <Route path="acquisition" element={<Navigate to="/v2/crm/acquisition" replace />} />

          {/* Outreach + figli */}
          <Route path="outreach" element={guardedPage(OutreachPage, "Outreach")} />
          <Route path="outreach/composer" element={guardedPage(EmailComposerPage, "EmailComposer")} />
          <Route path="outreach/agenda" element={guardedPage(AgendaPage, "Agenda")} />
          <Route path="email-composer" element={<Navigate to="/v2/outreach/composer" replace />} />
          <Route path="agenda" element={<Navigate to="/v2/outreach/agenda" replace />} />
          <Route path="cockpit" element={<Navigate to="/v2/outreach" replace />} />

          <Route path="inreach" element={guardedPage(InreachPage, "Inreach")} />

          {/* Agents + figli */}
          <Route path="agents" element={guardedPage(AgentsPage, "Agents")} />
          <Route path="agents/persona" element={guardedPage(AgentPersonaEditorPage, "AgentPersona")} />
          <Route path="agents/missions" element={guardedPage(MissionBuilderPage, "Missions")} />
          <Route path="agents/autopilot" element={guardedPage(MissionsAutopilotPage, "AutopilotMissions")} />
          <Route path="agents/capabilities" element={guardedPage(AgentCapabilitiesPage, "AgentCapabilities")} />
          <Route path="agents/tasks" element={guardedPage(AgentTasksPage, "AgentTasks")} />
          <Route path="missions" element={<Navigate to="/v2/agents/missions" replace />} />
          <Route path="autopilot-missions" element={<Navigate to="/v2/agents/autopilot" replace />} />
          <Route path="agent-capabilities" element={<Navigate to="/v2/agents/capabilities" replace />} />
          <Route path="agent-tasks" element={<Navigate to="/v2/agents/tasks" replace />} />
          <Route path="agent-chat" element={<Navigate to="/v2/agents" replace />} />

          {/* Campaigns + figli */}
          <Route path="campaigns" element={guardedPage(CampaignsPage, "Campaigns")} />
          <Route path="campaigns/jobs" element={guardedPage(CampaignJobsPage, "CampaignJobs")} />
          <Route path="campaign-jobs" element={<Navigate to="/v2/campaigns/jobs" replace />} />

          {/* AI Staff + figli */}
          <Route path="ai-staff" element={guardedPage(StaffPage, "AIStaff")} />
          <Route path="ai-staff/kb-supervisor" element={guardedPage(KBSupervisorPage, "KBSupervisor")} />
          <Route path="ai-staff/lab" element={guardedPage(AILabPage, "AILab")} />
          <Route path="staff" element={<Navigate to="/v2/ai-staff" replace />} />
          <Route path="knowledge-base" element={<Navigate to="/v2/ai-staff" replace />} />
          <Route path="kb-supervisor" element={<Navigate to="/v2/ai-staff/kb-supervisor" replace />} />
          <Route path="ai-lab" element={<Navigate to="/v2/ai-staff/lab" replace />} />

          {/* Research */}
          <Route path="research" element={guardedPage(RADashboardPage, "Research")} />
          <Route path="globe" element={guardedPage(GlobePage, "Globe")} />
          <Route path="deep-search" element={<Navigate to="/v2/network" replace />} />
          <Route path="sorting" element={guardedPage(SortingPage, "Sorting")} />
          <Route path="ra-explorer" element={guardedPage(RAExplorerPage, "RAExplorer")} />
          <Route path="ra-scraping" element={guardedPage(RAScrapingEnginePage, "RAScraping")} />
          <Route path="ra-company/:id" element={guardedPage(RACompanyDetailPage, "RACompanyDetail")} />
          {/* Aliases: /v2/research/* → canonical /v2/ra-* */}
          <Route path="research/explorer" element={<Navigate to="/v2/ra-explorer" replace />} />
          <Route path="research/scraping" element={<Navigate to="/v2/ra-scraping" replace />} />
          <Route path="research/company/:id" element={<RACompanyRedirect />} />

          {/* Partner directory + alias */}
          <Route path="partner-directory" element={guardedPage(OperationsPage, "PartnerDirectory")} />
          <Route path="operations" element={<Navigate to="/v2/partner-directory" replace />} />
          <Route path="import" element={<Navigate to="/v2/partner-directory" replace />} />

          {/* Settings + figli admin/system */}
          <Route path="settings" element={guardedPage(SettingsPage, "Settings")} />
          <Route path="settings/admin-users" element={guardedPage(AdminUsersPage, "AdminUsers")} />
          <Route path="settings/email-download" element={guardedPage(EmailDownloadPage, "EmailDownload")} />
          <Route path="settings/diagnostics" element={guardedPage(DiagnosticsPage, "Diagnostics")} />
          <Route path="settings/telemetry" element={guardedPage(TelemetryPage, "Telemetry")} />
          <Route path="settings/observability" element={guardedPage(ObservabilityPage, "Observability")} />
          <Route path="settings/health" element={guardedPage(SystemHealthPage, "SystemHealth")} />
          <Route path="admin-users" element={<Navigate to="/v2/settings/admin-users" replace />} />
          <Route path="email-download" element={<Navigate to="/v2/settings/email-download" replace />} />
          <Route path="diagnostics" element={<Navigate to="/v2/settings/diagnostics" replace />} />
          <Route path="telemetry" element={<Navigate to="/v2/settings/telemetry" replace />} />
          <Route path="observability" element={<Navigate to="/v2/settings/observability" replace />} />
          <Route path="admin/health" element={<Navigate to="/v2/settings/health" replace />} />

          {/* Standalone */}
          <Route path="onboarding" element={guardedPage(OnboardingPage, "Onboarding")} />
          <Route path="guida" element={guardedPage(GuidaPage, "Guida")} />
          <Route path="ai-control" element={guardedPage(AIControlCenterPage, "AIControl")} />
          <Route path="email-intelligence" element={guardedPage(EmailIntelligencePage, "EmailIntelligence")} />
          <Route path="ai-arena" element={guardedPage(AIArenaPage, "AIArena")} />
          <Route path="design-system-preview" element={guardedPage(DesignSystemPreviewPage, "DesignSystemPreview")} />

          <Route path="*" element={guardedPage(NotFoundPage, "NotFound")} />
        </Route>
      </Routes>
    </Suspense>
  );
}
