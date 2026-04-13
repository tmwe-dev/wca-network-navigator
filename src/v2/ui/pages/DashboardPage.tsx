/**
 * DashboardPage V2 — Thin wrapper mounting V1 SuperHome3D
 * Dashboard con globo 3D interattivo
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/SuperHome3D"));

export function DashboardPage(): React.ReactElement {
  return (
    <div data-testid="page-dashboard" className="h-full">
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
