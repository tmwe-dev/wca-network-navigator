// TODO(v2-migration): wrapper temporaneo di src/pages/telemetry/. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * TelemetryPage V2 — Admin-only page for telemetry metrics and logs.
 */
import * as React from "react";
import { Suspense, lazy } from "react";
import { useRequireRole } from "@/v2/hooks/useRequireRole";

const V1Component = lazy(() => import("@/pages/telemetry"));

export function TelemetryPage(): React.ReactElement {
  const isAdmin = useRequireRole({ role: "admin" });

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Accesso riservato agli amministratori.
      </div>
    );
  }

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
