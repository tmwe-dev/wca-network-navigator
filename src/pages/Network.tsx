import { lazy, Suspense } from "react";
import { ActiveContextBar } from "@/components/shared/ActiveContextBar";

const Operations = lazy(() => import("./Operations"));

export default function Network() {
  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <ActiveContextBar />
      <Suspense fallback={<div className="h-full animate-pulse bg-muted/20 rounded-lg" />}>
        <Operations />
      </Suspense>
    </div>
  );
}
