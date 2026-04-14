// TODO(v2-migration): wrapper temporaneo di src/pages/CRM.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * CRMPage V2 — Thin wrapper mounting V1 CRM
 * CRM contatti con drawer, filtri, azioni
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/CRM"));

export function CRMPage(): React.ReactElement {
  return (
    <div data-testid="page-contacts" className="h-full">
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
