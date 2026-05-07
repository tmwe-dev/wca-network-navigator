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

const ContactPipelineView = lazy(() =>
  import("@/components/contacts/ContactPipelineView").then((m) => ({
    default: m.ContactPipelineView,
  })),
);
const DuplicateDetector = lazy(() =>
  import("@/components/contacts/DuplicateDetector").then((m) => ({
    default: m.DuplicateDetector,
  })),
);

const TABS: readonly SectionTab[] = [
  { key: "kanban",     label: "Kanban",       to: "/v2/pipeline/kanban"     },
  { key: "duplicati",  label: "Duplicati",    to: "/v2/pipeline/duplicati"  },
];

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function PipelineSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionTabs tabs={TABS} rootPath="/v2/pipeline" contentOverflow="contain">
        <Routes>
          <Route index element={<Navigate to="/v2/pipeline/kanban" replace />} />
          {/* Moved to /v2/explore — keep redirects for backward compat */}
          <Route path="contacts"  element={<Navigate to="/v2/explore/contacts" replace />} />
          <Route path="biglietti" element={<Navigate to="/v2/explore/biglietti" replace />} />
          <Route path="campaigns" element={<Navigate to="/v2/communicate/campaigns" replace />} />
          <Route path="agenda"    element={<Navigate to="/v2/agenda" replace />} />
          <Route
            path="kanban"
            element={
              <Suspense fallback={<TabFallback />}>
                <ContactPipelineView />
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
          {/* Legacy: deals removed → redirect to default */}
          <Route path="deals"     element={<Navigate to="/v2/pipeline/kanban" replace />} />
          <Route path="*"         element={<Navigate to="/v2/pipeline/kanban" replace />} />
        </Routes>
      </SectionTabs>
    </div>
  );
}
export default PipelineSection;
