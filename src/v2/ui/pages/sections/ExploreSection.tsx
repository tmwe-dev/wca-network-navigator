import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { GoldenHeaderBar } from "@/v2/ui/templates/GoldenHeaderBar";
import { GlobePage } from "@/v2/ui/pages/GlobePage";
import { NetworkPage } from "@/v2/ui/pages/NetworkPage";
import { DeepSearchPage } from "@/v2/ui/pages/DeepSearchPage";

const TABS: readonly SectionTab[] = [
  { key: "network",   label: "WCA Partner", to: "/v2/explore/network" },
  { key: "map",       label: "Mappa",       to: "/v2/explore/map" },
  { key: "deep",      label: "Sherlock",    to: "/v2/explore/deep-search" },
];

export function ExploreSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GoldenHeaderBar />
      <SectionTabs tabs={TABS} rootPath="/v2/explore" contentOverflow="contain">
        <Routes>
          <Route index element={<Navigate to="/v2/explore/network" replace />} />
          <Route path="map"         element={<GlobePage />} />
          <Route path="network"     element={<NetworkPage />} />
          <Route path="search"      element={<Navigate to="/v2/pipeline/contacts" replace />} />
          <Route path="deep-search" element={<DeepSearchPage />} />
          <Route path="campaigns"   element={<Navigate to="/v2/pipeline/campaigns" replace />} />
          <Route path="*"           element={<Navigate to="/v2/explore/map" replace />} />
        </Routes>
      </SectionTabs>
    </div>
  );
}
export default ExploreSection;
