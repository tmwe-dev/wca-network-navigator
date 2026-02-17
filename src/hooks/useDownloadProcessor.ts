import { useRef, useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useQueryClient } from "@tanstack/react-query";
import { waitForGreenLight, markRequestSent } from "@/lib/wcaCheckpoint";
import { appendLog } from "@/lib/download/terminalLog";
import { verifyWcaSession } from "@/lib/download/sessionVerifier";
import { saveExtractionResult } from "@/lib/download/profileSaver";

/**
 * Download processor — minimal, checkpoint-driven.
 *
 * A simple `for` loop that:
 *   1. Waits for green light (15s checkpoint)
 *   2. Makes ONE request via the Chrome extension
 *   3. Marks request sent
 *   4. Saves results
 *   5. Repeats until done or aborted
 */
export function useDownloadProcessor() {
  const { isAvailable, checkAvailable, extractContacts } = useExtensionBridge();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stable refs to avoid stale closures
  const availableRef = useRef(isAvailable);
  availableRef.current = isAvailable;
  const checkAvailableRef = useRef(checkAvailable);
  checkAvailableRef.current = checkAvailable;
  const extractContactsRef = useRef(extractContacts);
  extractContactsRef.current = extractContacts;

  // ══════════════════════════════════════════════
  // startJob — the main processing loop
  // ══════════════════════════════════════════════
  const startJob = useCallback(async (jobId: string) => {
    if (processingRef.current) {
      console.log("[Processor] Already processing, skipping:", jobId);
      return;
    }
    processingRef.current = true;
    setIsProcessing(true);
    console.log("[Processor] startJob BEGIN:", jobId);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // 1. Fetch job details
      const { data: job } = await supabase
        .from("download_jobs").select("*").eq("id", jobId).single();
      if (!job) return;

      const wcaIds: number[] = (job.wca_ids as number[]) || [];
      const processedSet = new Set<number>((job.processed_ids as number[]) || []);
      const startIndex = job.current_index || 0;

      // 2. Verify WCA session
      const sessionOk = await verifyWcaSession(
        jobId, availableRef.current, checkAvailableRef.current
      );
      if (!sessionOk) {
        await supabase.from("download_jobs")
          .update({ status: "paused", error_message: "⚠️ Sessione WCA non attiva." })
          .eq("id", jobId);
        return;
      }

      // 3. Atomic claim (prevents double-processing)
      const { data: claimed } = await supabase
        .from("download_jobs")
        .update({ status: "running", error_message: null, terminal_log: [] as any })
        .eq("id", jobId).eq("status", "pending").select("id");
      if (!claimed?.length) return;

      await appendLog(jobId, "INFO", `Job avviato — ${wcaIds.length} profili`);

      // 4. Pre-load directory cache for name lookup
      const cacheMap = new Map<number, { name: string; city: string }>();
      const { data: cacheEntries } = await supabase
        .from("directory_cache").select("members").eq("country_code", job.country_code);
      for (const entry of cacheEntries || []) {
        for (const m of (entry.members as any[] || [])) {
          if (m.wca_id) cacheMap.set(m.wca_id, { name: m.company_name || `WCA ${m.wca_id}`, city: m.city || "" });
        }
      }

      let contactsFound = job.contacts_found_count || 0;
      let contactsMissing = job.contacts_missing_count || 0;

      // ═══════════════════════════════════════
      // MAIN LOOP — one profile at a time
      // ═══════════════════════════════════════
      for (let i = startIndex; i < wcaIds.length; i++) {
        if (ac.signal.aborted) break;

        const wcaId = wcaIds[i];
        if (processedSet.has(wcaId)) continue;

        await appendLog(jobId, "START", `Profilo #${wcaId} (${i + 1}/${wcaIds.length})`);

        // Wait for checkpoint green light
        const greenOk = await waitForGreenLight(ac.signal, (remaining) => {
          console.log(`[Processor] Waiting ${remaining}s for green light...`);
        });
        if (!greenOk || ac.signal.aborted) break;

        // Ensure partner exists in DB
        let partnerId: string | null = null;
        const { data: existing } = await supabase
          .from("partners").select("id, company_name").eq("wca_id", wcaId).maybeSingle();
        if (existing) {
          partnerId = existing.id;
        } else {
          const cached = cacheMap.get(wcaId);
          const { data: newP } = await supabase.from("partners").insert({
            wca_id: wcaId,
            company_name: cached?.name || `WCA ${wcaId}`,
            country_code: job.country_code,
            country_name: job.country_name,
            city: cached?.city || "",
          }).select("id").single();
          if (newP) partnerId = newP.id;
        }

        // Extract profile via Chrome extension
        let hasEmail = false, hasPhone = false, profileSaved = false;
        let companyName = existing?.company_name || cacheMap.get(wcaId)?.name || `WCA ${wcaId}`;
        let extractedEmailCount = 0, extractedPhoneCount = 0;

        try {
          const timeout40s = new Promise<{ success: false; error: string; pageLoaded: false }>((r) =>
            setTimeout(() => r({ success: false, error: "Timeout 40s", pageLoaded: false }), 40000)
          );
          const result = await Promise.race([extractContactsRef.current(wcaId), timeout40s]);
          markRequestSent();

          // Detect "Member not found" — stale WCA ID
          const isMemberNotFound = (result as any).companyName?.toLowerCase().includes("member not found") ||
            (result as any).error?.toLowerCase().includes("member not found");

          if (isMemberNotFound) {
            await appendLog(jobId, "SKIP", `⚠️ Profilo #${wcaId} non esiste più su WCA — saltato`);
            contactsMissing++;
            processedSet.add(wcaId);
            await supabase.from("download_jobs").update({
              current_index: processedSet.size, processed_ids: [...processedSet] as any,
              last_processed_wca_id: wcaId, last_contact_result: "not_found", contacts_missing_count: contactsMissing,
            }).eq("id", jobId);
            continue;
          }

          // Page didn't load — skip (Zero Retry policy)
          if (result.pageLoaded === false) {
            await appendLog(jobId, "SKIP", `Profilo #${wcaId} non caricato — saltato`);
            contactsMissing++;
            processedSet.add(wcaId);
            await supabase.from("download_jobs").update({
              current_index: processedSet.size, processed_ids: [...processedSet] as any,
              last_processed_wca_id: wcaId, last_contact_result: "skipped", contacts_missing_count: contactsMissing,
            }).eq("id", jobId);
            continue;
          }

          // Save extracted data
          if (partnerId) {
            const saved = await saveExtractionResult(partnerId, wcaId, result, companyName);
            hasEmail = saved.hasEmail;
            hasPhone = saved.hasPhone;
            profileSaved = saved.profileSaved;
            companyName = saved.companyName;
            extractedEmailCount = saved.extractedEmailCount;
            extractedPhoneCount = saved.extractedPhoneCount;
          }
        } catch (err) {
          markRequestSent();
          await appendLog(jobId, "ERROR", `Errore #${wcaId}: ${(err as Error).message || err}`);
        }

        // Update counters and log
        const hasAny = hasEmail || hasPhone;
        if (hasAny) contactsFound++; else contactsMissing++;
        processedSet.add(wcaId);

        const indicators = [
          profileSaved ? "📋 Profilo ✓" : "📋 Profilo ✗",
          hasEmail ? `📧 Email ✓ (${extractedEmailCount})` : "📧 Email ✗",
          hasPhone ? `📱 Tel ✓ (${extractedPhoneCount})` : "📱 Tel ✗",
        ].join("  ");
        await appendLog(jobId, hasAny ? "OK" : "WARN", `${companyName} (#${wcaId}) — ${indicators}`);

        const contactResult = hasEmail && hasPhone ? "email+phone" : hasEmail ? "email_only" : hasPhone ? "phone_only" : "no_contacts";
        await supabase.from("download_jobs").update({
          current_index: processedSet.size, processed_ids: [...processedSet] as any,
          last_processed_wca_id: wcaId, last_processed_company: companyName,
          last_contact_result: contactResult, contacts_found_count: contactsFound,
          contacts_missing_count: contactsMissing, error_message: null,
        }).eq("id", jobId);

        // Periodic cache invalidation
        if (processedSet.size % 5 === 0) {
          queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
          queryClient.invalidateQueries({ queryKey: ["partner-counts-by-country-with-type"] });
        }
      }

      // Job complete
      if (!ac.signal.aborted) {
        await appendLog(jobId, "DONE", `Job completato — ${processedSet.size} profili processati`);
        try {
          await supabase.functions.invoke("process-download-job", { body: { jobId, action: "complete" } });
        } catch {
          await supabase.from("download_jobs").update({
            status: "completed", completed_at: new Date().toISOString(),
          }).eq("id", jobId);
        }
      }
    } finally {
      console.log("[Processor] startJob END:", jobId);
      processingRef.current = false;
      setIsProcessing(false);
      abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["ops-global-stats"] });
      queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
      queryClient.invalidateQueries({ queryKey: ["cache-data-by-country"] });
    }
  }, [queryClient]);

  // ── Emergency stop ──
  const emergencyStop = useCallback(() => {
    abortRef.current?.abort();
    supabase.from("download_jobs").select("id, terminal_log").in("status", ["running", "pending"]).then(async ({ data }) => {
      const ts = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      for (const job of (data || [])) {
        const log = [...((job.terminal_log as any[]) || []), { ts, type: "STOP", msg: "🛑 EMERGENCY STOP" }].slice(-150);
        await supabase.from("download_jobs").update({
          status: "cancelled", error_message: "EMERGENCY STOP", terminal_log: log as any,
        }).eq("id", job.id);
      }
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
    });
  }, [queryClient]);

  // ── Auto-start: watch for pending jobs when idle ──
  const startJobRef = useRef(startJob);
  startJobRef.current = startJob;

  useEffect(() => {
    const interval = setInterval(() => {
      if (processingRef.current) return;
      supabase.from("download_jobs").select("id").eq("status", "pending").limit(1).then(({ data }) => {
        if (data?.length && !processingRef.current) {
          console.log("[Processor] Auto-starting pending job:", data[0].id);
          startJobRef.current(data[0].id);
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return { startJob, emergencyStop, isProcessing };
}
