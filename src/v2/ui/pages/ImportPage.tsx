/**
 * ImportPage V2 — Thin wrapper mounting V1 Operations
 * Import e operazioni batch
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/Operations"));

export function ImportPage(): React.ReactElement {
  return (
    <div data-testid="page-import" className="h-full">
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
