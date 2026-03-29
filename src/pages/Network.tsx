import { lazy, Suspense } from "react";

const Operations = lazy(() => import("./Operations"));

export default function Network() {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Suspense fallback={<div className="h-full animate-pulse bg-muted/20 rounded-lg" />}>
        <Operations />
      </Suspense>
    </div>
  );
}
