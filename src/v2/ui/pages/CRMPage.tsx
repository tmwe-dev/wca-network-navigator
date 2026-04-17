/**
 * CRMPage V2 — Direct mount, no inner Suspense (handled by guardedPage).
 */
import * as React from "react";
import V1Component from "@/pages/CRM";

export function CRMPage(): React.ReactElement {
  return (
    <div data-testid="page-contacts" className="h-full">
      <V1Component />
    </div>
  );
}
