import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
import { RuntimeDiagnosticPanel } from "@/components/system/RuntimeDiagnosticPanel";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import PartnerHub from "./pages/PartnerHub";
import Campaigns from "./pages/Campaigns";
import Reminders from "./pages/Reminders";
import AcquisizionePartner from "./pages/AcquisizionePartner";
import Operations from "./pages/Operations";
import Settings from "./pages/Settings";
import Guida from "./pages/Guida";
import ProspectCenter from "./pages/ProspectCenter";
import CampaignJobs from "./pages/CampaignJobs";
import EmailComposer from "./pages/EmailComposer";
import Workspace from "./pages/Workspace";
import Sorting from "./pages/Sorting";
import Import from "./pages/Import";
import Global from "./pages/Global";
import TestDownload from "./pages/TestDownload";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ConnectionBanner />
          <RuntimeDiagnosticPanel />
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/onboarding" element={<Onboarding />} />

            {/* Protected routes */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<Operations />} />
                <Route path="/operations" element={<Operations />} />
                <Route path="/campaigns" element={<Campaigns />} />
                <Route path="/acquisizione" element={<AcquisizionePartner />} />
                <Route path="/reminders" element={<Reminders />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/prospects" element={<ProspectCenter />} />
                <Route path="/partner-hub" element={<PartnerHub />} />
                <Route path="/guida" element={<Guida />} />
                <Route path="/campaign-jobs" element={<CampaignJobs />} />
                <Route path="/email-composer" element={<EmailComposer />} />
                <Route path="/workspace" element={<Workspace />} />
                <Route path="/sorting" element={<Sorting />} />
                <Route path="/import" element={<Import />} />
                <Route path="/global" element={<Global />} />
                <Route path="/test-download" element={<TestDownload />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
