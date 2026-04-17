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
import { useOptimusBridgeListener } from "@/hooks/useOptimusBridgeListener";
import { useAiExtractBridgeListener } from "@/hooks/useAiExtractBridgeListener";

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
  useOptimusBridgeListener();
  useAiExtractBridgeListener();
  const outreachQueue = useOutreachQueue();
  const globalSync = useGlobalAutoSync();
  return <>{children({ outreachQueue, globalSync })}</>;
}

/** Stub values used while the real services are still deferred. Shape-compatible. */
const noop = () => { /* deferred */ };
const STUB: BackgroundServicesValues = {
  outreachQueue: {
    pendingCount: 0,
    processing: false,
    paused: false,
    setPaused: noop,
  } as unknown as ReturnType<typeof useOutreachQueue>,
  globalSync: {
    nightPause: false,
    isNightTime: false,
    manualOverride: false,
    toggleNightPause: noop,
    resumeMinutes: 0,
    emailSync: undefined,
  } as unknown as ReturnType<typeof useGlobalAutoSync>,
};

export function BackgroundServices({ children }: Props): React.ReactElement {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const ric: typeof window.requestIdleCallback | undefined = window.requestIdleCallback;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    if (ric) {
      idleHandle = ric(() => setReady(true), { timeout: 2000 });
    } else {
      timeoutHandle = window.setTimeout(() => setReady(true), 1500);
    }
    return () => {
      if (idleHandle != null && window.cancelIdleCallback) window.cancelIdleCallback(idleHandle);
      if (timeoutHandle != null) window.clearTimeout(timeoutHandle);
    };
  }, []);

  if (!ready) return <>{children(STUB)}</>;
  return <ActiveBackgroundServices>{children}</ActiveBackgroundServices>;
}
