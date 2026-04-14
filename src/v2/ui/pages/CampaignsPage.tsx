// TODO(v2-migration): wrapper temporaneo di src/pages/Campaigns.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * CampaignsPage V2 — Thin wrapper mounting V1 Campaigns with globe, wizard, queue
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const CampaignsV1 = lazy(() => import("@/pages/Campaigns"));

export function CampaignsPage(): React.ReactElement {
  return (
    <div data-testid="page-campaigns" className="h-full">
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <CampaignsV1 />
    </Suspense>
    </div>
  );
}
