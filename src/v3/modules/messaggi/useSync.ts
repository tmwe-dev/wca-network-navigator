/**
 * Stato della sincronizzazione email per la Inbox V3.
 *
 * Avvolge il singleton esistente `src/lib/backgroundSync` (check-inbox IMAP
 * con BODY.PEEK, nessun auto-read sul server): nessun motore duplicato,
 * solo un ponte verso lo stato condiviso + invalidazione delle chiavi V3.
 */
import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  bgSyncIsRunning,
  bgSyncStart,
  bgSyncStop,
  bgSyncSubscribe,
  type BgSyncProgress,
} from "@/lib/backgroundSync";

export interface UseSyncResult {
  readonly isSyncing: boolean;
  readonly progress: BgSyncProgress;
  readonly avvia: () => void;
  readonly ferma: () => void;
}

export function useSync(): UseSyncResult {
  const queryClient = useQueryClient();
  const [progress, setProgress] = React.useState<BgSyncProgress>(() => ({
    downloaded: 0,
    skipped: 0,
    remaining: 0,
    batch: 0,
    lastSubject: "",
    status: bgSyncIsRunning() ? "syncing" : "idle",
    elapsedSeconds: 0,
  }));

  React.useEffect(() => {
    return bgSyncSubscribe((p) => {
      setProgress(p);
      if (p.status === "done" || p.status === "error") {
        void queryClient.invalidateQueries({ queryKey: ["v3", "messaggi"] });
        void queryClient.invalidateQueries({ queryKey: ["v3", "messaggio"] });
        void queryClient.invalidateQueries({ queryKey: ["v3", "messaggio-thread"] });
      }
    });
  }, [queryClient]);

  const avvia = React.useCallback(() => {
    void bgSyncStart(null);
  }, []);

  const ferma = React.useCallback(() => {
    bgSyncStop();
  }, []);

  return { isSyncing: progress.status === "syncing", progress, avvia, ferma };
}
