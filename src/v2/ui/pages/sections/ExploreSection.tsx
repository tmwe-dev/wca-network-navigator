import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { PageHeaderUnified, type PageHeaderTab } from "@/v2/ui/templates/PageHeaderUnified";
import { Compass } from "lucide-react";
import { GlobePage } from "@/v2/ui/pages/GlobePage";
import { DeepSearchPage } from "@/v2/ui/pages/DeepSearchPage";

/**
 * UX redesign apr 2026: la voce "WCA Partner" è confluita nella sezione Contatti
 * come **origine**. Qui in Esplora restano Mappa e Sherlock.
 */
const TABS: readonly PageHeaderTab[] = [
  { key: "map",       label: "Mappa",    to: "/v2/explore/map" },
  { key: "deep",      label: "Sherlock", to: "/v2/explore/deep-search" },
];

export function ExploreSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <PageHeaderUnified
        sectionIcon={Compass}
        sectionLabel="Esplora"
        tabs={TABS}
        rootPath="/v2/explore"
      />
      <div className="flex-1 min-h-0 overflow-hidden">
        <Routes>
          <Route index element={<Navigate to="/v2/explore/map" replace />} />
          <Route path="map"         element={<GlobePage />} />
          {/* WCA Partner ora vive sotto Contatti come origine. */}
          <Route path="network"     element={<Navigate to="/v2/pipeline/contacts?origine=wca" replace />} />
          <Route path="search"      element={<Navigate to="/v2/pipeline/contacts" replace />} />
          <Route path="deep-search" element={<DeepSearchPage />} />
          <Route path="campaigns"   element={<Navigate to="/v2/pipeline/campaigns" replace />} />
          <Route path="*"           element={<Navigate to="/v2/explore/map" replace />} />
        </Routes>
      </div>
    </div>
  );
}
export default ExploreSection;
