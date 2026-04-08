import { lazy, Suspense } from "react";
import { useTrackPage } from "@/hooks/useTrackPage";

const Operations = lazy(() => import("./Operations"));

function TabFallback() {
  return <div className="h-full animate-pulse bg-muted/20 rounded-lg" />;
}

export default function Network() {
  useTrackPage("network");
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <Suspense fallback={<TabFallback />}>
        <Operations />
      </Suspense>
    </div>
  );
}
