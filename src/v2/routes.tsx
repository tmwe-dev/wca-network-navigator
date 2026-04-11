/**
 * Routes v2 — Complete routing with all 37 pages
 */
import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import { AuthenticatedLayout } from "./ui/templates/AuthenticatedLayout";
import { PublicLayout } from "./ui/templates/PublicLayout";

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

// ── Loading fallback ─────────────────────────────────────────────────
function LoadingFallback(): React.ReactElement {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────────────
export function V2Routes(): React.ReactElement {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public routes */}
        <Route element={<PublicLayout />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />
        </Route>

        {/* Authenticated routes */}
        <Route element={<AuthenticatedLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="network" element={<NetworkPage />} />
          <Route path="crm" element={<CRMPage />} />
          <Route path="outreach" element={<OutreachPage />} />
          <Route path="inreach" element={<InreachPage />} />
          <Route path="agenda" element={<AgendaPage />} />
          <Route path="email-composer" element={<EmailComposerPage />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="cockpit" element={<CockpitPage />} />
          <Route path="missions" element={<MissionBuilderPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="prospects" element={<ProspectPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="ai-lab" element={<AILabPage />} />
          <Route path="knowledge-base" element={<KnowledgeBasePage />} />
          <Route path="research" element={<RADashboardPage />} />
          <Route path="globe" element={<GlobePage />} />
          <Route path="deep-search" element={<DeepSearchPage />} />
          <Route path="sorting" element={<SortingPage />} />
          <Route path="telemetry" element={<TelemetryPage />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="acquisition" element={<AcquisizionePartnerPage />} />
          <Route path="agent-chat" element={<AgentChatHubPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="email-download" element={<EmailDownloadPage />} />
          <Route path="ra-explorer" element={<RAExplorerPage />} />
          <Route path="ra-scraping" element={<RAScrapingEnginePage />} />
          <Route path="ra-company" element={<RACompanyDetailPage />} />
          <Route path="campaign-jobs" element={<CampaignJobsPage />} />
          <Route path="admin-users" element={<AdminUsersPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
          <Route path="guida" element={<GuidaPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
