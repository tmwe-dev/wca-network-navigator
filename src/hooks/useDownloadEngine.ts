import { useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useQueryClient } from "@tanstack/react-query";
import { extractProfile } from "@/lib/download/extractProfile";
import { updateJob, completeJob, pauseJob } from "@/lib/download/jobState";
import { saveExtractionResult } from "@/lib/download/profileSaver";
import { appendLog, flushLogBuffer } from "@/lib/download/terminalLog";
import { markRequestSent, waitForGreenLight } from "@/lib/wcaCheckpoint";

/**
 * Lean download engine — no auto-start, no auto-login, no rate-limit detector.
 * User starts manually; if something breaks → pause with message.
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

      // 2. Check extension
      const extOk = await checkAvailable();
      if (!extOk) { await pauseJob(jobId, "Estensione Chrome non rilevata"); return; }

      // 3. Claim job
      const { data: claimed } = await supabase.from("download_jobs")
        .update({ status: "running", error_message: null, terminal_log: [] as any })
        .eq("id", jobId).in("status", ["pending", "paused"]).select("id");
      if (!claimed?.length) return;

      const wcaIds: number[] = (job.wca_ids as number[]) || [];
      const processedSet = new Set<number>((job.processed_ids as number[]) || []);
      let contactsFound = job.contacts_found_count || 0;
      let contactsMissing = job.contacts_missing_count || 0;
      const retryQueue: number[] = [];
      const failedIds: number[] = [];
      let consecutiveTimeouts = 0;

      await appendLog(jobId, "INFO", `Job avviato — ${wcaIds.length} profili`);

      // 4. Main loop
      for (let i = job.current_index || 0; i < wcaIds.length; i++) {
        if (ac.signal.aborted) break;
        const wcaId = wcaIds[i];
        if (processedSet.has(wcaId)) continue;

        await waitForGreenLight(ac.signal);
        if (ac.signal.aborted) break;
        markRequestSent();

        const result = await extractProfile(wcaId, extractRef.current);

        if (result.error === "timeout" || result.error === "not_loaded") {
          consecutiveTimeouts++;
          retryQueue.push(wcaId);
          if (consecutiveTimeouts >= 5) {
            await pauseJob(jobId, "5 timeout consecutivi — verifica sessione WCA");
            await flushLogBuffer();
            return;
          }
          continue;
        }
        consecutiveTimeouts = 0;

        if (result.error === "bridge_missing") {
          await pauseJob(jobId, "Estensione Chrome non risponde");
          await flushLogBuffer();
          return;
        }

        if (result.memberNotFound) {
          processedSet.add(wcaId);
          contactsMissing++;
          try { await supabase.from("partners_no_contacts").upsert({ wca_id: wcaId, company_name: result.companyName || `WCA ${wcaId}`, country_code: job.country_code, scraped_at: new Date().toISOString() }, { onConflict: "wca_id" }); } catch {}
          continue;
        }

        if (result.error) {
          retryQueue.push(wcaId);
          continue;
        }

        // Success — save
        let partnerId: string | null = null;
        const { data: existing } = await supabase.from("partners").select("id").eq("wca_id", wcaId).maybeSingle();
        if (existing) { partnerId = existing.id; } else {
          const { data: newP } = await supabase.from("partners").insert({
            wca_id: wcaId, company_name: result.companyName || `WCA ${wcaId}`,
            country_code: job.country_code, country_name: job.country_name, city: "",
          }).select("id").single();
          if (newP) partnerId = newP.id;
        }

        if (partnerId) {
          const saved = await saveExtractionResult(partnerId, wcaId, { success: true, ...result }, result.companyName);
          if (saved.hasEmail || saved.hasPhone) contactsFound++; else contactsMissing++;
        }
        processedSet.add(wcaId);

        // Flush progress every 3 profiles
        if (processedSet.size % 3 === 0) {
          await updateJob(jobId, {
            current_index: processedSet.size, processed_ids: [...processedSet] as any,
            last_processed_wca_id: wcaId, last_processed_company: result.companyName,
            contacts_found_count: contactsFound, contacts_missing_count: contactsMissing,
          });
        }
      }

      // 5. Retry pass
      if (retryQueue.length > 0 && !ac.signal.aborted) {
        await appendLog(jobId, "INFO", `🔄 Retry — ${retryQueue.length} profili`);
        for (const wcaId of retryQueue) {
          if (ac.signal.aborted) break;
          if (processedSet.has(wcaId)) continue;
          await waitForGreenLight(ac.signal);
          if (ac.signal.aborted) break;
          markRequestSent();
          const result = await extractProfile(wcaId, extractRef.current);
          if (result.success) {
            const { data: ex } = await supabase.from("partners").select("id").eq("wca_id", wcaId).maybeSingle();
            if (ex) await saveExtractionResult(ex.id, wcaId, { success: true, ...result }, result.companyName);
            processedSet.add(wcaId);
          } else {
            failedIds.push(wcaId);
          }
        }
      }

      // 6. Complete
      if (!ac.signal.aborted) {
        await appendLog(jobId, "DONE", `Completato — ${processedSet.size} processati, ${failedIds.length} falliti`);
        await flushLogBuffer();
        await completeJob(jobId, failedIds);
      }
    } finally {
      await flushLogBuffer();
      processingRef.current = false;
      setIsProcessing(false);
      abortRef.current = null;
      invalidate();
    }
  }, [queryClient, checkAvailable]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { startJob, stop, isProcessing };
}
