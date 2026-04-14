// TODO(v2-migration): wrapper temporaneo di src/pages/Agenda.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * AgendaPage V2 — Thin wrapper mounting V1 Agenda
 * Agenda attività e follow-up
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/Agenda"));

export function AgendaPage(): React.ReactElement {
  return (
    <div data-testid="page-agenda" className="h-full">
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <V1Component />
    </Suspense>
    </div>
  );
}
