// TODO(v2-migration): wrapper temporaneo di src/pages/Contacts.tsx. Tracked in docs/v2/MIGRATION_STATUS.md.
/**
 * ContactsPage V2 — Thin wrapper mounting V1 Contacts
 * Contacts rubrica completa
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const V1Component = lazy(() => import("@/pages/Contacts"));

export function ContactsPage(): React.ReactElement {
  return (
    <div data-testid="page-contacts-hub" className="h-full">
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
