/**
 * DashboardPage V2 — Direct mount, no inner Suspense.
 */
import * as React from "react";
import V1Component from "@/pages/SuperHome3D";

export function DashboardPage(): React.ReactElement {
  return (
    <div data-testid="page-dashboard" className="h-full">
      <V1Component />
    </div>
  );
}
