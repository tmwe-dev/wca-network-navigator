/**
 * useWcaAppDownload — Hook per download WCA via wca-app API
 * 🤖 Claude Engine V8 · Auto-login — nessuna credenziale richiesta
 *
 * Usa le API Vercel di wca-app come engine di download.
 * Login automatico: il server gestisce le credenziali internamente.
 * Integra la directory locale per confronto istantaneo e ripresa.
 * Supporta sia download client-side che job server-side.
 */

import { useState, useRef, useCallback } from "react";
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
  getMemberNetworkDomain,
  type SuspendedJob,
} from "@/lib/localDirectory";
import {
  wcaLogin,
  wcaDiscoverAll,
  wcaScrape,
  wcaSave,
  wcaCheckIds,
  wcaJobStart,
  wcaJobStatus,
  type WcaJob,
} from "@/lib/api/wcaAppApi";

export interface DownloadProgress {
  phase: "idle" | "login" | "discover" | "compare" | "download" | "done" | "error" | "paused";
  current: number;
  total: number;
  message: string;
  countryCode?: string;
  /** ID del job server-side (se attivo) */
  serverJobId?: string;
}

// Delay pattern dal wca-app originale
const DELAY_PATTERN = [3, 3, 2, 3, 8, 3, 5, 3, 12, 3, 4, 3, 6, 3, 9, 3, 3, 3, 10];
const BATCH_SIZE = 20;        // Ogni N profili → pausa lunga
const BATCH_PAUSE_S = 15;     // Pausa batch in secondi
const CB_THRESHOLD = 5;       // Errori consecutivi prima di circuit break
const CB_PAUSE_S = 30;        // Pausa circuit breaker in secondi

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

/** Scrape singolo via API centralizzata — con network domain per accesso diretto */
async function scrapeOne(memberId: number, networkDomain?: string): Promise<{ success: boolean; found?: boolean; profile?: Record<string, any> }> {
  const data = await wcaScrape([memberId], networkDomain || undefined);
  if (!data.success || !data.results || data.results.length === 0) {
    return { success: false };
  }
  const profile = data.results[0];
  const found = profile.state === "ok" && !!profile.company_name;
  return { success: true, found, profile };
}

/** Salva via API centralizzata */
async function saveOne(profile: Record<string, any>): Promise<void> {
  await wcaSave(profile);
}

export function useWcaAppDownload() {
  const [progress, setProgress] = useState<DownloadProgress>({
    phase: "idle", current: 0, total: 0, message: "",
  });
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateProgress = (p: Partial<DownloadProgress>) =>
    setProgress((prev) => ({ ...prev, ...p }));

  /** Avvia download completo per un paese — auto-login, nessuna credenziale */
  const startDownload = useCallback(async (
    countryCode: string,
    countryName: string,
  ) => {
    if (isRunning) return;
    setIsRunning(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // 1. Auto-login
      updateProgress({ phase: "login", message: "Login WCA automatico...", countryCode });
      await wcaLogin();

      // 2. Discover
      updateProgress({ phase: "discover", message: `Scoperta membri ${countryName}...` });
      const members = await wcaDiscoverAll(countryCode, (page, total) => {
        updateProgress({ message: `Discover ${countryName}: pagina ${page}/${total}` });
      });

      if (ac.signal.aborted) return;

      // 3. Crea directory locale CON networks per ogni membro
      const memberIds = members.map((m) => m.id);
      const networkMap: Record<number, string[]> = {};
      for (const m of members) {
        if (m.networks && m.networks.length > 0) {
          networkMap[m.id] = m.networks;
        }
      }
      createDirectory(countryCode, countryName, memberIds, networkMap);

      // 4. Confronto istantaneo (zero query!)
      updateProgress({ phase: "compare", message: "Confronto locale..." });
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

      // 5. Download con batch pause + circuit breaker
      let downloaded = 0;
      let consecutiveErrors = 0;
      for (let i = 0; i < missing.length; i++) {
        if (ac.signal.aborted) {
          saveSuspendedJob(countryCode, countryName);
          updateProgress({ phase: "paused", message: `Sospeso: ${downloaded}/${missing.length}` });
          return;
        }

        // Batch pause: ogni BATCH_SIZE profili, pausa lunga
        if (i > 0 && i % BATCH_SIZE === 0) {
          updateProgress({ message: `Pausa batch ${BATCH_PAUSE_S}s dopo ${i} profili...` });
          await sleep(BATCH_PAUSE_S * 1000, ac.signal);
        }

        const id = missing[i];
        // Prendi il network domain dalla directory locale (se disponibile)
        const netDomain = getMemberNetworkDomain(countryCode, id);
        updateProgress({
          current: i + 1,
          total: missing.length,
          message: `Scaricando ${i + 1}/${missing.length} (ID: ${id}${netDomain ? ` via ${netDomain}` : ""})`,
        });

        try {
          const result = await scrapeOne(id, netDomain || undefined);
          if (result.success && result.found && result.profile) {
            await saveOne(result.profile);
            markIdDone(countryCode, id);
            downloaded++;
            consecutiveErrors = 0; // Reset circuit breaker
          } else {
            markIdFailed(countryCode, id);
            consecutiveErrors++;
          }
        } catch (err) {
          markIdFailed(countryCode, id);
          consecutiveErrors++;
          console.warn(`[WCA-DL] Errore ID ${id}:`, err);
        }

        // Circuit breaker: troppi errori consecutivi → pausa lunga
        if (consecutiveErrors >= CB_THRESHOLD) {
          updateProgress({ message: `Circuit breaker: ${CB_PAUSE_S}s pausa dopo ${consecutiveErrors} errori` });
          await sleep(CB_PAUSE_S * 1000, ac.signal);
          consecutiveErrors = 0;
        }

        // Delay pattern tra profili
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

  /** Riprendi download sospeso — auto-login, zero query */
  const resumeDownload = useCallback(async (
    countryCode: string,
    countryName: string,
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
      updateProgress({ phase: "login", message: "Login WCA automatico..." });
      await wcaLogin();

      const done = getDoneCount(countryCode);
      const total = getTotalCount(countryCode);
      updateProgress({
        phase: "download",
        current: 0,
        total: pending.length,
        message: `Ripresa ${countryName}: ${done}/${total} fatti, ${pending.length} rimanenti`,
      });

      let downloaded = 0;
      let consecutiveErrors = 0;
      for (let i = 0; i < pending.length; i++) {
        if (ac.signal.aborted) {
          saveSuspendedJob(countryCode, countryName);
          updateProgress({ phase: "paused", message: `Sospeso: ${downloaded} nuovi scaricati` });
          return;
        }

        if (i > 0 && i % BATCH_SIZE === 0) {
          updateProgress({ message: `Pausa batch ${BATCH_PAUSE_S}s dopo ${i} profili...` });
          await sleep(BATCH_PAUSE_S * 1000, ac.signal);
        }

        const id = pending[i];
        const netDomain = getMemberNetworkDomain(countryCode, id);
        updateProgress({
          current: i + 1,
          total: pending.length,
          message: `Scaricando ${i + 1}/${pending.length} (ID: ${id}${netDomain ? ` via ${netDomain}` : ""})`,
        });

        try {
          const result = await scrapeOne(id, netDomain || undefined);
          if (result.success && result.found && result.profile) {
            await saveOne(result.profile);
            markIdDone(countryCode, id);
            downloaded++;
            consecutiveErrors = 0;
          } else {
            markIdFailed(countryCode, id);
            consecutiveErrors++;
          }
        } catch {
          markIdFailed(countryCode, id);
          consecutiveErrors++;
        }

        if (consecutiveErrors >= CB_THRESHOLD) {
          updateProgress({ message: `Circuit breaker: ${CB_PAUSE_S}s pausa dopo ${consecutiveErrors} errori` });
          await sleep(CB_PAUSE_S * 1000, ac.signal);
          consecutiveErrors = 0;
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

  /** Avvia download SERVER-SIDE via worker (alternativa a client-side) */
  const startServerJob = useCallback(async (
    countries: Array<{ code: string; name: string }>,
    options?: { networks?: string[]; searchTerm?: string; searchBy?: string },
  ): Promise<string | null> => {
    if (isRunning) return null;
    setIsRunning(true);
    try {
      updateProgress({ phase: "login", message: "Avvio job server-side..." });
      const result = await wcaJobStart(countries, options);
      if (result.success && result.jobId) {
        updateProgress({
          phase: "download",
          message: `Job server avviato: ${result.jobId}`,
          serverJobId: result.jobId,
          current: 0,
          total: 0,
        });
        return result.jobId;
      }
      updateProgress({ phase: "error", message: result.error || "Job start fallito" });
      return null;
    } catch (err) {
      updateProgress({ phase: "error", message: err instanceof Error ? err.message : "Errore" });
      return null;
    } finally {
      setIsRunning(false);
    }
  }, [isRunning]);

  /** Confronto IDs server-side (usa check-ids API) */
  const checkMissingServer = useCallback(async (
    ids: number[],
    country?: string,
  ): Promise<{ missing: number[]; found: number }> => {
    const result = await wcaCheckIds(ids, country);
    return { missing: result.missing, found: result.found };
  }, []);

  return {
    progress,
    isRunning,
    startDownload,
    resumeDownload,
    stopDownload,
    suspendedJobs,
    isComplete,
    // Server-side additions
    startServerJob,
    checkMissingServer,
  };
}
