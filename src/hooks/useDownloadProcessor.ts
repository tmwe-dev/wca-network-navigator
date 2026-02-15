import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useScrapingSettings, calcDelay } from "./useScrapingSettings";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Background download processor for Operations Center.
 * Monitors pending/running download_jobs and processes them via Chrome Extension.
 * 
 * Rules:
 * 1. One request at a time (sequential, DB lock)
 * 2. Minimum baseDelay ± variation seconds between requests (hard floor 10s)
 * 3. Zero retry: each WCA profile gets exactly 1 request
 * 4. stoppedRef prevents ghost restarts after emergency stop
 */
export function useDownloadProcessor() {
  const { isAvailable, checkAvailable, extractContacts } = useExtensionBridge();
  const { settings } = useScrapingSettings();
  const queryClient = useQueryClient();
  const processingRef = useRef(false);
  const cancelRef = useRef(false);
  const stoppedRef = useRef(false);
  const availableRef = useRef(isAvailable);

  // Stable refs to avoid re-creating processJob on every render
  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { availableRef.current = isAvailable; }, [isAvailable]);

  const checkAvailableRef = useRef(checkAvailable);
  useEffect(() => { checkAvailableRef.current = checkAvailable; }, [checkAvailable]);
  const extractContactsRef = useRef(extractContacts);
  useEffect(() => { extractContactsRef.current = extractContacts; }, [extractContacts]);

  // ── Terminal log helper ──
  const appendLog = async (jobId: string, type: string, msg: string) => {
    const ts = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const entry = { ts, type, msg };
    try {
      const { data } = await supabase.from("download_jobs").select("terminal_log").eq("id", jobId).single();
      const current = (data?.terminal_log as any[] || []);
      const updated = [...current, entry].slice(-100);
      await supabase.from("download_jobs").update({ terminal_log: updated as any }).eq("id", jobId);
    } catch (e) {
      console.warn("[TerminalLog] Failed to append:", e);
    }
  };

  // processJob has NO reactive dependencies — uses refs only
  const processJob = useCallback(async (job: any) => {
    const jobId = job.id;
    const wcaIds: number[] = (job.wca_ids as number[]) || [];
    const startIndex = job.current_index || 0;
    const processedSet = new Set<number>(((job.processed_ids as number[]) || []));
    const s = settingsRef.current;

    // Mark as running
    await supabase.from("download_jobs").update({ status: "running", error_message: null, terminal_log: [] as any }).eq("id", jobId);
    await appendLog(jobId, "INFO", `Job avviato — ${wcaIds.length} profili, delay ${s.baseDelay}s ±${s.variation}s`);

    // DB lock: verify no other job is already running
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

    // Pre-load directory cache map (once, no per-profile queries)
    const cacheMap = new Map<number, { name: string; city: string }>();
    const { data: cacheEntries } = await supabase
      .from("directory_cache")
      .select("members")
      .eq("country_code", job.country_code);
    for (const entry of (cacheEntries || [])) {
      for (const m of (entry.members as any[] || [])) {
        if (m.wca_id) cacheMap.set(m.wca_id, { name: m.company_name || `WCA ${m.wca_id}`, city: m.city || "" });
      }
    }

    // Keep-alive
    const keepAlive = setInterval(async () => {
      try { await supabase.from("download_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId); } catch {}
    }, s.keepAliveMs);

    let contactsFound = job.contacts_found_count || 0;
    let contactsMissing = job.contacts_missing_count || 0;

    try {
      for (let i = startIndex; i < wcaIds.length; i++) {
        if (cancelRef.current || stoppedRef.current) break;

        // Check job status from DB (pause/cancel from UI)
        const { data: freshJob } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
        if (!freshJob || freshJob.status === "cancelled") { cancelRef.current = true; break; }
        if (freshJob.status === "paused") {
          while (true) {
            await new Promise(r => setTimeout(r, 2000));
            if (cancelRef.current || stoppedRef.current) break;
            const { data: check } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
            if (!check || check.status === "cancelled") { cancelRef.current = true; break; }
            if (check.status === "running") break;
          }
          if (cancelRef.current || stoppedRef.current) break;
        }

        const wcaId = wcaIds[i];
        if (processedSet.has(wcaId)) continue;

        await appendLog(jobId, "START", `Profilo #${wcaId} (${i + 1}/${wcaIds.length})`);

        // Check extension availability
        if (!availableRef.current && !(await checkAvailableRef.current())) {
          await supabase.from("download_jobs").update({
            status: "paused",
            error_message: "⚠️ Estensione Chrome non disponibile. Installala e ripremi il job.",
          }).eq("id", jobId);
          break;
        }

        // Ensure partner exists
        let partnerId: string | null = null;
        const { data: existing } = await supabase.from("partners").select("id, company_name").eq("wca_id", wcaId).maybeSingle();
        if (existing) {
          partnerId = existing.id;
        } else {
          // Use pre-loaded cacheMap (no per-profile DB query)
          const cached = cacheMap.get(wcaId);
          const realName = cached?.name || `WCA ${wcaId}`;
          const realCity = cached?.city || "";
          const { data: newP } = await supabase.from("partners").insert({
            wca_id: wcaId,
            company_name: realName,
            country_code: job.country_code,
            country_name: job.country_name,
            city: realCity,
          }).select("id").single();
          if (newP) partnerId = newP.id;
        }

        // Extract contacts via Chrome Extension
        let hasEmail = false;
        let hasPhone = false;
        let companyName = existing?.company_name || `WCA ${wcaId}`;

        try {
          const result = await extractContactsRef.current(wcaId);

          // ZERO RETRY: if page didn't load, mark as skipped and move on
          if (result.pageLoaded === false) {
            await appendLog(jobId, "SKIP", `Profilo #${wcaId} non caricato — saltato`);
            contactsMissing++;
            processedSet.add(wcaId);
            await supabase.from("download_jobs").update({
              current_index: processedSet.size,
              processed_ids: [...processedSet] as any,
              last_processed_wca_id: wcaId,
              last_contact_result: "skipped",
              contacts_missing_count: contactsMissing,
            }).eq("id", jobId);
            if (i < wcaIds.length - 1 && !cancelRef.current && !stoppedRef.current) {
              const actualDelay = calcDelay(settingsRef.current.baseDelay, settingsRef.current.variation);
              await appendLog(jobId, "WAIT", `${actualDelay}s`);
              await new Promise(r => setTimeout(r, actualDelay * 1000));
            }
            continue;
          }

          if (result.success && result.contacts && result.contacts.length > 0 && partnerId) {
            // --- Deduplicate incoming contacts by name ---
            const mergedByName = new Map<string, { title: string; name: string; email?: string; phone?: string; mobile?: string; emails: string[] }>();
            for (const c of result.contacts) {
              const rawName = c.name || c.title || "Sconosciuto";
              const nameKey = rawName.trim().toLowerCase();
              if (mergedByName.has(nameKey)) {
                const ex = mergedByName.get(nameKey)!;
                if (c.title && !ex.title.includes(c.title)) ex.title = `${ex.title} / ${c.title}`;
                if (c.email) ex.emails.push(c.email);
                if (c.phone && !ex.phone) ex.phone = c.phone;
                if (c.mobile && !ex.mobile) ex.mobile = c.mobile;
              } else {
                mergedByName.set(nameKey, {
                  name: rawName,
                  title: c.title || rawName,
                  email: c.email || undefined,
                  phone: c.phone || undefined,
                  mobile: c.mobile || undefined,
                  emails: c.email ? [c.email] : [],
                });
              }
            }

            const pickBestEmail = (personName: string, emails: string[]): string | null => {
              const valid = emails.filter(e => e && /\S+@\S+\.\S+/.test(e));
              if (valid.length === 0) return null;
              if (valid.length === 1) return valid[0];
              const parts = personName.replace(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*/i, "").trim().split(/\s+/);
              const surname = (parts[parts.length - 1] || "").toLowerCase();
              const initial = (parts[0] || "").charAt(0).toLowerCase();
              let best = valid[0], bestScore = 0;
              for (const e of valid) {
                const prefix = e.split("@")[0].toLowerCase();
                let score = 0;
                if (surname && prefix.includes(surname)) score += 2;
                if (initial && prefix.includes(initial)) score += 1;
                if (score > bestScore) { bestScore = score; best = e; }
              }
              return best;
            };

            const { data: existingContacts } = await supabase
              .from("partner_contacts")
              .select("id, name, title, email, direct_phone, mobile")
              .eq("partner_id", partnerId);

            const existingByName = new Map<string, any>();
            const existingByEmail = new Map<string, any>();
            for (const e of (existingContacts || [])) {
              if (e.name) existingByName.set(e.name.trim().toLowerCase(), e);
              if (e.email) existingByEmail.set(e.email.trim().toLowerCase(), e);
            }
            const usedIds = new Set<string>();

            for (const [, c] of mergedByName) {
              const bestEmail = pickBestEmail(c.name, c.emails);
              const nameKey = c.name.trim().toLowerCase();
              const emailKey = bestEmail?.trim().toLowerCase();

              let ex = existingByName.get(nameKey);
              if (!ex && emailKey) ex = existingByEmail.get(emailKey);

              if (ex && !usedIds.has(ex.id)) {
                usedIds.add(ex.id);
                const updates: Record<string, string> = {};
                if (c.title && c.title !== ex.title && !ex.title?.includes(c.title)) {
                  updates.title = ex.title ? `${ex.title} / ${c.title}` : c.title;
                }
                if (bestEmail && !ex.email) updates.email = bestEmail;
                if (bestEmail && ex.email && emailKey !== ex.email.trim().toLowerCase()) {
                  const currentScore = (() => { const p = ex.email.split("@")[0].toLowerCase(); const parts = c.name.replace(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*/i,"").trim().split(/\s+/); const s=(parts[parts.length-1]||"").toLowerCase(); const i=(parts[0]||"").charAt(0).toLowerCase(); return (s&&p.includes(s)?2:0)+(i&&p.includes(i)?1:0); })();
                  const newScore = (() => { const p = bestEmail.split("@")[0].toLowerCase(); const parts = c.name.replace(/^(Mr\.?|Ms\.?|Mrs\.?|Dr\.?)\s*/i,"").trim().split(/\s+/); const s=(parts[parts.length-1]||"").toLowerCase(); const i=(parts[0]||"").charAt(0).toLowerCase(); return (s&&p.includes(s)?2:0)+(i&&p.includes(i)?1:0); })();
                  if (newScore > currentScore) updates.email = bestEmail;
                }
                if (c.phone && !ex.direct_phone) updates.direct_phone = c.phone;
                if (c.mobile && !ex.mobile) updates.mobile = c.mobile;
                if (Object.keys(updates).length > 0) {
                  await supabase.from("partner_contacts").update(updates).eq("id", ex.id);
                }
              } else if (!ex) {
                await supabase.from("partner_contacts").insert({
                  partner_id: partnerId,
                  name: c.name,
                  title: c.title,
                  email: bestEmail,
                  direct_phone: c.phone || null,
                  mobile: c.mobile || null,
                });
              }

              if (bestEmail) hasEmail = true;
              if (c.phone || c.mobile) hasPhone = true;
            }

            if (result.companyName && !result.companyName.startsWith("WCA ")) {
              companyName = result.companyName;
              await supabase.from("partners").update({ company_name: companyName }).eq("id", partnerId);
            }
          }

          // Post-extraction fallback: if name is still a placeholder, use pre-loaded cacheMap
          if (companyName.startsWith("WCA ") && partnerId) {
            const cached = cacheMap.get(wcaId);
            if (cached?.name && !cached.name.startsWith("WCA ")) {
              companyName = cached.name;
              await supabase.from("partners").update({ company_name: companyName }).eq("id", partnerId);
            }
          }
        } catch (err) {
          console.warn(`[DownloadProcessor] Extract failed for ${wcaId}:`, err);
          await appendLog(jobId, "ERROR", `Estrazione fallita per #${wcaId}: ${(err as Error).message || err}`);
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
        if (hasAny) { contactsFound++; }
        else { contactsMissing++; }

        const contactResult = hasEmail && hasPhone ? "email+phone"
          : hasEmail ? "email_only"
          : hasPhone ? "phone_only"
          : "no_contacts";

        processedSet.add(wcaId);

        const contactLabel = hasEmail && hasPhone ? "email+tel"
          : hasEmail ? "solo email"
          : hasPhone ? "solo tel"
          : "nessun contatto";
        await appendLog(jobId, hasAny ? "OK" : "INFO", `${companyName} (#${wcaId}) — ${contactLabel}`);

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

        // Periodic invalidation of CountryGrid queries (every 5 profiles)
        if (processedSet.size > 0 && processedSet.size % 5 === 0) {
          queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
          queryClient.invalidateQueries({ queryKey: ["partner-counts-by-country-with-type"] });
        }

        // Simplified delay: baseDelay ± variation, hard floor 10s
        if (i < wcaIds.length - 1 && !cancelRef.current && !stoppedRef.current) {
          const actualDelay = calcDelay(settingsRef.current.baseDelay, settingsRef.current.variation);
          await appendLog(jobId, "WAIT", `${actualDelay}s`);
          await new Promise(r => setTimeout(r, actualDelay * 1000));
        }
      }

      // Complete job
      if (!cancelRef.current && !stoppedRef.current) {
        await appendLog(jobId, "DONE", `Job completato — ${processedSet.size} profili processati`);
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
  }, [queryClient]); // Only queryClient — everything else via refs

  // Main polling loop: mount-once, stable interval
  useEffect(() => {
    const checkJobs = async () => {
      // Guard: if stopped or cancelled or already processing, skip
      if (stoppedRef.current || cancelRef.current || processingRef.current) return;

      // Fresh DB check: only pick up pending/running jobs
      const { data: pendingJobs } = await supabase
        .from("download_jobs")
        .select("*")
        .in("status", ["pending", "running"])
        .eq("job_type", "download")
        .order("created_at", { ascending: true })
        .limit(1);

      if (pendingJobs && pendingJobs.length > 0) {
        // Double-check: re-read the job to ensure it wasn't cancelled between query and now
        const { data: freshCheck } = await supabase
          .from("download_jobs")
          .select("status")
          .eq("id", pendingJobs[0].id)
          .single();
        
        if (!freshCheck || freshCheck.status === "cancelled" || freshCheck.status === "completed") return;
        if (stoppedRef.current || cancelRef.current) return;

        processingRef.current = true;
        cancelRef.current = false;
        try {
          await processJob(pendingJobs[0]);
        } catch (err) {
          console.error("[DownloadProcessor] Error:", err);
        } finally {
          processingRef.current = false;
          // Inter-job pause: 30s cooldown before picking up next country job
          if (!stoppedRef.current && !cancelRef.current) {
            await new Promise(r => setTimeout(r, 30000));
          }
        }
      }
    };

    checkJobs();
    const interval = setInterval(checkJobs, 5000);
    return () => {
      clearInterval(interval);
      cancelRef.current = true;
    };
  }, [processJob]); // processJob is stable (only depends on queryClient)

  const emergencyStop = useCallback(() => {
    cancelRef.current = true;
    stoppedRef.current = true;
    processingRef.current = false;
  }, []);

  const resetStop = useCallback(() => {
    stoppedRef.current = false;
    cancelRef.current = false;
  }, []);

  return { isProcessing: processingRef.current, emergencyStop, resetStop };
}
