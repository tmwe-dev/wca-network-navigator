/**
 * KnowledgeBasePage V2 — Thin wrapper mounting V1 StaffDirezionale
 * Knowledge Base gestione KB
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/StaffDirezionale"));

export function KnowledgeBasePage(): React.ReactElement {
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
