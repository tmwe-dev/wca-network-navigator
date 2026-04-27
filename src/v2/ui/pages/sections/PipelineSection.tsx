/**
 * PipelineSection — /v2/pipeline/* with 4 horizontal tabs.
 * Phase 1: each tab routes to the legacy page; later phases refactor them
 * into GoldenLayout in-place.
 */
import * as React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { ContactsPage } from "@/v2/ui/pages/ContactsPage";
import { CRMPage } from "@/v2/ui/pages/CRMPage";
import { DealsPage } from "@/v2/ui/pages/DealsPage";
import { AgendaPage } from "@/v2/ui/pages/AgendaPage";

const TABS: readonly SectionTab[] = [
  { key: "contacts", label: "Contatti", to: "/v2/pipeline/contacts" },
  { key: "kanban",   label: "Kanban",   to: "/v2/pipeline/kanban"   },
  { key: "deals",    label: "Deals",    to: "/v2/pipeline/deals"    },
  { key: "agenda",   label: "Agenda",   to: "/v2/pipeline/agenda"   },
];

export function PipelineSection(): React.ReactElement {
  return (
    <SectionTabs tabs={TABS} rootPath="/v2/pipeline">
      <Routes>
        <Route index element={<Navigate to="/v2/pipeline/contacts" replace />} />
        <Route path="contacts" element={<ContactsPage />} />
        <Route path="kanban"   element={<CRMPage />} />
        <Route path="deals"    element={<DealsPage />} />
        <Route path="agenda"   element={<AgendaPage />} />
        <Route path="*"        element={<Navigate to="/v2/pipeline/contacts" replace />} />
      </Routes>
    </SectionTabs>
  );
}
export default PipelineSection;
