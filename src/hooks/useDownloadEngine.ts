import { useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { claimJob, markProcessing, updateItem, snapshotProgress, finalizeJob, pauseJob, stopJob, emitEvent } from "@/lib/download/jobState";

/**
 * V7: Server-side download engine with circuit breaker + exponential backoff.
 * 
 * Standards:
 * - RFC 7231 §7.1.3: Exponential backoff with jitter on 429/503
 * - Circuit Breaker (Martin Fowler): Opens after N consecutive failures, half-open test after cooldown
 * - 12-Factor App: DELAY_PATTERN externalized via app_settings, not hardcoded
 */

// Default delay pattern from wca-app repo (seconds between requests)
const DEFAULT_DELAY_PATTERN = [3, 3, 2, 3, 8, 3, 5, 3, 12, 3, 4, 3, 6, 3, 9, 3, 3, 3, 10];
const DEFAULT_BATCH_PAUSE = 15; // seconds pause every 20 profiles
const DEFAULT_BATCH_SIZE = 20;

// Circuit breaker states
type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  threshold: number;      // failures before opening
  cooldownMs: number;     // ms before half-open test
  halfOpenSuccessNeeded: number;
  halfOpenSuccessCount: number;
}

function createCircuitBreaker(threshold = 5, cooldownMs = 60_000): CircuitBreaker {
  return {
    state: "closed",
    failureCount: 0,
    lastFailureTime: 0,
    threshold,
    cooldownMs,
    halfOpenSuccessNeeded: 2,
    halfOpenSuccessCount: 0,
  };
}

function recordSuccess(cb: CircuitBreaker): void {
  if (cb.state === "half_open") {
    cb.halfOpenSuccessCount++;
    if (cb.halfOpenSuccessCount >= cb.halfOpenSuccessNeeded) {
      cb.state = "closed";
      cb.failureCount = 0;
      cb.halfOpenSuccessCount = 0;
      console.log("[CIRCUIT] Closed — service recovered");
    }
  } else {
    cb.failureCount = 0;
  }
}

function recordFailure(cb: CircuitBreaker): void {
  cb.failureCount++;
  cb.lastFailureTime = Date.now();
  cb.halfOpenSuccessCount = 0;

  if (cb.state === "half_open") {
    cb.state = "open";
    console.log("[CIRCUIT] Re-opened from half_open — still failing");
  } else if (cb.failureCount >= cb.threshold) {
    cb.state = "open";
    console.log(`[CIRCUIT] Opened — ${cb.failureCount} consecutive failures`);
  }
}

function canAttempt(cb: CircuitBreaker): boolean {
  if (cb.state === "closed") return true;
  if (cb.state === "open") {
    const elapsed = Date.now() - cb.lastFailureTime;
    if (elapsed >= cb.cooldownMs) {
      cb.state = "half_open";
      cb.halfOpenSuccessCount = 0;
      console.log("[CIRCUIT] Half-open — testing service");
      return true;
    }
    return false;
  }
  // half_open
  return true;
}

/** Calculate delay with jitter (RFC 7231) */
function calcBackoff(attempt: number, baseMs = 5000, maxMs = 60_000): number {
  const exponential = Math.min(baseMs * Math.pow(2, attempt - 1), maxMs);
  const jitter = exponential * 0.5 * Math.random(); // ±50% jitter
  return Math.round(exponential + jitter);
}

/** Get delay from pattern (12-Factor: loaded from config, falls back to default) */
function getPatternDelay(index: number, pattern: number[]): number {
  return (pattern[index % pattern.length] || 3) * 1000;
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

  const extractViaEdgeFunction = async (wcaId: number, countryCode: string) => {
    const { data, error } = await supabase.functions.invoke("scrape-wca-partners", {
      body: { wcaId, countryCode, aiParse: false },
    });
    if (error) {
      // Detect rate limit (429) or service unavailable (503)
      const status = (error as any)?.status || 0;
      return { success: false, error: error.message || "Edge function error", httpStatus: status };
    }
    return data;
  };

  /** Load externalized config from app_settings (12-Factor) */
  const loadConfig = async (): Promise<{ delayPattern: number[]; batchPause: number; batchSize: number; circuitThreshold: number; circuitCooldown: number }> => {
    const defaults = {
      delayPattern: DEFAULT_DELAY_PATTERN,
      batchPause: DEFAULT_BATCH_PAUSE,
      batchSize: DEFAULT_BATCH_SIZE,
      circuitThreshold: 5,
      circuitCooldown: 60,
    };

    try {
      const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["download_delay_pattern", "download_batch_pause", "download_batch_size", "download_circuit_threshold", "download_circuit_cooldown"]);

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
      // 1. Claim job
      const claimed = await claimJob(jobId);
      if (!claimed) return;

      // 2. Load externalized config
      const config = await loadConfig();
      console.log(`[DL-ENGINE] Config loaded: pattern=${config.delayPattern.length} steps, batch=${config.batchSize}, circuit=${config.circuitThreshold}`);

      // 3. Safety: ensure download_job_items exist
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

      // 4. Fetch job info
      const { data: job } = await supabase.from("download_jobs").select("delay_seconds, country_code, country_name").eq("id", jobId).single();
      if (!job) return;

      // 5. Initialize circuit breaker
      const cb = createCircuitBreaker(config.circuitThreshold, config.circuitCooldown * 1000);
      let itemsProcessed = 0;

      // 6. Main loop
      while (!ac.signal.aborted) {
        // Check for pause/stop
        const { data: jobCheck } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
        if (!jobCheck || jobCheck.status !== "running") break;

        // Circuit breaker check
        if (!canAttempt(cb)) {
          const waitTime = cb.cooldownMs - (Date.now() - cb.lastFailureTime);
          console.log(`[DL-ENGINE] Circuit OPEN — waiting ${Math.round(waitTime / 1000)}s before retry`);
          await emitEvent(jobId, null, "circuit_open", { waitMs: waitTime, failures: cb.failureCount });
          await sleep(Math.min(waitTime, 10_000), ac.signal);
          if (ac.signal.aborted) break;
          continue;
        }

        // Get next item
        const { data: nextItems } = await supabase
          .from("download_job_items")
          .select("id, wca_id, position")
          .eq("job_id", jobId)
          .in("status", ["pending", "temporary_error"])
          .order("position", { ascending: true })
          .limit(1);

        if (!nextItems?.length) break;
        const item = nextItems[0];

        // Delay: use pattern from config (repo-style timing)
        if (itemsProcessed > 0) {
          // Batch pause every N profiles (repo pattern: 15s every 20 profiles)
          if (itemsProcessed % config.batchSize === 0) {
            console.log(`[DL-ENGINE] Batch pause: ${config.batchPause}s after ${itemsProcessed} profiles`);
            await emitEvent(jobId, null, "batch_pause", { itemsProcessed, pauseSeconds: config.batchPause });
            await sleep(config.batchPause * 1000, ac.signal);
          } else {
            const patternDelay = getPatternDelay(itemsProcessed, config.delayPattern);
            await sleep(patternDelay, ac.signal);
          }
          if (ac.signal.aborted) break;
        }

        // Mark processing
        await markProcessing(item.id);
        await emitEvent(jobId, item.id, "item_processing", { wca_id: item.wca_id });

        // Extract via edge function
        try {
          const result = await extractViaEdgeFunction(item.wca_id, job.country_code);

          if (result.success && result.found) {
            recordSuccess(cb);
            const partner = result.partner || {};
            const hasContact = partner.contacts?.some((c: any) => c.email || c.phone || c.mobile);
            const cf = hasContact ? 1 : 0;
            const cm = cf ? 0 : 1;
            await updateItem(item.id, "success", { contactsFound: cf, contactsMissing: cm });
            await emitEvent(jobId, item.id, "item_success", { companyName: partner.company_name || result.partner?.company_name });
          } else if (result.success && !result.found) {
            // Not found is not a service failure — don't trigger circuit breaker
            await updateItem(item.id, "member_not_found", { errorCode: "WCA_PROFILE_NOT_FOUND" });
            try {
              await supabase.from("partners_no_contacts").upsert({
                wca_id: item.wca_id,
                company_name: `WCA ${item.wca_id}`,
                country_code: job.country_code,
                scraped_at: new Date().toISOString(),
              }, { onConflict: "wca_id" });
            } catch {}
            await emitEvent(jobId, item.id, "item_failed", { state: "member_not_found" });
          } else {
            // Service error — trigger circuit breaker
            recordFailure(cb);
            const errorMsg = result.error || "Unknown error";
            const httpStatus = result.httpStatus || 0;
            await updateItem(item.id, "temporary_error", { errorCode: "EDGE_FN_ERROR", errorMessage: errorMsg });
            await emitEvent(jobId, item.id, "item_failed", { errorCode: "EDGE_FN_ERROR", errorMessage: errorMsg, httpStatus });

            if (cb.state === "open") {
              await pauseJob(jobId, `Circuit breaker aperto: ${cb.failureCount} errori consecutivi — attesa ${config.circuitCooldown}s`);
              break;
            }

            // Exponential backoff with jitter (RFC 7231)
            const backoffMs = calcBackoff(cb.failureCount);
            console.log(`[DL-ENGINE] Fail #${cb.failureCount}, backoff ${backoffMs}ms (jitter applied)`);
            await sleep(backoffMs, ac.signal);
            if (ac.signal.aborted) break;
            itemsProcessed++;
            continue;
          }
        } catch (err) {
          recordFailure(cb);
          const errorMsg = err instanceof Error ? err.message : "Network error";
          await updateItem(item.id, "temporary_error", { errorCode: "NETWORK_ERROR", errorMessage: errorMsg });
          await emitEvent(jobId, item.id, "item_failed", { errorCode: "NETWORK_ERROR" });

          if (cb.state === "open") {
            await pauseJob(jobId, `Errore di rete persistente — circuit breaker aperto dopo ${cb.failureCount} errori`);
            break;
          }

          const backoffMs = calcBackoff(cb.failureCount);
          await sleep(backoffMs, ac.signal);
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

      // Final snapshot + finalize
      if (!ac.signal.aborted) {
        await snapshotProgress(jobId);
        await finalizeJob(jobId);
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

// ── Helpers ──

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) { resolve(); return; }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}
