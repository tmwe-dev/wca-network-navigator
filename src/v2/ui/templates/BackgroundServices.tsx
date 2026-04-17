/**
 * BackgroundServices — Hosts non-critical background hooks that should NOT
 * block first paint. Mounted via requestIdleCallback after the layout is
 * interactive. Returns the live values via render-prop so the parent can wire
 * them into UI controls (sync indicator, queue badge, etc.).
 */
import * as React from "react";
import { useJobHealthMonitor } from "@/hooks/useJobHealthMonitor";
import { useWcaSync } from "@/hooks/useWcaSync";
import { useOutreachQueue } from "@/hooks/useOutreachQueue";
import { useGlobalAutoSync } from "@/hooks/useGlobalAutoSync";

export interface BackgroundServicesValues {
  outreachQueue: ReturnType<typeof useOutreachQueue>;
  globalSync: ReturnType<typeof useGlobalAutoSync>;
}

interface Props {
  children: (v: BackgroundServicesValues) => React.ReactNode;
}

/** Real implementation — only mounted after first idle. */
function ActiveBackgroundServices({ children }: Props): React.ReactElement {
  useJobHealthMonitor();
  useWcaSync();
  const outreachQueue = useOutreachQueue();
  const globalSync = useGlobalAutoSync();
  return <>{children({ outreachQueue, globalSync })}</>;
}

/** Stub values used while the real services are still deferred. */
const STUB: BackgroundServicesValues = {
  outreachQueue: undefined as unknown as ReturnType<typeof useOutreachQueue>,
  globalSync: undefined as unknown as ReturnType<typeof useGlobalAutoSync>,
};

export function BackgroundServices({ children }: Props): React.ReactElement {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const ric: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
    const handle = ric
      ? ric(() => setReady(true), { timeout: 2000 })
      : window.setTimeout(() => setReady(true), 1500);
    return () => {
      if (ric && typeof handle === "number") window.cancelIdleCallback(handle);
      else window.clearTimeout(handle as number);
    };
  }, []);

  if (!ready) return <>{children(STUB)}</>;
  return <ActiveBackgroundServices>{children}</ActiveBackgroundServices>;
}
