/**
 * ProspectPage V2 — Thin wrapper mounting V1 ProspectCenter
 * Prospect Center prospecting
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/ProspectCenter"));

export function ProspectPage(): React.ReactElement {
  return (
    <div data-testid="page-prospects" className="h-full">
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
