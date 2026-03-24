import { useRef, useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { claimJob, markProcessing, updateItem, snapshotProgress, finalizeJob, pauseJob, stopJob, emitEvent } from "@/lib/download/jobState";

/**
 * V6: Server-side download engine.
 * - Uses edge function scrape-wca-partners (direct SSO + cheerio) instead of Chrome extension
 * - No extension bridge dependency
 * - Backoff retry on failures
 */
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
      return { success: false, error: error.message || "Edge function error" };
    }
    return data;
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

      // 2. Safety: ensure download_job_items exist
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

      // 3. Fetch job for delay and country info
      const { data: job } = await supabase.from("download_jobs").select("delay_seconds, country_code, country_name").eq("id", jobId).single();
      if (!job) return;
      const delayMs = Math.max((job.delay_seconds || 15), 5) * 1000;
      let consecutiveFails = 0;
      let itemsProcessed = 0;

      // 4. Main loop
      while (!ac.signal.aborted) {
        // Check for pause/stop
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

        if (!nextItems?.length) break;
        const item = nextItems[0];

        // Delay between requests (skip first)
        if (itemsProcessed > 0) {
          await sleep(delayMs, ac.signal);
          if (ac.signal.aborted) break;
        }

        // Mark processing
        await markProcessing(item.id);
        await emitEvent(jobId, item.id, "item_processing", { wca_id: item.wca_id });

        // Extract via edge function
        try {
          const result = await extractViaEdgeFunction(item.wca_id, job.country_code);

          if (result.success && result.found) {
            consecutiveFails = 0;
            const partner = result.partner || {};
            const hasContact = partner.contacts?.some((c: any) => c.email || c.phone || c.mobile);
            const cf = hasContact ? 1 : 0;
            const cm = cf ? 0 : 1;
            await updateItem(item.id, "success", { contactsFound: cf, contactsMissing: cm });
            await emitEvent(jobId, item.id, "item_success", { companyName: partner.company_name || result.partner?.company_name });
          } else if (result.success && !result.found) {
            // Not found
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
            // Error
            consecutiveFails++;
            const errorMsg = result.error || "Unknown error";
            await updateItem(item.id, "temporary_error", { errorCode: "EDGE_FN_ERROR", errorMessage: errorMsg });
            await emitEvent(jobId, item.id, "item_failed", { errorCode: "EDGE_FN_ERROR", errorMessage: errorMsg });

            if (consecutiveFails >= 5) {
              await pauseJob(jobId, "Troppi errori consecutivi — verifica le credenziali WCA e riprova");
              break;
            }

            // Exponential backoff
            const backoffMs = Math.min(5000 * Math.pow(2, consecutiveFails - 1), 40000);
            console.log(`[DL-ENGINE] Fail #${consecutiveFails}, backoff ${backoffMs}ms`);
            await sleep(backoffMs, ac.signal);
            if (ac.signal.aborted) break;
            itemsProcessed++;
            continue;
          }
        } catch (err) {
          consecutiveFails++;
          const errorMsg = err instanceof Error ? err.message : "Network error";
          await updateItem(item.id, "temporary_error", { errorCode: "NETWORK_ERROR", errorMessage: errorMsg });
          await emitEvent(jobId, item.id, "item_failed", { errorCode: "NETWORK_ERROR" });

          if (consecutiveFails >= 5) {
            await pauseJob(jobId, "Errore di rete persistente — controlla la connessione");
            break;
          }

          const backoffMs = Math.min(5000 * Math.pow(2, consecutiveFails - 1), 40000);
          await sleep(backoffMs, ac.signal);
          if (ac.signal.aborted) break;
          itemsProcessed++;
          continue;
        }

        consecutiveFails = 0;
        itemsProcessed++;
        if (itemsProcessed % 3 === 0) {
          await snapshotProgress(jobId, item.wca_id);
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
