/**
 * OutreachPage V2 — Thin wrapper mounting V1 Outreach with all tabs
 * (Cockpit, In Uscita, Attività, Circuito/HoldingPattern, Coda AI)
 */
import * as React from "react";
import { Suspense, lazy } from "react";

const OutreachV1 = lazy(() => import("@/pages/Outreach"));

export function OutreachPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <OutreachV1 />
    </Suspense>
  );
}
