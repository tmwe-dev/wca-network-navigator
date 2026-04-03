/**
 * React hook wrapping the background sync singleton.
 */
import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  bgSyncSubscribe, bgSyncStart, bgSyncStop, bgSyncIsRunning, bgSyncReset,
  type BgSyncProgress,
} from "@/lib/backgroundSync";

export type { BgSyncProgress as SyncProgress };

export function useContinuousSync() {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<BgSyncProgress>(() => ({
    downloaded: 0, batch: 0, lastSubject: "", status: "idle", elapsedSeconds: 0,
  }));
  const [isSyncing, setIsSyncing] = useState(bgSyncIsRunning);

  useEffect(() => {
    return bgSyncSubscribe((p) => {
      setProgress(p);
      setIsSyncing(p.status === "syncing");

      // Refresh queries on each batch
      if (p.status === "syncing" || p.status === "done") {
        queryClient.invalidateQueries({ queryKey: ["channel-messages"] });
        queryClient.invalidateQueries({ queryKey: ["email-count"] });
      }
      if (p.status === "done" || p.status === "error") {
        queryClient.invalidateQueries({ queryKey: ["channel-messages-unread"] });
      }
    });
  }, [queryClient]);

  const startSync = useCallback(() => { bgSyncStart(); }, []);
  const stopSync = useCallback(() => { bgSyncStop(); }, []);

  return { startSync, stopSync, isSyncing, progress };
}

export { bgSyncReset };
