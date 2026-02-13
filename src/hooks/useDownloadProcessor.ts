import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useScrapingSettings, isNightPauseActive, msUntilNightEnd } from "./useScrapingSettings";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Background download processor for Operations Center.
 * Monitors pending/running download_jobs and processes them via Chrome Extension.
 * Simplified version of AcquisizionePartner's runExtensionLoop — no UI canvas, no AI enrichment.
 */
export function useDownloadProcessor() {
  const { isAvailable, checkAvailable, extractContacts, verifySession, syncCookie } = useExtensionBridge();
  const { settings } = useScrapingSettings();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);
  const cancelRef = useRef(false);
  const availableRef = useRef(isAvailable);

  useEffect(() => { availableRef.current = isAvailable; }, [isAvailable]);

  const processJob = useCallback(async (job: any) => {
    const jobId = job.id;
    const wcaIds: number[] = (job.wca_ids as number[]) || [];
    const startIndex = job.current_index || 0;
    const delaySeconds = Math.max(job.delay_seconds || settings.delayDefault, settings.delayMin);
    const processedSet = new Set<number>(((job.processed_ids as number[]) || []));

    // Mark as running
    await supabase.from("download_jobs").update({ status: "running", error_message: null }).eq("id", jobId);

    // DB lock: verify no other job is already running (prevent parallel execution after reload)
    const { data: runningJobs } = await supabase
      .from("download_jobs")
      .select("id")
      .eq("status", "running")
      .neq("id", jobId)
      .limit(1);

    if (runningJobs && runningJobs.length > 0) {
      await supabase.from("download_jobs")
        .update({ status: "pending", error_message: "In attesa: altro job in esecuzione" })
        .eq("id", jobId);
      return;
    }

    // Keep-alive
    const keepAlive = setInterval(async () => {
      try { await supabase.from("download_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId); } catch {}
    }, settings.keepAliveMs);

    let consecutiveEmpty = 0;
    let contactsFound = job.contacts_found_count || 0;
    let contactsMissing = job.contacts_missing_count || 0;

    try {
      for (let i = startIndex; i < wcaIds.length; i++) {
        if (cancelRef.current) break;

        // Check job status from DB (pause/cancel from UI)
        const { data: freshJob } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
        if (!freshJob || freshJob.status === "cancelled") { cancelRef.current = true; break; }
        if (freshJob.status === "paused") {
          // Wait until resumed
          while (true) {
            await new Promise(r => setTimeout(r, 2000));
            if (cancelRef.current) break;
            const { data: check } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
            if (!check || check.status === "cancelled") { cancelRef.current = true; break; }
            if (check.status === "running") break;
          }
          if (cancelRef.current) break;
        }

        const wcaId = wcaIds[i];
        if (processedSet.has(wcaId)) continue;

        // Check extension availability
        if (!availableRef.current && !(await checkAvailable())) {
          await supabase.from("download_jobs").update({
            status: "paused",
            error_message: "⚠️ Estensione Chrome non disponibile. Installala e riprendi il job.",
          }).eq("id", jobId);
          break;
        }

        // Ensure partner exists
        let partnerId: string | null = null;
        const { data: existing } = await supabase.from("partners").select("id, company_name").eq("wca_id", wcaId).maybeSingle();
        if (existing) {
          partnerId = existing.id;
        } else {
          const { data: newP } = await supabase.from("partners").insert({
            wca_id: wcaId,
            company_name: `WCA ${wcaId}`,
            country_code: job.country_code,
            country_name: job.country_name,
            city: "",
          }).select("id").single();
          if (newP) partnerId = newP.id;
        }

        // Extract contacts via Chrome Extension
        let hasEmail = false;
        let hasPhone = false;
        let companyName = existing?.company_name || `WCA ${wcaId}`;

        try {
          const result = await extractContacts(wcaId);

          if (result.pageLoaded === false) {
            // Page didn't load, skip and continue
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }

          if (result.success && result.contacts && result.contacts.length > 0 && partnerId) {
            // Save contacts to DB
            for (const c of result.contacts) {
              const contactName = c.name || c.title || "Sconosciuto";
              // Upsert: check if contact exists
              const { data: existingContact } = await supabase
                .from("partner_contacts")
                .select("id")
                .eq("partner_id", partnerId)
                .eq("name", contactName)
                .maybeSingle();

              if (!existingContact) {
                await supabase.from("partner_contacts").insert({
                  partner_id: partnerId,
                  name: contactName,
                  title: c.title || null,
                  email: c.email || null,
                  direct_phone: c.phone || null,
                  mobile: c.mobile || null,
                });
              }

              if (c.email) hasEmail = true;
              if (c.phone || c.mobile) hasPhone = true;
            }

            if (result.companyName && !result.companyName.startsWith("WCA ")) {
              companyName = result.companyName;
              await supabase.from("partners").update({ company_name: companyName }).eq("id", partnerId);
            }
          }
        } catch (err) {
          console.warn(`[DownloadProcessor] Extract failed for ${wcaId}:`, err);
        }

        // Fallback: check DB for contacts
        if (!hasEmail && !hasPhone && partnerId) {
          const { data: dbContacts } = await supabase
            .from("partner_contacts")
            .select("email, direct_phone, mobile")
            .eq("partner_id", partnerId);
          if (dbContacts?.some(c => c.email)) hasEmail = true;
          if (dbContacts?.some(c => c.direct_phone || c.mobile)) hasPhone = true;
        }

        // Update counters
        const hasAny = hasEmail || hasPhone;
        if (hasAny) { contactsFound++; consecutiveEmpty = 0; }
        else { contactsMissing++; consecutiveEmpty++; }

        const contactResult = hasEmail && hasPhone ? "email+phone"
          : hasEmail ? "email_only"
          : hasPhone ? "phone_only"
          : "no_contacts";

        processedSet.add(wcaId);

        await supabase.from("download_jobs").update({
          current_index: processedSet.size,
          processed_ids: [...processedSet] as any,
          last_processed_wca_id: wcaId,
          last_processed_company: companyName,
          last_contact_result: contactResult,
          contacts_found_count: contactsFound,
          contacts_missing_count: contactsMissing,
          error_message: null,
        }).eq("id", jobId);

        // Session health check every 3 partners
        if ((i - startIndex + 1) % 3 === 0) {
          try {
            const sess = await verifySession();
            if (!sess.success || !sess.authenticated) {
              await syncCookie();
              await new Promise(r => setTimeout(r, settings.recoveryWait1));
              const retry = await verifySession();
              if (!retry.success || !retry.authenticated) {
                await supabase.from("download_jobs").update({
                  error_message: "⚠️ Sessione WCA in recovery...",
                }).eq("id", jobId);
                await new Promise(r => setTimeout(r, settings.recoveryWait2));
                await syncCookie();
              }
            }
          } catch {}
        }

        // Periodic invalidation of CountryGrid queries (every 5 profiles)
        if (processedSet.size > 0 && processedSet.size % 5 === 0) {
          queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
          queryClient.invalidateQueries({ queryKey: ["partner-counts-by-country-with-type"] });
        }

        // Consecutive empty auto-recovery
        if (consecutiveEmpty >= settings.recoveryThreshold) {
          try {
            await syncCookie();
            await new Promise(r => setTimeout(r, settings.recoveryWait1));
            const check = await verifySession();
            if (check.success && check.authenticated) {
              consecutiveEmpty = 0;
              await supabase.from("download_jobs").update({ error_message: null }).eq("id", jobId);
            }
          } catch {}
          consecutiveEmpty = 0; // Reset to avoid spam
        }

        // Night pause
        if (isNightPauseActive(settings.nightPause, settings.nightStopHour, settings.nightStartHour)) {
          const waitMs = msUntilNightEnd(settings.nightStartHour);
          await supabase.from("download_jobs").update({
            error_message: `🌙 Pausa notturna fino alle ${settings.nightStartHour}:00`,
          }).eq("id", jobId);
          await new Promise(r => setTimeout(r, waitMs));
          if (cancelRef.current) break;
          await supabase.from("download_jobs").update({ error_message: null }).eq("id", jobId);
        }

        // Periodic pause
        if (settings.pauseEveryN > 0 && processedSet.size > 0 && processedSet.size % settings.pauseEveryN === 0) {
          const pauseMin = Math.round(settings.pauseDurationS / 60);
          await supabase.from("download_jobs").update({
            error_message: `⏸️ Pausa programmata (${pauseMin} min)`,
          }).eq("id", jobId);
          await new Promise(r => setTimeout(r, settings.pauseDurationS * 1000));
          if (cancelRef.current) break;
          await supabase.from("download_jobs").update({ error_message: null }).eq("id", jobId);
        }

        // Anti-ban: long pause every N profiles (configurable from settings)
        if (settings.antiBanEveryN > 0 && processedSet.size > 0 && processedSet.size % settings.antiBanEveryN === 0) {
          const jitterRange = settings.antiBanDurationS * 0.3; // ±30% jitter
          const longPauseS = settings.antiBanDurationS + (Math.random() * jitterRange * 2 - jitterRange);
          await supabase.from("download_jobs").update({
            error_message: `⏸️ Pausa anti-ban (${Math.round(longPauseS)}s) dopo ${processedSet.size} profili`,
          }).eq("id", jobId);
          await new Promise(r => setTimeout(r, longPauseS * 1000));
          if (cancelRef.current) break;
          await supabase.from("download_jobs").update({ error_message: null }).eq("id", jobId);
        }

        // Delay before next (with jitter from settings for human-like pattern)
        if (i < wcaIds.length - 1 && !cancelRef.current) {
          const jitterRange = settings.jitterMax - settings.jitterMin;
          const jitterMultiplier = settings.jitterMin + Math.random() * jitterRange;
          const jitter = delaySeconds * 1000 * jitterMultiplier;
          await new Promise(r => setTimeout(r, jitter));
        }
      }

      // Complete job
      if (!cancelRef.current) {
        try {
          await supabase.functions.invoke("process-download-job", {
            body: { jobId, action: "complete" },
          });
        } catch {
          await supabase.from("download_jobs").update({
            status: "completed",
            completed_at: new Date().toISOString(),
          }).eq("id", jobId);
        }
      }
    } finally {
      clearInterval(keepAlive);
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["ops-global-stats"] });
      queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
      queryClient.invalidateQueries({ queryKey: ["partner-counts-by-country-with-type"] });
      queryClient.invalidateQueries({ queryKey: ["cache-data-by-country"] });
    }
  }, [settings, checkAvailable, extractContacts, verifySession, syncCookie, queryClient]);

  // Main polling loop: check for pending jobs every 5s
  useEffect(() => {
    const checkJobs = async () => {
      if (processingRef.current) return;

      const { data: pendingJobs } = await supabase
        .from("download_jobs")
        .select("*")
        .in("status", ["pending", "running"])
        .eq("job_type", "download")
        .order("created_at", { ascending: true })
        .limit(1);

      if (pendingJobs && pendingJobs.length > 0) {
        processingRef.current = true;
        cancelRef.current = false;
        try {
          await processJob(pendingJobs[0]);
          // Anti-ban: configurable pause between consecutive jobs
          if (!cancelRef.current && settings.interJobPauseS > 0) {
            console.log(`[DownloadProcessor] Inter-job pause: ${settings.interJobPauseS}s`);
            await new Promise(r => setTimeout(r, settings.interJobPauseS * 1000));
          }
        } catch (err) {
          console.error("[DownloadProcessor] Error:", err);
        } finally {
          processingRef.current = false;
        }
      }
    };

    checkJobs();
    const interval = setInterval(checkJobs, 5000);
    return () => {
      clearInterval(interval);
      cancelRef.current = true;
    };
  }, [processJob]);

  return { isProcessing: processingRef.current };
}
