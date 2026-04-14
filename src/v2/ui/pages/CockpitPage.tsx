// TODO(v2-migration): wrapper temporaneo di src/pages/Cockpit.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * CockpitPage V2 — Thin wrapper mounting V1 Cockpit with full drag & drop
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const CockpitV1 = lazy(() => import("@/pages/Cockpit"));

export function CockpitPage(): React.ReactElement {
  return (
    <div data-testid="page-cockpit" className="h-full">
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <CockpitV1 />
    </Suspense>
    </div>
  );
}
