import { useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useQueryClient } from "@tanstack/react-query";
import { updateJob, completeJob, pauseJob } from "@/lib/download/jobState";
import { saveExtractionResult } from "@/lib/download/profileSaver";
import { appendLog, flushLogBuffer } from "@/lib/download/terminalLog";

/**
 * V3: Linear download engine.
 * - Uses real array index (not Set.size)
 * - Per-profile persistence
 * - Uses job.delay_seconds
 * - No auto-login, no session gate
 * - Errors on single profile → skip + retry later
 * - Bridge dead → pause (not 5-timeout heuristic)
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
      // 1. Fetch job
      const { data: job } = await supabase.from("download_jobs").select("*").eq("id", jobId).single();
      if (!job) return;

      // 2. Check extension (no session gate — just "is extension alive?")
      const extOk = await checkAvailable();
      if (!extOk) { await pauseJob(jobId, "Estensione Chrome non rilevata"); return; }

      // 3. Claim job
      const { data: claimed } = await supabase.from("download_jobs")
        .update({ status: "running", error_message: null })
        .eq("id", jobId).in("status", ["pending", "paused"]).select("id");
      if (!claimed?.length) return;

      const wcaIds: number[] = (job.wca_ids as number[]) || [];
      const processedSet = new Set<number>((job.processed_ids as number[]) || []);
      let contactsFound = job.contacts_found_count || 0;
      let contactsMissing = job.contacts_missing_count || 0;
      const retryQueue: number[] = [];
      const failedIds: number[] = [];
      const delayMs = Math.max((job.delay_seconds || 15), 5) * 1000;
      let consecutiveBridgeErrors = 0;

      await appendLog(jobId, "INFO", `Job avviato — ${wcaIds.length} profili, delay ${job.delay_seconds || 15}s`);

      // 4. Main loop — real array index
      for (let i = job.current_index || 0; i < wcaIds.length; i++) {
        if (ac.signal.aborted) break;
        const wcaId = wcaIds[i];
        if (processedSet.has(wcaId)) continue;

        // Delay between requests (skip first)
        if (i > (job.current_index || 0)) {
          await sleep(delayMs, ac.signal);
          if (ac.signal.aborted) break;
        }

        const result = await extractRef.current(wcaId);

        // Bridge completely dead → pause immediately
        if (result.error === "Timeout" || result.error === "Extension context invalidated") {
          consecutiveBridgeErrors++;
          if (consecutiveBridgeErrors >= 3) {
            await pauseJob(jobId, "Estensione non risponde — verifica che sia attiva");
            await flushLogBuffer();
            return;
          }
          retryQueue.push(wcaId);
          continue;
        }
        consecutiveBridgeErrors = 0;

        // Handle structured states from extension
        const state = result.state || (result.success ? "ok" : "not_loaded");

        if (state === "member_not_found") {
          processedSet.add(wcaId);
          contactsMissing++;
          try { await supabase.from("partners_no_contacts").upsert({ wca_id: wcaId, company_name: result.companyName || `WCA ${wcaId}`, country_code: job.country_code, scraped_at: new Date().toISOString() }, { onConflict: "wca_id" }); } catch {}
          await persistProgress(jobId, i + 1, processedSet, wcaId, result.companyName, contactsFound, contactsMissing);
          continue;
        }

        if (state === "not_loaded" || state === "extraction_error" || state === "bridge_error") {
          retryQueue.push(wcaId);
          continue;
        }

        // Success — save
        const partnerId = await ensurePartner(wcaId, result.companyName, job.country_code, job.country_name);
        if (partnerId) {
          const saved = await saveExtractionResult(partnerId, wcaId, { success: true, ...result }, result.companyName || "");
          if (saved.hasEmail || saved.hasPhone) contactsFound++; else contactsMissing++;
        }
        processedSet.add(wcaId);

        // Persist every profile
        await persistProgress(jobId, i + 1, processedSet, wcaId, result.companyName, contactsFound, contactsMissing);
      }

      // 5. Retry pass
      if (retryQueue.length > 0 && !ac.signal.aborted) {
        await appendLog(jobId, "INFO", `🔄 Retry — ${retryQueue.length} profili`);
        for (const wcaId of retryQueue) {
          if (ac.signal.aborted) break;
          if (processedSet.has(wcaId)) continue;
          await sleep(delayMs, ac.signal);
          if (ac.signal.aborted) break;

          const result = await extractRef.current(wcaId);
          if (result.success || result.state === "ok") {
            const partnerId = await ensurePartner(wcaId, result.companyName, job.country_code, job.country_name);
            if (partnerId) await saveExtractionResult(partnerId, wcaId, { success: true, ...result }, result.companyName || "");
            processedSet.add(wcaId);
          } else {
            failedIds.push(wcaId);
          }
        }
      }

      // 6. Complete — save everything
      if (!ac.signal.aborted) {
        await appendLog(jobId, "DONE", `Completato — ${processedSet.size} processati, ${failedIds.length} falliti`);
        await flushLogBuffer();
        await completeJob(jobId, failedIds, processedSet, contactsFound, contactsMissing);
      }
    } finally {
      await flushLogBuffer();
      processingRef.current = false;
      setIsProcessing(false);
      abortRef.current = null;
      invalidate();
    }
  }, [queryClient, checkAvailable]);

  const stop = useCallback(async () => {
    abortRef.current?.abort();
    // Also update any running job in DB
    const { data: running } = await supabase.from("download_jobs").select("id").eq("status", "running").limit(1);
    if (running?.[0]) await pauseJob(running[0].id, "Fermato dall'utente");
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

async function persistProgress(
  jobId: string, currentIndex: number, processedSet: Set<number>,
  lastWcaId: number, lastCompany: string | null | undefined,
  contactsFound: number, contactsMissing: number,
) {
  await updateJob(jobId, {
    current_index: currentIndex,
    processed_ids: [...processedSet] as any,
    last_processed_wca_id: lastWcaId,
    last_processed_company: lastCompany || null,
    contacts_found_count: contactsFound,
    contacts_missing_count: contactsMissing,
  });
}
