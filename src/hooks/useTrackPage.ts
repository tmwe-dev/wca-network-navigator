import { useEffect } from "react";
import { trackPage } from "@/lib/telemetry";

/**
 * useTrackPage — fire a page_view event when a route component mounts.
 * Call in any page component:
 *   useTrackPage("network");
 */
export function useTrackPage(pageName: string, props?: Record<string, unknown>) {
  useEffect(() => {
    trackPage(pageName, props);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageName]);
}
