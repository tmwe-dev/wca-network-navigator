import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { GlobePage } from "@/v2/ui/pages/GlobePage";
import { NetworkPage } from "@/v2/ui/pages/NetworkPage";
import { DeepSearchPage } from "@/v2/ui/pages/DeepSearchPage";
import { ContactsPage } from "@/v2/ui/pages/ContactsPage";

const BCAUnifiedHub = lazy(() => import("@/components/contacts/bca/BCAUnifiedHub"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function ExploreSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route index element={<Navigate to="/v2/explore/network" replace />} />
          <Route path="map"         element={<GlobePage />} />
          <Route path="network"     element={<NetworkPage />} />
          <Route path="contacts"    element={<ContactsPage />} />
          <Route
            path="biglietti"
            element={
              <Suspense fallback={<TabFallback />}>
                <BCAUnifiedHub />
              </Suspense>
            }
          />
          <Route path="search"      element={<Navigate to="/v2/explore/contacts" replace />} />
          <Route path="deep-search" element={<DeepSearchPage />} />
          <Route path="campaigns"   element={<Navigate to="/v2/pipeline/campaigns" replace />} />
          <Route path="*"           element={<Navigate to="/v2/explore/map" replace />} />
        </Routes>
      </div>
    </div>
  );
}
export default ExploreSection;
