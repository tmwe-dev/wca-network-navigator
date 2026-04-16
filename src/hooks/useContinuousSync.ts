/**
 * React hook wrapping the background sync singleton.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryKeys";
import {
  bgSyncSubscribe, bgSyncStart, bgSyncStop, bgSyncIsRunning, bgSyncReset,
  type BgSyncProgress,
} from "@/lib/backgroundSync";

export type { BgSyncProgress as SyncProgress };

const COUNT_THROTTLE_MS = 30_000;

export function useContinuousSync() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<BgSyncProgress>(() => ({
    downloaded: 0, skipped: 0, remaining: 0, batch: 0, lastSubject: "", status: "idle", elapsedSeconds: 0,
  }));
  const [isSyncing, setIsSyncing] = useState(bgSyncIsRunning);
  const lastCountInvalidation = useRef(0);

  useEffect(() => {
    return bgSyncSubscribe((p) => {
      setProgress(p);
      setIsSyncing(p.status === "syncing");

      // During syncing: realtime handles list updates — only throttle count
      if (p.status === "syncing") {
        const now = Date.now();
        if (now - lastCountInvalidation.current > COUNT_THROTTLE_MS) {
          lastCountInvalidation.current = now;
          queryClient.invalidateQueries({ queryKey: queryKeys.email.count });
        }
        return;
      }

      // On done/error: full refresh
      if (p.status === "done" || p.status === "error") {
        queryClient.invalidateQueries({ queryKey: queryKeys.channelMessages.root });
        queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
        queryClient.invalidateQueries({ queryKey: queryKeys.email.count });
      }
    });
  }, [queryClient]);

  const startSync = useCallback(() => { bgSyncStart(); }, []);
  const stopSync = useCallback(() => { bgSyncStop(); }, []);

  return { startSync, stopSync, isSyncing, progress };
}

export { bgSyncReset };
