// TODO(v2-migration): wrapper temporaneo di src/pages/Settings.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * SettingsPage V2 — Thin wrapper mounting V1 Settings
 * Settings con SMTP, LinkedIn, prompt, KB
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/Settings"));

export function SettingsPage(): React.ReactElement {
  return (
    <div data-testid="page-settings" className="h-full">
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
