import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import PartnerHub from "./pages/PartnerHub";
import Campaigns from "./pages/Campaigns";
import Reminders from "./pages/Reminders";

import DownloadManagement from "./pages/DownloadManagement";
import AcquisizionePartner from "./pages/AcquisizionePartner";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<PartnerHub />} />
            <Route path="/partners" element={<PartnerHub />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/acquisizione" element={<AcquisizionePartner />} />
            <Route path="/download-management" element={<DownloadManagement />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
