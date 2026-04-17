/**
 * SettingsPage V2 — Direct mount, no inner Suspense.
 */
import * as React from "react";
import V1Component from "@/pages/Settings";

export function SettingsPage(): React.ReactElement {
  return (
    <div data-testid="page-settings" className="h-full">
      <V1Component />
    </div>
  );
}
