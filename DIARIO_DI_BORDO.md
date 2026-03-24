# Diario di Bordo — Claude × Lovable

> Registro delle modifiche fatte da Claude sul repo condiviso.
> Lovable: consulta questo file per sapere dove Claude ha operato.

---

## Sessione #1 — 24 Marzo 2026

### File creati (tutti NUOVI, nessun file esistente modificato):

| File | Scopo |
|------|-------|
| `src/lib/wca-app-bridge.ts` | Client API verso le API Vercel di wca-app (login, discover, scrape, save) |
| `src/lib/localDirectory.ts` | Directory locale in localStorage per confronto istantaneo zero-query |
| `src/hooks/useWcaAppDownload.ts` | Hook React per download WCA con ripresa, delay pattern, jobs sospesi |
| `src/components/system/ClaudeBadge.tsx` | Badge visivo "Claude Engine" fisso in basso a sinistra |

### File modificati:

| File | Modifica |
|------|----------|
| `src/components/layout/AppLayout.tsx` | Aggiunto import e render di `<ClaudeBadge />` |

### Cosa NON ho toccato:
- `src/integrations/supabase/client.ts` (auto-generato da Lovable)
- `src/integrations/supabase/types.ts` (auto-generato da Lovable)
- `package.json` (nessuna dipendenza aggiunta)
- Nessun file di configurazione (vite, tailwind, eslint, tsconfig)
- Nessuna edge function Supabase

### Come usare i nuovi moduli:
I file sono pronti per essere importati da qualsiasi componente Lovable:
```tsx
import { useWcaAppDownload } from "@/hooks/useWcaAppDownload";
import { getSuspendedJobs, isCountryCompleted } from "@/lib/localDirectory";

// Nel componente:
const { startDownload, resumeDownload, stopDownload, progress } = useWcaAppDownload();
```

### Prossimi passi:
- Collegare `useWcaAppDownload` alla UI di download esistente (da fare con Lovable)
- Aggiungere pannello jobs sospesi nella Network page
- Integrare il badge Claude con stato real-time del download

---

## Sessione #2 — 24 Marzo 2026

### File modificati:

| File | Modifica |
|------|----------|
| `src/hooks/useDownloadEngine.ts` | **RISCRITTO** V7→V8: usa wca-app Vercel API al posto delle Edge Functions Supabase |

### Dettagli tecnici V8:
- **Scraping**: ora via `wca-app.vercel.app/api/scrape` (prima: Supabase `scrape-wca-partners`)
- **Salvataggio**: ora via `wca-app.vercel.app/api/save` (prima: Edge Function)
- **Login**: automatico via credenziali in `app_settings` → wca-app bridge → cookie salvato
- **Directory locale**: ogni job crea/aggiorna la directory localStorage del paese
- **Jobs sospesi**: se il circuit breaker si attiva, il job viene salvato come "sospeso" nella directory locale
- **Compatibilità**: mantiene lo STESSO contratto `{ startJob, stop, isProcessing }` — la UI di Lovable funziona senza cambiamenti
- **Circuit breaker + delay pattern**: invariati, stessa logica V7
- **Supabase job tracking**: invariato (download_jobs, download_job_items, download_job_events) — la UI monitor funziona come prima

### Cosa NON ho toccato:
- `useDirectoryDownload.ts` (scan directory resta via Edge Function — troppo interconnesso con UI)
- `useDownloadJobs.ts` (CRUD jobs Supabase — invariato)
- `lib/download/jobState.ts` (stato job Supabase — invariato)
- `lib/api/wcaScraper.ts` (tipi e funzioni directory scan — invariato)
- Nessun file auto-generato Supabase
- Nessun componente UI

### Prerequisiti per funzionare:
Le credenziali WCA devono essere salvate in `app_settings` con chiavi:
- `wca_username` → username WCA
- `wca_password` → password WCA

Oppure un cookie valido con chiave `wca_cookie`.

---
ENDOFFILEcd ~/Downloads/wca-network-navigator
git add src/hooks/useDownloadEngine.ts DIARIO_DI_BORDO.md
git commit -m "feat: V8 download engine — wca-app Vercel bridge + directory locale

- useDownloadEngine riscritta: scrape/save via wca-app.vercel.app API
- Directory locale per confronto istantaneo e resume zero-query
- Login automatico via credenziali in app_settings
- Stesso contratto hook: UI Lovable funziona senza modifiche
- Circuit breaker + delay pattern invariati"
git push
cat > ~/Downloads/wca-network-navigator/src/hooks/useDownloadEngine.ts << 'ENDOFFILE'
import { useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { claimJob, markProcessing, updateItem, snapshotProgress, finalizeJob, pauseJob, stopJob, emitEvent } from "@/lib/download/jobState";
import { wcaScrape, wcaSave, wcaLogin } from "@/lib/wca-app-bridge";
import { createDirectory, markIdDone, markIdFailed, getPendingIds, checkMissingIdsLocal, saveSuspendedJob, removeSuspendedJob } from "@/lib/localDirectory";

/**
 * V8: Download engine powered by wca-app Vercel API + directory locale.
 * 🤖 Claude Engine — Diario di bordo #2
 *
 * Cambiamenti rispetto a V7:
 * - Scraping via wca-app.vercel.app/api/scrape (non più Edge Functions Supabase)
 * - Salvataggio via wca-app.vercel.app/api/save (non più Edge Functions)
 * - Directory locale per confronto istantaneo (zero query DB per resume)
 * - Circuit breaker + delay pattern invariati
 */

const DEFAULT_DELAY_PATTERN = [3, 3, 2, 3, 8, 3, 5, 3, 12, 3, 4, 3, 6, 3, 9, 3, 3, 3, 10];
const DEFAULT_BATCH_PAUSE = 15;
const DEFAULT_BATCH_SIZE = 20;

type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  threshold: number;
  cooldownMs: number;
  halfOpenSuccessNeeded: number;
  halfOpenSuccessCount: number;
}

function createCircuitBreaker(threshold = 5, cooldownMs = 60_000): CircuitBreaker {
  return { state: "closed", failureCount: 0, lastFailureTime: 0, threshold, cooldownMs, halfOpenSuccessNeeded: 2, halfOpenSuccessCount: 0 };
}

function recordSuccess(cb: CircuitBreaker): void {
  if (cb.state === "half_open") {
    cb.halfOpenSuccessCount++;
    if (cb.halfOpenSuccessCount >= cb.halfOpenSuccessNeeded) {
      cb.state = "closed"; cb.failureCount = 0; cb.halfOpenSuccessCount = 0;
      console.log("[CLAUDE-ENGINE] Circuit closed — recovered");
    }
  } else { cb.failureCount = 0; }
}

function recordFailure(cb: CircuitBreaker): void {
  cb.failureCount++; cb.lastFailureTime = Date.now(); cb.halfOpenSuccessCount = 0;
  if (cb.state === "half_open") { cb.state = "open"; }
  else if (cb.failureCount >= cb.threshold) { cb.state = "open"; console.log(`[CLAUDE-ENGINE] Circuit OPEN — ${cb.failureCount} failures`); }
}

function canAttempt(cb: CircuitBreaker): boolean {
  if (cb.state === "closed") return true;
  if (cb.state === "open" && Date.now() - cb.lastFailureTime >= cb.cooldownMs) {
    cb.state = "half_open"; cb.halfOpenSuccessCount = 0; return true;
  }
  return cb.state === "half_open";
}

function calcBackoff(attempt: number, baseMs = 5000, maxMs = 60_000): number {
  const exp = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  return Math.round(exp + exp * 0.5 * Math.random());
}

function getPatternDelay(index: number, pattern: number[]): number {
  return (pattern[index % pattern.length] || 3) * 1000;
}

/** Get WCA cookie — tries Supabase stored credentials first */
async function getWcaCookie(): Promise<string> {
  try {
    const { data } = await supabase.from("app_settings").select("value").eq("key", "wca_cookie").single();
    if (data?.value) return data.value;
  } catch {}
  // Fallback: try stored credentials
  try {
    const { data: creds } = await supabase.from("app_settings").select("key, value").in("key", ["wca_username", "wca_password"]);
    if (creds && creds.length >= 2) {
      const u = creds.find(c => c.key === "wca_username")?.value;
      const p = creds.find(c => c.key === "wca_password")?.value;
      if (u && p) {
        const cookie = await wcaLogin(u, p);
        // Save cookie for reuse
        await supabase.from("app_settings").upsert({ key: "wca_cookie", value: cookie }, { onConflict: "key" });
        return cookie;
      }
    }
  } catch {}
  throw new Error("Nessuna sessione WCA disponibile. Configura le credenziali in Settings.");
}

export function useDownloadEngine() {
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const invalidate = () => {
    for (const k of ["download-jobs", "contact-completeness", "country-stats", "partners"]) {
      queryClient.invalidateQueries({ queryKey: [k] });
    }
  };

  /** Load config from app_settings */
  const loadConfig = async () => {
    const defaults = { delayPattern: DEFAULT_DELAY_PATTERN, batchPause: DEFAULT_BATCH_PAUSE, batchSize: DEFAULT_BATCH_SIZE, circuitThreshold: 5, circuitCooldown: 60 };
    try {
      const { data: settings } = await supabase.from("app_settings").select("key, value").in("key", ["download_delay_pattern", "download_batch_pause", "download_batch_size", "download_circuit_threshold", "download_circuit_cooldown"]);
      if (settings) {
        for (const s of settings) {
          try {
            if (s.key === "download_delay_pattern" && s.value) defaults.delayPattern = JSON.parse(s.value);
            if (s.key === "download_batch_pause" && s.value) defaults.batchPause = parseInt(s.value);
            if (s.key === "download_batch_size" && s.value) defaults.batchSize = parseInt(s.value);
            if (s.key === "download_circuit_threshold" && s.value) defaults.circuitThreshold = parseInt(s.value);
            if (s.key === "download_circuit_cooldown" && s.value) defaults.circuitCooldown = parseInt(s.value);
          } catch {}
        }
      }
    } catch {}
    return defaults;
  };

  const startJob = useCallback(async (jobId: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const claimed = await claimJob(jobId);
      if (!claimed) return;

      // Get WCA cookie via wca-app bridge
      let cookie: string;
      try {
        cookie = await getWcaCookie();
        console.log("[CLAUDE-ENGINE] WCA session OK");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Login WCA fallito";
        await pauseJob(jobId, msg);
        return;
      }

      const config = await loadConfig();
      console.log(`[CLAUDE-ENGINE] V8 started — pattern=${config.delayPattern.length}, batch=${config.batchSize}`);

      // Ensure job items exist
      const { count: itemCount } = await supabase.from("download_job_items").select("id", { count: "exact", head: true }).eq("job_id", jobId);
      if (!itemCount || itemCount === 0) {
        const { data: jobData } = await supabase.from("download_jobs").select("wca_ids").eq("id", jobId).single();
        if (jobData?.wca_ids && Array.isArray(jobData.wca_ids)) {
          const items = (jobData.wca_ids as number[]).map((id, i) => ({ job_id: jobId, wca_id: id, position: i, status: "pending" }));
          for (let i = 0; i < items.length; i += 500) {
            await supabase.from("download_job_items").insert(items.slice(i, i + 500));
          }
        }
      }

      const { data: job } = await supabase.from("download_jobs").select("delay_seconds, country_code, country_name, wca_ids").eq("id", jobId).single();
      if (!job) return;

      // Initialize local directory for this country
      if (job.wca_ids && Array.isArray(job.wca_ids)) {
        createDirectory(job.country_code, job.country_name || job.country_code, job.wca_ids as number[]);
      }

      const cb = createCircuitBreaker(config.circuitThreshold, config.circuitCooldown * 1000);
      let itemsProcessed = 0;

      // Main loop
      while (!ac.signal.aborted) {
        const { data: jobCheck } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
        if (!jobCheck || jobCheck.status !== "running") break;

        if (!canAttempt(cb)) {
          const waitTime = cb.cooldownMs - (Date.now() - cb.lastFailureTime);
          console.log(`[CLAUDE-ENGINE] Circuit OPEN — wait ${Math.round(waitTime / 1000)}s`);
          await emitEvent(jobId, null, "circuit_open", { waitMs: waitTime, failures: cb.failureCount });
          await sleep(Math.min(waitTime, 10_000), ac.signal);
          if (ac.signal.aborted) break;
          continue;
        }

        const { data: nextItems } = await supabase
          .from("download_job_items")
          .select("id, wca_id, position")
          .eq("job_id", jobId)
          .in("status", ["pending", "temporary_error"])
          .order("position", { ascending: true })
          .limit(1);

        if (!nextItems?.length) break;
        const item = nextItems[0];

        // Delay pattern
        if (itemsProcessed > 0) {
          if (itemsProcessed % config.batchSize === 0) {
            await emitEvent(jobId, null, "batch_pause", { itemsProcessed, pauseSeconds: config.batchPause });
            await emitEvent(jobId, null, "countdown", { seconds: config.batchPause, type: "batch" });
            await sleep(config.batchPause * 1000, ac.signal);
          } else {
            const patternDelay = getPatternDelay(itemsProcessed, config.delayPattern);
            await emitEvent(jobId, null, "countdown", { seconds: Math.round(patternDelay / 1000), type: "delay" });
            await sleep(patternDelay, ac.signal);
          }
          if (ac.signal.aborted) break;
        }

        await markProcessing(item.id);
        await emitEvent(jobId, item.id, "item_processing", { wca_id: item.wca_id });

        // ── Scrape via wca-app bridge ──
        try {
          const result = await wcaScrape(item.wca_id, cookie);

          if (result.success && result.found && result.partner) {
            recordSuccess(cb);
            // Save via wca-app bridge
            await wcaSave(result.partner);
            markIdDone(job.country_code, item.wca_id);

            const hasContact = result.partner.contacts?.some((c: any) => c.email || c.phone || c.mobile);
            const cf = hasContact ? 1 : 0;
            await updateItem(item.id, "success", { contactsFound: cf, contactsMissing: cf ? 0 : 1 });
            await emitEvent(jobId, item.id, "item_success", { companyName: result.partner.company_name, engine: "claude-v8" });
          } else if (result.success && !result.found) {
            markIdFailed(job.country_code, item.wca_id);
            await updateItem(item.id, "member_not_found", { errorCode: "WCA_PROFILE_NOT_FOUND" });
            try {
              await supabase.from("partners_no_contacts").upsert({
                wca_id: item.wca_id, company_name: `WCA ${item.wca_id}`,
                country_code: job.country_code, scraped_at: new Date().toISOString(),
              }, { onConflict: "wca_id" });
            } catch {}
            await emitEvent(jobId, item.id, "item_failed", { state: "member_not_found" });
          } else {
            recordFailure(cb);
            markIdFailed(job.country_code, item.wca_id);
            const errorMsg = result.error || "Unknown error";
            await updateItem(item.id, "temporary_error", { errorCode: "WCA_APP_ERROR", errorMessage: errorMsg });
            await emitEvent(jobId, item.id, "item_failed", { errorCode: "WCA_APP_ERROR", errorMessage: errorMsg });

            if (cb.state === "open") {
              saveSuspendedJob(job.country_code, job.country_name || job.country_code);
              await pauseJob(jobId, `Circuit breaker: ${cb.failureCount} errori consecutivi`);
              break;
            }
            await sleep(calcBackoff(cb.failureCount), ac.signal);
            if (ac.signal.aborted) break;
            itemsProcessed++;
            continue;
          }
        } catch (err) {
          recordFailure(cb);
          markIdFailed(job.country_code, item.wca_id);
          const errorMsg = err instanceof Error ? err.message : "Network error";
          await updateItem(item.id, "temporary_error", { errorCode: "NETWORK_ERROR", errorMessage: errorMsg });
          await emitEvent(jobId, item.id, "item_failed", { errorCode: "NETWORK_ERROR" });

          if (cb.state === "open") {
            saveSuspendedJob(job.country_code, job.country_name || job.country_code);
            await pauseJob(jobId, `Errore rete persistente — ${cb.failureCount} errori`);
            break;
          }
          await sleep(calcBackoff(cb.failureCount), ac.signal);
          if (ac.signal.aborted) break;
          itemsProcessed++;
          continue;
        }

        itemsProcessed++;
        if (itemsProcessed % 3 === 0) {
          await snapshotProgress(jobId, item.wca_id);
          invalidate();
        }
      }

      if (!ac.signal.aborted) {
        removeSuspendedJob(job.country_code);
        await snapshotProgress(jobId);
        await finalizeJob(jobId);
      } else {
        saveSuspendedJob(job.country_code, job.country_name || job.country_code);
      }
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
      abortRef.current = null;
      invalidate();
    }
  }, [queryClient]);

  const stop = useCallback(async () => {
    abortRef.current?.abort();
    const { data: running } = await supabase.from("download_jobs").select("id").eq("status", "running").limit(1);
    if (running?.[0]) await stopJob(running[0].id);
  }, []);

  return { startJob, stop, isProcessing };
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

## Sessione #2 — 24 Marzo 2026

### File modificati:

| File | Modifica |
|------|----------|
| `src/hooks/useDownloadEngine.ts` | **RISCRITTO** V7→V8: usa wca-app Vercel API al posto delle Edge Functions Supabase |

### Dettagli tecnici V8:
- **Scraping**: ora via `wca-app.vercel.app/api/scrape` (prima: Supabase `scrape-wca-partners`)
- **Salvataggio**: ora via `wca-app.vercel.app/api/save` (prima: Edge Function)
- **Login**: automatico via credenziali in `app_settings` → wca-app bridge → cookie salvato
- **Directory locale**: ogni job crea/aggiorna la directory localStorage del paese
- **Jobs sospesi**: se il circuit breaker si attiva, il job viene salvato come "sospeso" nella directory locale
- **Compatibilità**: mantiene lo STESSO contratto `{ startJob, stop, isProcessing }` — la UI di Lovable funziona senza cambiamenti
- **Circuit breaker + delay pattern**: invariati, stessa logica V7
- **Supabase job tracking**: invariato (download_jobs, download_job_items, download_job_events) — la UI monitor funziona come prima

### Cosa NON ho toccato:
- `useDirectoryDownload.ts` (scan directory resta via Edge Function — troppo interconnesso con UI)
- `useDownloadJobs.ts` (CRUD jobs Supabase — invariato)
- `lib/download/jobState.ts` (stato job Supabase — invariato)
- `lib/api/wcaScraper.ts` (tipi e funzioni directory scan — invariato)
- Nessun file auto-generato Supabase
- Nessun componente UI

### Prerequisiti per funzionare:
Le credenziali WCA devono essere salvate in `app_settings` con chiavi:
- `wca_username` → username WCA
- `wca_password` → password WCA

Oppure un cookie valido con chiave `wca_cookie`.

---
