import { useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useQueryClient } from "@tanstack/react-query";
import { claimJob, markProcessing, updateItem, snapshotProgress, finalizeJob, pauseJob, stopJob, emitEvent } from "@/lib/download/jobState";
import { saveExtractionResult } from "@/lib/download/profileSaver";

/**
 * V4: Item-level deterministic download engine.
 * - Reads items from download_job_items
 * - Per-item state machine: pending → processing → success/error
 * - Bridge health separated from extraction result
 * - No session gates, no heuristics
 */
export function useDownloadEngine() {
  const { extractContacts, checkAvailable } = useExtensionBridge();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const extractRef = useRef(extractContacts);
  extractRef.current = extractContacts;

  const invalidate = () => {
    for (const k of ["download-jobs", "contact-completeness", "country-stats", "partners"]) {
      queryClient.invalidateQueries({ queryKey: [k] });
    }
  };

  const startJob = useCallback(async (jobId: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsProcessing(true);
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // 1. Check extension
      const extOk = await checkAvailable();
      if (!extOk) { await pauseJob(jobId, "Estensione Chrome non rilevata"); return; }

      // 2. Claim job
      const claimed = await claimJob(jobId);
      if (!claimed) return;

      // 3. Fetch job for delay
      const { data: job } = await supabase.from("download_jobs").select("delay_seconds, country_code, country_name").eq("id", jobId).single();
      if (!job) return;
      const delayMs = Math.max((job.delay_seconds || 15), 5) * 1000;
      let consecutiveBridgeFails = 0;
      let itemsProcessed = 0;

      // 4. Main loop: fetch next pending item
      while (!ac.signal.aborted) {
        // Check for pause/stop requests
        const { data: jobCheck } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
        if (!jobCheck || jobCheck.status !== "running") break;

        // Get next item
        const { data: nextItems } = await supabase
          .from("download_job_items")
          .select("id, wca_id, position")
          .eq("job_id", jobId)
          .in("status", ["pending", "temporary_error"])
          .order("position", { ascending: true })
          .limit(1);

        if (!nextItems?.length) break; // No more items
        const item = nextItems[0];

        // Delay between requests (skip first)
        if (itemsProcessed > 0) {
          await sleep(delayMs, ac.signal);
          if (ac.signal.aborted) break;
        }

        // Mark processing
        await markProcessing(item.id);
        await emitEvent(jobId, item.id, "item_processing", { wca_id: item.wca_id });

        // Extract
        const result = await extractRef.current(item.wca_id);

        // Bridge health check
        if (!result.bridgeHealthy) {
          consecutiveBridgeFails++;
          await updateItem(item.id, "temporary_error", { errorCode: result.bridgeError || "EXT_BRIDGE_TIMEOUT", errorMessage: "Bridge not responding" });
          await emitEvent(jobId, item.id, "item_failed", { errorCode: result.bridgeError });

          if (consecutiveBridgeFails >= 3) {
            await pauseJob(jobId, "Estensione non risponde — verifica che sia attiva");
            break;
          }
          itemsProcessed++;
          continue;
        }
        consecutiveBridgeFails = 0;

        const ext = result.extraction!;
        const state = ext.state;

        if (state === "ok") {
          // Save data
          const partnerId = await ensurePartner(item.wca_id, ext.companyName, job.country_code, job.country_name);
          let cf = 0, cm = 0;
          if (partnerId) {
            const saved = await saveExtractionResult(partnerId, item.wca_id, { success: true, ...ext }, ext.companyName || "");
            cf = (saved.hasEmail || saved.hasPhone) ? 1 : 0;
            cm = cf ? 0 : 1;
          }
          await updateItem(item.id, "success", { contactsFound: cf, contactsMissing: cm });
          await emitEvent(jobId, item.id, "item_success", { companyName: ext.companyName });
        } else if (state === "member_not_found") {
          await updateItem(item.id, "member_not_found", { errorCode: ext.errorCode || "WCA_PROFILE_NOT_FOUND" });
          try { await supabase.from("partners_no_contacts").upsert({ wca_id: item.wca_id, company_name: ext.companyName || `WCA ${item.wca_id}`, country_code: job.country_code, scraped_at: new Date().toISOString() }, { onConflict: "wca_id" }); } catch {}
          await emitEvent(jobId, item.id, "item_failed", { state, errorCode: ext.errorCode });
        } else if (state === "login_required") {
          await updateItem(item.id, "temporary_error", { errorCode: "WCA_LOGIN_REQUIRED", errorMessage: "Login richiesto" });
          await emitEvent(jobId, item.id, "item_failed", { state, errorCode: "WCA_LOGIN_REQUIRED" });
          // Login required means all subsequent will fail too
          await pauseJob(jobId, "Sessione WCA scaduta — effettua il login su wcaworld.com e riprendi");
          break;
        } else {
          // not_loaded, extraction_error, bridge_error
          await updateItem(item.id, "temporary_error", { errorCode: ext.errorCode || "UNKNOWN", errorMessage: ext.error || state });
          await emitEvent(jobId, item.id, "item_failed", { state, errorCode: ext.errorCode });
        }

        // Snapshot progress every 3 items
        itemsProcessed++;
        if (itemsProcessed % 3 === 0) {
          await snapshotProgress(jobId, item.wca_id, ext.companyName);
          invalidate();
        }
      }

      // 5. Final snapshot + finalize
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
  }, [queryClient, checkAvailable]);

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

async function ensurePartner(wcaId: number, companyName: string | null | undefined, countryCode: string, countryName: string): Promise<string | null> {
  const { data: existing } = await supabase.from("partners").select("id").eq("wca_id", wcaId).maybeSingle();
  if (existing) return existing.id;
  const { data: newP } = await supabase.from("partners").insert({
    wca_id: wcaId, company_name: companyName || `WCA ${wcaId}`,
    country_code: countryCode, country_name: countryName, city: "",
  }).select("id").single();
  return newP?.id || null;
}
