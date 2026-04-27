import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { GlobePage } from "@/v2/ui/pages/GlobePage";
import { NetworkPage } from "@/v2/ui/pages/NetworkPage";
import { DeepSearchPage } from "@/v2/ui/pages/DeepSearchPage";
import { Campaigns as CampaignsPage } from "@/v2/ui/pages/CampaignsPage";
import { ContactsPage } from "@/v2/ui/pages/ContactsPage";

const TABS: readonly SectionTab[] = [
  { key: "map",       label: "Mappa",       to: "/v2/explore/map" },
  { key: "search",    label: "Cerca",       to: "/v2/explore/search" },
  { key: "deep",      label: "Deep Search", to: "/v2/explore/deep-search" },
  { key: "campaigns", label: "Campagne",    to: "/v2/explore/campaigns" },
];

export function ExploreSection(): React.ReactElement {
  return (
    <SectionTabs tabs={TABS} rootPath="/v2/explore">
      <Routes>
        <Route index element={<Navigate to="/v2/explore/map" replace />} />
        <Route path="map"         element={<GlobePage />} />
        <Route path="network"     element={<NetworkPage />} />
        <Route path="search"      element={<ContactsPage />} />
        <Route path="deep-search" element={<DeepSearchPage />} />
        <Route path="campaigns"   element={<CampaignsPage />} />
        <Route path="*"           element={<Navigate to="/v2/explore/map" replace />} />
      </Routes>
    </SectionTabs>
  );
}
export default ExploreSection;
