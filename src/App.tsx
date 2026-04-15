import { Suspense } from "react";
import { V2Routes } from "@/v2/routes";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { ContactDrawerProvider } from "@/contexts/ContactDrawerContext";
import { ActiveOperatorProvider } from "@/contexts/ActiveOperatorContext";
const ContactRecordDrawer = lazyRetry(() => import("@/components/contact-drawer/ContactRecordDrawer").then(m => ({ default: m.ContactRecordDrawer })));
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { BackgroundSyncIndicator } from "@/components/BackgroundSyncIndicator";

import { GlobalErrorBoundary } from "@/components/system/GlobalErrorBoundary";
const RuntimeDiagnosticPanel = lazyRetry(() => import("@/components/system/RuntimeDiagnosticPanel").then(m => ({ default: m.RuntimeDiagnosticPanel })));
import { withFeatureBoundary } from "@/components/system/FeatureErrorBoundary";
import { ConnectionBanner } from "@/components/system/ConnectionBanner";
import { ViteChunkRecovery } from "@/components/system/ViteChunkRecovery";
import { lazyRetry } from "@/lib/lazyRetry";

const Auth = lazyRetry(() => import("./pages/Auth"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));

// Prefetch high-traffic routes after initial load
if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    setTimeout(() => {
      import("./v2/ui/pages/NetworkPage");
      import("./v2/ui/pages/OutreachPage");
      import("./v2/ui/pages/CRMPage");
    }, 8000);
  }, { once: true });
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span>Caricamento applicazione…</span>
      </div>
    </div>
  );
}

const App = () => (
  <GlobalErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ContactDrawerProvider>
      <ActiveOperatorProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ViteChunkRecovery />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Root → V2 */}
              <Route path="/" element={<Navigate to="/v2" replace />} />

              {/* Public routes */}
              <Route path="/auth" element={<Auth />} />

              {/* V1 catch-all → V2 redirect */}
              <Route path="/v1/*" element={<Navigate to="/v2" replace />} />

              {/* V2 routes */}
              <Route path="/v2/*" element={withFeatureBoundary(<V2Routes />, "V2")} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          {/* Global singletons — gated by auth internally */}
          <BackgroundSyncIndicator />
          <ConnectionBanner />
          <RuntimeDiagnosticPanel />
        </BrowserRouter>
        <ContactRecordDrawer />
      </TooltipProvider>
      </ActiveOperatorProvider>
      </ContactDrawerProvider>
    </QueryClientProvider>
  </GlobalErrorBoundary>
);

export default App;
