/**
 * PipelineSection — /v2/pipeline/* flat-tab navigation.
 *
 * UX cleanup (apr 2026):
 *  - Removed Deals tab (feature dismessa, business non prevedibile).
 *  - Tabs flat: Contatti | Kanban | Biglietti | Duplicati | Campagne | Agenda.
 *  - Single GoldenHeaderBar at section level (no nested breadcrumbs).
 *  - Kanban routes to the real ContactPipelineView (lifecycle drag-and-drop).
 */
import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { GoldenHeaderBar } from "@/v2/ui/templates/GoldenHeaderBar";
import { ContactsPage } from "@/v2/ui/pages/ContactsPage";
import { AgendaPage } from "@/v2/ui/pages/AgendaPage";
import { Campaigns as CampaignsPage } from "@/v2/ui/pages/CampaignsPage";

const ContactPipelineView = lazy(() =>
  import("@/components/contacts/ContactPipelineView").then((m) => ({
    default: m.ContactPipelineView,
  })),
);
const BusinessCardsHub = lazy(() => import("@/components/contacts/BusinessCardsHub"));
const DuplicateDetector = lazy(() =>
  import("@/components/contacts/DuplicateDetector").then((m) => ({
    default: m.DuplicateDetector,
  })),
);

const TABS: readonly SectionTab[] = [
  { key: "contacts",   label: "Contatti CRM", to: "/v2/pipeline/contacts"   },
  { key: "kanban",     label: "Kanban",       to: "/v2/pipeline/kanban"     },
  { key: "biglietti",  label: "Biglietti",    to: "/v2/pipeline/biglietti"  },
  { key: "duplicati",  label: "Duplicati",    to: "/v2/pipeline/duplicati"  },
  { key: "campaigns",  label: "Campagne",     to: "/v2/pipeline/campaigns"  },
  { key: "agenda",     label: "Agenda",       to: "/v2/pipeline/agenda"     },
];

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function PipelineSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <GoldenHeaderBar />
      <SectionTabs tabs={TABS} rootPath="/v2/pipeline" contentOverflow="contain">
        <Routes>
          <Route index element={<Navigate to="/v2/pipeline/contacts" replace />} />
          <Route path="contacts"  element={<ContactsPage />} />
          <Route
            path="kanban"
            element={
              <Suspense fallback={<TabFallback />}>
                <ContactPipelineView />
              </Suspense>
            }
          />
          <Route
            path="biglietti"
            element={
              <Suspense fallback={<TabFallback />}>
                <BusinessCardsHub />
              </Suspense>
            }
          />
          <Route
            path="duplicati"
            element={
              <Suspense fallback={<TabFallback />}>
                <DuplicateDetector />
              </Suspense>
            }
          />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="agenda"    element={<AgendaPage />} />
          {/* Legacy: deals removed → redirect to default */}
          <Route path="deals"     element={<Navigate to="/v2/pipeline/kanban" replace />} />
          <Route path="*"         element={<Navigate to="/v2/pipeline/contacts" replace />} />
        </Routes>
      </SectionTabs>
    </div>
  );
}
export default PipelineSection;
