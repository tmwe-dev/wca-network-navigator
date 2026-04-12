/**
 * EmailComposerPage V2 — Thin wrapper mounting V1 EmailComposer with Oracle, ContactPicker, templates
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const EmailComposerV1 = lazy(() => import("@/pages/EmailComposer"));

export function EmailComposerPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <EmailComposerV1 />
    </Suspense>
  );
}
