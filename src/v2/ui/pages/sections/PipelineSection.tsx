/**
 * PipelineSection — /v2/pipeline/* with 4 horizontal tabs.
 * Phase 1: each tab routes to the legacy page; later phases refactor them
 * into GoldenLayout in-place.
 */
import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { GoldenHeaderBar } from "@/v2/ui/templates/GoldenHeaderBar";
import { ContactsPage } from "@/v2/ui/pages/ContactsPage";
import { CRMPage } from "@/v2/ui/pages/CRMPage";
import { DealsPage } from "@/v2/ui/pages/DealsPage";
import { AgendaPage } from "@/v2/ui/pages/AgendaPage";
import { Campaigns as CampaignsPage } from "@/v2/ui/pages/CampaignsPage";

const TABS: readonly SectionTab[] = [
  { key: "contacts", label: "Contatti", to: "/v2/pipeline/contacts" },
  { key: "kanban",   label: "Kanban",   to: "/v2/pipeline/kanban"   },
  { key: "deals",    label: "Deals",    to: "/v2/pipeline/deals"    },
  { key: "campaigns",label: "Campagne", to: "/v2/pipeline/campaigns"},
  { key: "agenda",   label: "Agenda",   to: "/v2/pipeline/agenda"   },
];

export function PipelineSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GoldenHeaderBar />
      <SectionTabs tabs={TABS} rootPath="/v2/pipeline" contentOverflow="contain">
        <Routes>
          <Route index element={<Navigate to="/v2/pipeline/contacts" replace />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="kanban"   element={<CRMPage />} />
          <Route path="deals"    element={<DealsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="agenda"   element={<AgendaPage />} />
          <Route path="*"        element={<Navigate to="/v2/pipeline/contacts" replace />} />
        </Routes>
      </SectionTabs>
    </div>
  );
}
export default PipelineSection;
