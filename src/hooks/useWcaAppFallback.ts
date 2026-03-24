/**
 * useWcaAppFallback — Hook React per usare wca-app come source alternativa.
 *
 * Quando l'estensione Chrome non è disponibile o le Edge Functions
 * di Supabase falliscono, questo hook fornisce un fallback completo
 * tramite le API Vercel di wca-app.
 *
 * Integra il sistema di directory locale per tracking e ripresa.
 *
 * Non modifica nessun file esistente di Lovable.
 */

import { useState, useCallback, useRef } from "react";
import {
  wcaAppLogin,
  wcaAppDiscoverAll,
  wcaAppScrape,
  wcaAppSave,
  type WcaAppDiscoverMember,
} from "@/lib/api/wcaAppBridge";
import {
  createDirectory,
  getDirectory,
  getPendingIds,
  markIdDone,
  markIdFailed,
  checkMissingIdsLocal,
  saveSuspendedJob,
  removeSuspendedJob,
  isCountryCompleted,
  getDoneCount,
  getTotalCount,
} from "@/lib/localDirectory";

// ── Types ──

export interface FallbackProgress {
  phase: "idle" | "login" | "discover" | "compare" | "download" | "done" | "error" | "paused";
  message: string;
  current: number;
  total: number;
  countryCode: string;
  countryName: string;
}

interface UseWcaAppFallbackOptions {
  onProgress?: (progress: FallbackProgress) => void;
  onPartnerSaved?: (wcaId: number, partnerData: Record<string, any>) => void;
  onComplete?: (countryCode: string, stats: { done: number; failed: number; total: number }) => void;
  delayMs?: number;
}

// ── Hook ──

export function useWcaAppFallback(options: UseWcaAppFallbackOptions = {}) {
  const { onProgress, onPartnerSaved, onComplete, delayMs = 3000 } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<FallbackProgress>({
    phase: "idle", message: "", current: 0, total: 0, countryCode: "", countryName: "",
  });
  const abortRef = useRef(false);
  const cookieRef = useRef<string | null>(null);

  const emit = useCallback((p: Partial<FallbackProgress>) => {
    setProgress((prev) => {
      const next = { ...prev, ...p };
      onProgress?.(next);
      return next;
    });
  }, [onProgress]);

  /**
   * Login a WCA via API Vercel.
   * Il cookie viene salvato internamente per le chiamate successive.
   */
  const login = useCallback(async (username: string, password: string): Promise<boolean> => {
    emit({ phase: "login", message: "Login WCA in corso..." });
    const result = await wcaAppLogin(username, password);
    if (!result.success || !result.cookie) {
      emit({ phase: "error", message: `Login fallito: ${result.error}` });
      return false;
    }
    cookieRef.current = result.cookie;
    emit({ phase: "idle", message: "Login OK" });
    return true;
  }, [emit]);

  /**
   * Scarica un intero paese: discover → confronto locale → download mancanti.
   */
  const scrapeCountry = useCallback(async (
    countryCode: string,
    countryName: string,
    cookie?: string
  ): Promise<void> => {
    const sessionCookie = cookie || cookieRef.current;
    if (!sessionCookie) {
      emit({ phase: "error", message: "Nessun cookie — effettua il login prima" });
      return;
    }

    abortRef.current = false;
    setIsRunning(true);

    try {
      // 1. Check se paese già completato
      if (isCountryCompleted(countryCode)) {
        emit({
          phase: "done", message: `${countryName} già completato (${getDoneCount(countryCode)} partner)`,
          current: getDoneCount(countryCode), total: getTotalCount(countryCode),
          countryCode, countryName,
        });
        setIsRunning(false);
        return;
      }

      // 2. Check directory esistente per ripresa
      const existingDir = getDirectory(countryCode);
      let pendingIds: number[];

      if (existingDir) {
        // Ripresa — usa directory locale, zero query
        pendingIds = getPendingIds(countryCode);
        const total = getTotalCount(countryCode);
        const done = getDoneCount(countryCode);
        emit({
          phase: "compare",
          message: `Ripresa ${countryName}: ${done}/${total} fatti, ${pendingIds.length} rimanenti`,
          current: done, total, countryCode, countryName,
        });
      } else {
        // 3. Discover — scarica lista membri
        emit({ phase: "discover", message: `Scansione directory ${countryName}...`, current: 0, total: 0, countryCode, countryName });

        const discoverResult = await wcaAppDiscoverAll(
          countryCode, sessionCookie,
          (page, totalPages, found) => {
            emit({ message: `Pagina ${page}/${totalPages} — ${found} trovati` });
          }
        );

        if (!discoverResult.success || discoverResult.members.length === 0) {
          emit({ phase: "error", message: `Discover ${countryName}: ${discoverResult.error || "nessun membro trovato"}` });
          setIsRunning(false);
          return;
        }

        // 4. Crea directory locale
        const memberIds = discoverResult.members.map((m) => m.id);
        createDirectory(countryCode, countryName, memberIds);

        // 5. Confronto istantaneo
        const { missing } = checkMissingIdsLocal(memberIds, countryCode);
        pendingIds = missing;
        emit({
          phase: "compare",
          message: `${countryName}: ${discoverResult.members.length} membri, ${missing.length} da scaricare`,
          current: 0, total: missing.length, countryCode, countryName,
        });
      }

      if (pendingIds.length === 0) {
        removeSuspendedJob(countryCode);
        emit({ phase: "done", message: `${countryName} completato!`, current: getTotalCount(countryCode), total: getTotalCount(countryCode), countryCode, countryName });
        onComplete?.(countryCode, { done: getDoneCount(countryCode), failed: 0, total: getTotalCount(countryCode) });
        setIsRunning(false);
        return;
      }

      // 6. Download
      emit({ phase: "download", message: `Download ${countryName}: 0/${pendingIds.length}`, current: 0, total: pendingIds.length, countryCode, countryName });

      for (let i = 0; i < pendingIds.length; i++) {
        if (abortRef.current) {
          // Salva job sospeso
          const remaining = pendingIds.slice(i);
          saveSuspendedJob(countryCode, countryName);
          emit({ phase: "paused", message: `${countryName} sospeso: ${remaining.length} rimanenti`, current: i, total: pendingIds.length, countryCode, countryName });
          setIsRunning(false);
          return;
        }

        const wcaId = pendingIds[i];
        emit({ message: `[${i + 1}/${pendingIds.length}] Scaricando ID ${wcaId}...`, current: i + 1, total: pendingIds.length });

        try {
          const scrapeResult = await wcaAppScrape(wcaId, sessionCookie);

          if (scrapeResult.success && scrapeResult.found && scrapeResult.partner) {
            // Salva su Supabase tramite API Vercel
            const saveResult = await wcaAppSave(scrapeResult.partner);
            if (saveResult.success) {
              markIdDone(countryCode, wcaId);
              onPartnerSaved?.(wcaId, scrapeResult.partner);
            } else {
              markIdFailed(countryCode, wcaId);
            }
          } else if (scrapeResult.success && !scrapeResult.found) {
            markIdFailed(countryCode, wcaId);
          } else {
            markIdFailed(countryCode, wcaId);
          }
        } catch {
          markIdFailed(countryCode, wcaId);
        }

        // Delay tra richieste
        if (i < pendingIds.length - 1) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      // 7. Completamento
      removeSuspendedJob(countryCode);
      const stats = { done: getDoneCount(countryCode), failed: 0, total: getTotalCount(countryCode) };
      emit({ phase: "done", message: `${countryName} completato! ${stats.done}/${stats.total}`, current: stats.total, total: stats.total, countryCode, countryName });
      onComplete?.(countryCode, stats);

    } catch (err) {
      emit({ phase: "error", message: `Errore: ${err instanceof Error ? err.message : "sconosciuto"}` });
    } finally {
      setIsRunning(false);
    }
  }, [emit, onPartnerSaved, onComplete, delayMs]);

  /**
   * Riprende un job sospeso per un paese.
   * Usa la directory locale — zero query al server.
   */
  const resumeCountry = useCallback(async (
    countryCode: string,
    countryName: string,
    cookie?: string
  ): Promise<void> => {
    return scrapeCountry(countryCode, countryName, cookie);
  }, [scrapeCountry]);

  /**
   * Ferma il download in corso.
   * Il job viene salvato come sospeso automaticamente.
   */
  const stop = useCallback(() => {
    abortRef.current = true;
  }, []);

  return {
    login,
    scrapeCountry,
    resumeCountry,
    stop,
    isRunning,
    progress,
    cookie: cookieRef.current,
  };
}
