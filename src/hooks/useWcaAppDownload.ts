/**
 * useWcaAppDownload — Hook per download WCA via wca-app API
 * 🤖 Claude Engine V8 · Auto-login — nessuna credenziale richiesta
 *
 * Usa le API Vercel di wca-app come engine di download.
 * Login automatico: il server gestisce le credenziali internamente.
 * Integra la directory locale per confronto istantaneo e ripresa.
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
const WCA_APP_BASE = "https://wca-app.vercel.app/api";
const COOKIE_KEY = "wca_session_cookie";
const COOKIE_TTL = 8 * 60 * 1000; // 8 min

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

/** Auto-login: controlla cache, se scaduto chiama wca-app/api/login con body vuoto */
async function autoLogin(): Promise<string> {
  try {
    const cached = localStorage.getItem(COOKIE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.cookie && Date.now() - parsed.savedAt < COOKIE_TTL) {
        return parsed.cookie;
      }
    }
  } catch {}
  const res = await fetch(`${WCA_APP_BASE}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  const data = await res.json();
  const cookie = data.cookies || data.cookie;
  if (!cookie) throw new Error(data.error || "Login WCA fallito");
  try { localStorage.setItem(COOKIE_KEY, JSON.stringify({ cookie, savedAt: Date.now() })); } catch {}
  return cookie;
}

/** Discover una pagina di membri per paese */
async function apiDiscover(country: string, page: number, cookie: string): Promise<{ members: { id: number; name: string; company?: string }[]; totalPages: number; totalResults?: number; hasNext?: boolean }> {
  const res = await fetch(`${WCA_APP_BASE}/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cookies: cookie, page, filters: { country } }),
  });
  if (!res.ok) throw new Error(`Discover failed: ${res.status}`);
  const data = await res.json();
  // L'API restituisce { members, hasNext, totalResults, page }
  // Calcoliamo totalPages dal totalResults
  const totalResults = data.totalResults || data.members?.length || 0;
  const totalPages = Math.ceil(totalResults / 50) || 1;
  return { members: data.members || [], totalPages, totalResults };
}

/** Discover TUTTI i membri (tutte le pagine) */
async function apiDiscoverAll(
  country: string, cookie: string,
  onProgress?: (page: number, total: number) => void
): Promise<{ id: number; name: string }[]> {
  const all: { id: number; name: string }[] = [];
  let page = 1, totalPages = 1;
  do {
    const result = await apiDiscover(country, page, cookie);
    all.push(...result.members);
    totalPages = result.totalPages;
    onProgress?.(page, totalPages);
    page++;
  } while (page <= totalPages);
  return all;
}

/** Scrape profilo singolo — l'API gestisce login SSO internamente */
async function apiScrape(memberId: number): Promise<{ success: boolean; found?: boolean; profile?: Record<string, any> }> {
  const res = await fetch(`${WCA_APP_BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wcaIds: [memberId] }),
  });
  if (!res.ok) throw new Error(`Scrape failed: ${res.status}`);
  const data = await res.json();
  if (!data.success || !data.results || data.results.length === 0) {
    return { success: false };
  }
  const profile = data.results[0];
  const found = profile.state === "ok" && !!profile.company_name;
  return { success: true, found, profile };
}

/** Salva profilo su Supabase via wca-app */
async function apiSave(profile: Record<string, any>): Promise<void> {
  const res = await fetch(`${WCA_APP_BASE}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profile }),
  });
  if (!res.ok) throw new Error(`Save failed: ${res.status}`);
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
      const cookie = await autoLogin();

      // 2. Discover
      updateProgress({ phase: "discover", message: `Scoperta membri ${countryName}...` });
      const members = await apiDiscoverAll(countryCode, cookie, (page, total) => {
        updateProgress({ message: `Discover ${countryName}: pagina ${page}/${total}` });
      });

      if (ac.signal.aborted) return;

      // 3. Crea directory locale
      const memberIds = members.map((m) => m.id);
      createDirectory(countryCode, countryName, memberIds);

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
          const result = await apiScrape(id);
          if (result.success && result.found && result.profile) {
            await apiSave(result.profile);
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
      const cookie = await autoLogin();

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
          const result = await apiScrape(id);
          if (result.success && result.found && result.profile) {
            await apiSave(result.profile);
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
