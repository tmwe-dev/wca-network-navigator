/**
 * useBaseEnrichment — Orchestrazione UI del job di arricchimento base.
 *
 * - Lavora in background (anche se l'utente cambia tab della SPA)
 * - 3 worker paralleli (gli step throttle interni gestiscono la concorrenza)
 * - Resume automatico da localStorage
 * - Idempotente: skip target già arricchiti
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { enrichBaseTarget, type BaseEnrichTarget } from "@/v2/services/enrichment/baseEnrichment";
import { useFireScrapeExtensionBridge } from "@/hooks/useFireScrapeExtensionBridge";
import { toast } from "@/hooks/use-toast";

const STORAGE_KEY = "enrichment.base.state.v1";
const CONCURRENCY = 3;

export type RowEnrichmentState =
  | { status: "pending" }
  | { status: "running" }
  | { status: "done"; slug: boolean; logo: boolean; site: boolean; errors: number };

export interface BaseEnrichmentProgress {
  status: "idle" | "running" | "paused" | "done";
  total: number;
  done: number;
  slugFound: number;
  logoFound: number;
  siteScraped: number;
  errors: number;
  currentName?: string;
  /** Stato per-record per UI live (id → stato). */
  rowStates: Record<string, RowEnrichmentState>;
}

interface PersistedState {
  queueIds: string[];
  doneIds: string[];
  slugFound: number;
  logoFound: number;
  siteScraped: number;
  errors: number;
}

function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch { return null; }
}

function savePersisted(s: PersistedState | null): void {
  try {
    if (s) localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    else localStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
}

export function useBaseEnrichment(getTargets: () => BaseEnrichTarget[]) {
  const fsBridge = useFireScrapeExtensionBridge();
  const [progress, setProgress] = useState<BaseEnrichmentProgress>({
    status: "idle", total: 0, done: 0, slugFound: 0, logoFound: 0, siteScraped: 0, errors: 0, rowStates: {},
  });
  const abortRef = useRef(false);
  const runningRef = useRef(false);

  // Restore stato visivo da localStorage al mount
  useEffect(() => {
    const p = loadPersisted();
    if (p && p.queueIds.length > p.doneIds.length) {
      setProgress({
        status: "paused",
        total: p.queueIds.length,
        done: p.doneIds.length,
        slugFound: p.slugFound,
        logoFound: p.logoFound,
        siteScraped: p.siteScraped,
        errors: p.errors,
        rowStates: {},
      });
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current = true;
    setProgress((p) => ({ ...p, status: "paused" }));
  }, []);

  const start = useCallback(async () => {
    if (runningRef.current) {
      toast({ title: "Job già in esecuzione" });
      return;
    }
    if (!fsBridge.isAvailable) {
      toast({
        title: "Estensione Partner Connect non rilevata",
        description: "Apri un sito qualsiasi e assicurati che l'estensione sia installata e attiva, poi riprova.",
        variant: "destructive",
      });
      return;
    }
    const allTargets = getTargets();
    // Filtra: aziende (WCA+BCA) → arricchisci se manca LinkedIn O logo O sito; contatti → solo se manca LinkedIn
    const isCompanyLike = (s: string): boolean => s === "wca" || s === "bca";
    const targets = allTargets.filter((t) =>
      !t.hasLinkedin || (isCompanyLike(t.source) && (!t.hasLogo || !t.hasWebsiteExcerpt))
    );
    if (targets.length === 0) {
      toast({
        title: "Nessun record da arricchire",
        description: `Tutti i ${allTargets.length} record selezionati hanno già LinkedIn, logo e sito.`,
      });
      return;
    }

    // Resume dallo stato persistito se compatibile
    const persisted = loadPersisted();
    const targetIds = targets.map((t) => t.id);
    let doneIds = new Set<string>();
    let slugFound = 0, logoFound = 0, siteScraped = 0, errors = 0;
    if (persisted && persisted.queueIds.length === targetIds.length && persisted.queueIds.every((id, i) => id === targetIds[i])) {
      doneIds = new Set(persisted.doneIds);
      slugFound = persisted.slugFound;
      logoFound = persisted.logoFound;
      siteScraped = persisted.siteScraped;
      errors = persisted.errors;
    }

    abortRef.current = false;
    runningRef.current = true;
    // Inizializza rowStates: tutti pending tranne quelli già done
    const initialRowStates: Record<string, RowEnrichmentState> = {};
    for (const t of targets) {
      initialRowStates[t.id] = doneIds.has(t.id) ? { status: "done", slug: false, logo: false, site: false, errors: 0 } : { status: "pending" };
    }
    setProgress({
      status: "running",
      total: targets.length,
      done: doneIds.size,
      slugFound, logoFound, siteScraped, errors,
      rowStates: initialRowStates,
    });

    const queue = targets.filter((t) => !doneIds.has(t.id));

    const persist = (): void => {
      savePersisted({
        queueIds: targetIds,
        doneIds: Array.from(doneIds),
        slugFound, logoFound, siteScraped, errors,
      });
    };

    const worker = async (): Promise<void> => {
      while (queue.length > 0 && !abortRef.current) {
        const t = queue.shift();
        if (!t) break;
        setProgress((p) => ({
          ...p,
          currentName: t.name,
          rowStates: { ...p.rowStates, [t.id]: { status: "running" } },
        }));
        let rSlug = false, rLogo = false, rSite = false, rErr = 0;
        try {
          const r = await enrichBaseTarget(fsBridge, t);
          rSlug = r.slugFound; rLogo = r.logoFound; rSite = r.siteScraped; rErr = r.errors.length;
          if (r.slugFound) slugFound++;
          if (r.logoFound) logoFound++;
          if (r.siteScraped) siteScraped++;
          if (r.errors.length) errors++;
        } catch {
          errors++;
          rErr = 1;
        }
        doneIds.add(t.id);
        persist();
        setProgress((p) => ({
          ...p,
          done: doneIds.size,
          slugFound, logoFound, siteScraped, errors,
          rowStates: { ...p.rowStates, [t.id]: { status: "done", slug: rSlug, logo: rLogo, site: rSite, errors: rErr } },
        }));
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
    void persist;

    runningRef.current = false;
    if (abortRef.current) {
      setProgress((p) => ({ ...p, status: "paused", currentName: undefined }));
      toast({ title: "Arricchimento in pausa", description: `Ripreso dopo ${doneIds.size}/${targets.length}.` });
    } else {
      savePersisted(null);
      setProgress((p) => ({ ...p, status: "done", currentName: undefined }));
      toast({
        title: "Arricchimento completato",
        description: `${slugFound} LinkedIn · ${logoFound} loghi · ${siteScraped} siti letti · ${errors} errori`,
      });
    }
  }, [getTargets, fsBridge]);

  return { progress, start, stop };
}
