import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import PartnerHub from "./pages/PartnerHub";
import Campaigns from "./pages/Campaigns";
import Reminders from "./pages/Reminders";
import DownloadManagement from "./pages/DownloadManagement";
import AcquisizionePartner from "./pages/AcquisizionePartner";
import Operations from "./pages/Operations";
import Settings from "./pages/Settings";
import Guida from "./pages/Guida";
import ProspectCenter from "./pages/ProspectCenter";
import CampaignJobs from "./pages/CampaignJobs";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
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
              <Route path="/download-management" element={<DownloadManagement />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/prospects" element={<ProspectCenter />} />
              <Route path="/guida" element={<Guida />} />
              <Route path="/campaign-jobs" element={<CampaignJobs />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
