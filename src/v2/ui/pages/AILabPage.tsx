// TODO(v2-migration): wrapper temporaneo di src/pages/AILab.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * AILabPage V2 — Thin wrapper mounting V1 AILab
 * AI Lab playground
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/AILab"));

export function AILabPage(): React.ReactElement {
  return (
    <div data-testid="page-ai-lab" className="h-full">
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
