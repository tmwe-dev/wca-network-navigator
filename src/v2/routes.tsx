/**
 * Routes v2 — Complete routing with all 37 pages, wrapped in FeatureErrorBoundary
 */
import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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

        {/* Authenticated routes */}
        <Route element={<V2AuthGate />}>
          <Route index element={guardedPage(DashboardPage, "Dashboard")} />
          <Route path="network" element={guardedPage(NetworkPage, "Network")} />
          <Route path="crm" element={guardedPage(CRMPage, "CRM")} />
          <Route path="outreach" element={guardedPage(OutreachPage, "Outreach")} />
          <Route path="inreach" element={guardedPage(InreachPage, "Inreach")} />
          <Route path="agenda" element={guardedPage(AgendaPage, "Agenda")} />
          <Route path="email-composer" element={guardedPage(EmailComposerPage, "EmailComposer")} />
          <Route path="agents" element={guardedPage(AgentsPage, "Agents")} />
          <Route path="cockpit" element={guardedPage(CockpitPage, "Cockpit")} />
          <Route path="missions" element={guardedPage(MissionBuilderPage, "MissionBuilder")} />
          <Route path="campaigns" element={guardedPage(CampaignsPage, "Campaigns")} />
          <Route path="prospects" element={guardedPage(ProspectPage, "Prospects")} />
          <Route path="staff" element={guardedPage(StaffPage, "Staff")} />
          <Route path="ai-lab" element={guardedPage(AILabPage, "AILab")} />
          <Route path="knowledge-base" element={guardedPage(KnowledgeBasePage, "KnowledgeBase")} />
          <Route path="research" element={guardedPage(RADashboardPage, "Research")} />
          <Route path="globe" element={guardedPage(GlobePage, "Globe")} />
          <Route path="deep-search" element={guardedPage(DeepSearchPage, "DeepSearch")} />
          <Route path="sorting" element={guardedPage(SortingPage, "Sorting")} />
          <Route path="telemetry" element={guardedPage(TelemetryPage, "Telemetry")} />
          <Route path="operations" element={guardedPage(OperationsPage, "Operations")} />
          <Route path="settings" element={guardedPage(SettingsPage, "Settings")} />
          <Route path="diagnostics" element={guardedPage(DiagnosticsPage, "Diagnostics")} />
          <Route path="import" element={guardedPage(ImportPage, "Import")} />
          <Route path="acquisition" element={guardedPage(AcquisizionePartnerPage, "Acquisition")} />
          <Route path="agent-chat" element={guardedPage(AgentChatHubPage, "AgentChat")} />
          <Route path="contacts" element={guardedPage(ContactsPage, "Contacts")} />
          <Route path="email-download" element={guardedPage(EmailDownloadPage, "EmailDownload")} />
          <Route path="ra-explorer" element={guardedPage(RAExplorerPage, "RAExplorer")} />
          <Route path="ra-scraping" element={guardedPage(RAScrapingEnginePage, "RAScraping")} />
          <Route path="ra-company/:id" element={guardedPage(RACompanyDetailPage, "RACompanyDetail")} />
          <Route path="campaign-jobs" element={guardedPage(CampaignJobsPage, "CampaignJobs")} />
          <Route path="admin-users" element={guardedPage(AdminUsersPage, "AdminUsers")} />
          <Route path="onboarding" element={guardedPage(OnboardingPage, "Onboarding")} />
          <Route path="guida" element={guardedPage(GuidaPage, "Guida")} />
          <Route path="ai-control" element={guardedPage(AIControlCenterPage, "AIControl")} />
          <Route path="email-intelligence" element={guardedPage(EmailIntelligencePage, "EmailIntelligence")} />
          <Route path="ai-arena" element={guardedPage(AIArenaPage, "AIArena")} />
          <Route path="admin/health" element={guardedPage(SystemHealthPage, "SystemHealth")} />
          <Route path="design-system-preview" element={guardedPage(DesignSystemPreviewPage, "DesignSystemPreview")} />
          <Route path="command" element={guardedPage(CommandPage, "Command")} />
          <Route path="*" element={guardedPage(NotFoundPage, "NotFound")} />
        </Route>
      </Routes>
    </Suspense>
  );
}
