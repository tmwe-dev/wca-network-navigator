/**
 * AgendaSection — /v2/agenda con tab interne:
 *  - "Agenda" (default) → AgendaPage (azioni del giorno)
 *  - "Pipeline" → ContactPipelineView (kanban lifecycle clienti contattati)
 *
 * Pipeline è stata spostata qui (rimossa dal menu di primo livello) perché
 * riguarda i contatti già lavorati, coerente con la lettura quotidiana
 * dell'agenda commerciale.
 */
import * as React from "react";
import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { SectionTabs, type SectionTab } from "@/v2/ui/templates/SectionTabs";
import { AgendaPage } from "@/v2/ui/pages/AgendaPage";

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
  { key: "today",     label: "Agenda",    to: "/v2/agenda" },
  { key: "pipeline",  label: "Pipeline",  to: "/v2/agenda/pipeline" },
  { key: "duplicati", label: "Duplicati", to: "/v2/agenda/duplicati" },
];

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export function AgendaSection(): React.ReactElement {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <SectionTabs tabs={TABS} rootPath="/v2/agenda" contentOverflow="contain">
        <Routes>
          <Route index element={<AgendaPage />} />
          <Route
            path="pipeline"
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
          <Route path="*" element={<Navigate to="/v2/agenda" replace />} />
        </Routes>
      </SectionTabs>
    </div>
  );
}
export default AgendaSection;