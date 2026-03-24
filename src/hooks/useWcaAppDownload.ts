/**
 * useWcaAppDownload — Hook per download WCA via wca-app API
 * 🤖 Creato da Claude · Diario di bordo #1
 * 
 * Usa le API Vercel di wca-app come engine di download.
 * Integra la directory locale per confronto istantaneo e ripresa.
 */

import { useState, useRef, useCallback } from "react";
import { wcaLogin, wcaDiscover, wcaScrape, wcaSave, wcaDiscoverAll } from "@/lib/wca-app-bridge";
import {
  createDirectory,
  markIdDone,
  markIdFailed,
  getPendingIds,
  getDoneCount,
  getTotalCount,
  isCountryCompleted,
  checkMissingIdsLocal,
  saveSuspendedJob,
  removeSuspendedJob,
  getSuspendedJobs,
  type SuspendedJob,
} from "@/lib/localDirectory";

export interface DownloadProgress {
  phase: "idle" | "login" | "discover" | "compare" | "download" | "done" | "error" | "paused";
  current: number;
  total: number;
  message: string;
  countryCode?: string;
}

// Delay pattern dal wca-app originale
const DELAY_PATTERN = [3, 3, 2, 3, 8, 3, 5, 3, 12, 3, 4, 3, 6, 3, 9, 3, 3, 3, 10];

function getDelay(index: number): number {
  return (DELAY_PATTERN[index % DELAY_PATTERN.length] || 3) * 1000;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

export function useWcaAppDownload() {
  const [progress, setProgress] = useState<DownloadProgress>({
    phase: "idle", current: 0, total: 0, message: "",
  });
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateProgress = (p: Partial<DownloadProgress>) =>
    setProgress((prev) => ({ ...prev, ...p }));

  /** Avvia download completo per un paese */
  const startDownload = useCallback(async (
    countryCode: string,
    countryName: string,
    username: string,
    password: string
  ) => {
    if (isRunning) return;
    setIsRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // 1. Login
      updateProgress({ phase: "login", message: `Login WCA...`, countryCode });
      const cookie = await wcaLogin(username, password);

      // 2. Discover
      updateProgress({ phase: "discover", message: `Scoperta membri ${countryName}...` });
      const members = await wcaDiscoverAll(countryCode, cookie, (page, total) => {
        updateProgress({ message: `Discover ${countryName}: pagina ${page}/${total}` });
      });

      if (ac.signal.aborted) return;

      // 3. Crea directory locale
      const memberIds = members.map((m) => m.id);
      createDirectory(countryCode, countryName, memberIds);

      // 4. Confronto istantaneo (zero query!)
      updateProgress({ phase: "compare", message: `Confronto locale...` });
      const { missing, found } = checkMissingIdsLocal(memberIds, countryCode);

      if (missing.length === 0) {
        updateProgress({ phase: "done", current: found, total: found, message: `${countryName} completo! ${found} partner già scaricati.` });
        removeSuspendedJob(countryCode);
        return;
      }

      updateProgress({
        phase: "download",
        current: 0,
        total: missing.length,
        message: `${found} già fatti, ${missing.length} da scaricare`,
      });

      // 5. Download
      let downloaded = 0;
      for (let i = 0; i < missing.length; i++) {
        if (ac.signal.aborted) {
          saveSuspendedJob(countryCode, countryName);
          updateProgress({ phase: "paused", message: `Sospeso: ${downloaded}/${missing.length}` });
          return;
        }

        const id = missing[i];
        updateProgress({
          current: i + 1,
          total: missing.length,
          message: `Scaricando ${i + 1}/${missing.length} (ID: ${id})`,
        });

        try {
          const result = await wcaScrape(id, cookie);
          if (result.success && result.found && result.partner) {
            await wcaSave(result.partner);
            markIdDone(countryCode, id);
            downloaded++;
          } else {
            markIdFailed(countryCode, id);
          }
        } catch (err) {
          markIdFailed(countryCode, id);
          console.warn(`[WCA-DL] Errore ID ${id}:`, err);
        }

        // Delay pattern
        if (i < missing.length - 1) {
          await sleep(getDelay(i), ac.signal);
        }
      }

      // 6. Completato
      removeSuspendedJob(countryCode);
      updateProgress({
        phase: "done",
        current: missing.length,
        total: missing.length,
        message: `${countryName} completato! ${downloaded} nuovi partner scaricati.`,
      });

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore sconosciuto";
      updateProgress({ phase: "error", message: msg });
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [isRunning]);

  /** Riprendi download sospeso (zero query!) */
  const resumeDownload = useCallback(async (
    countryCode: string,
    countryName: string,
    username: string,
    password: string
  ) => {
    if (isRunning) return;
    const pending = getPendingIds(countryCode);
    if (pending.length === 0) {
      updateProgress({ phase: "done", message: `${countryName} già completo!` });
      return;
    }

    setIsRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      updateProgress({ phase: "login", message: "Login WCA..." });
      const cookie = await wcaLogin(username, password);

      const done = getDoneCount(countryCode);
      const total = getTotalCount(countryCode);
      updateProgress({
        phase: "download",
        current: 0,
        total: pending.length,
        message: `Ripresa ${countryName}: ${done}/${total} fatti, ${pending.length} rimanenti`,
      });

      let downloaded = 0;
      for (let i = 0; i < pending.length; i++) {
        if (ac.signal.aborted) {
          saveSuspendedJob(countryCode, countryName);
          updateProgress({ phase: "paused", message: `Sospeso: ${downloaded} nuovi scaricati` });
          return;
        }

        const id = pending[i];
        updateProgress({
          current: i + 1,
          total: pending.length,
          message: `Scaricando ${i + 1}/${pending.length} (ID: ${id})`,
        });

        try {
          const result = await wcaScrape(id, cookie);
          if (result.success && result.found && result.partner) {
            await wcaSave(result.partner);
            markIdDone(countryCode, id);
            downloaded++;
          } else {
            markIdFailed(countryCode, id);
          }
        } catch {
          markIdFailed(countryCode, id);
        }

        if (i < pending.length - 1) {
          await sleep(getDelay(i), ac.signal);
        }
      }

      removeSuspendedJob(countryCode);
      updateProgress({
        phase: "done",
        current: pending.length,
        total: pending.length,
        message: `${countryName} completato! ${downloaded} nuovi partner.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore";
      updateProgress({ phase: "error", message: msg });
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }, [isRunning]);

  /** Stop download */
  const stopDownload = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /** Lista jobs sospesi */
  const suspendedJobs = useCallback((): SuspendedJob[] => {
    return getSuspendedJobs();
  }, []);

  /** Verifica se un paese è completo */
  const isComplete = useCallback((countryCode: string): boolean => {
    return isCountryCompleted(countryCode);
  }, []);

  return {
    progress,
    isRunning,
    startDownload,
    resumeDownload,
    stopDownload,
    suspendedJobs,
    isComplete,
  };
}
