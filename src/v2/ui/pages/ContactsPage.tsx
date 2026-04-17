/**
 * ContactsPage V2 — Direct mount, no inner Suspense.
 */
import * as React from "react";
import V1Component from "@/pages/Contacts";

export function ContactsPage(): React.ReactElement {
  return (
    <div data-testid="page-contacts-hub" className="h-full">
      <V1Component />
    </div>
  );
}
