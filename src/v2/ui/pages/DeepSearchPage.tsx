/**
 * DeepSearchPage V2
 */
import * as React from "react";

// NOTE: DeepSearchPage uses Network.tsx content from V1
// Import here for now - the full content of Network.tsx was:
// Just a wrapper around <DeepSearchView /> component
// This page is disabled/unused in current routing

export function DeepSearchPage(): React.ReactElement {
  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      Deep Search page - currently unmapped
    </div>
  );
}
