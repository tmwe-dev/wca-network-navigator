// TODO(v2-migration): wrapper temporaneo di src/pages/AdminUsers.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * AdminUsersPage V2 — Thin wrapper mounting V1 AdminUsers
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/AdminUsers"));

export function AdminUsersPage(): React.ReactElement {
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
