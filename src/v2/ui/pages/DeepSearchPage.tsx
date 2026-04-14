// TODO(v2-migration): wrapper temporaneo di src/pages/Network.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * DeepSearchPage V2 — Thin wrapper mounting V1 Network
 * Deep Search ricerca avanzata
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/Network"));

export function DeepSearchPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <V1Component />
    </Suspense>
  );
}
