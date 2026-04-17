/**
 * OutreachPage V2 — Direct mount, no inner Suspense.
 */
import * as React from "react";
import OutreachV1 from "@/pages/Outreach";

export function OutreachPage(): React.ReactElement {
  return (
    <div data-testid="page-outreach" className="h-full">
      <OutreachV1 />
    </div>
  );
}
