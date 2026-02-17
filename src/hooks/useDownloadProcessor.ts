import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useScrapingSettings, calcDelay } from "./useScrapingSettings";
import { useQueryClient } from "@tanstack/react-query";
import { waitForGreenLight, markRequestSent } from "@/lib/wcaCheckpoint";

/**
 * Background download processor for Operations Center.
 * Uses WINDOW-LEVEL singleton state to survive both component remounts AND HMR.
 * 
 * Anti-duplication: uses an incremental activeLoopId on window.__dlProcessorState__.
 * Each loop instance knows its own ID; if it doesn't match, it exits.
 * 
 * MUTEX: `processing` flag prevents concurrent processJob execution.
 * 
 * FIX v2: Atomic claim, global running check BEFORE claim, single-loop guarantee.
 */

const DL_STATE_KEY = '__dlProcessorState__';

interface DlProcessorState {
  cancel: boolean;
  stopped: boolean;
  activeLoopId: number;
  processing: boolean; // MUTEX: true while a job is being processed
  loopRunning: boolean; // true for entire loop lifetime (including delays)
  abortController: AbortController | null; // For immediate delay interruption
}

function getDlState(): DlProcessorState {
  if (!(window as any)[DL_STATE_KEY]) {
    (window as any)[DL_STATE_KEY] = {
      cancel: false,
      stopped: false,
      activeLoopId: 0,
      processing: false,
      loopRunning: false,
      abortController: null,
    };
  }
  return (window as any)[DL_STATE_KEY];
}

/** Abortable delay — resolves after ms OR rejects immediately on abort */
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

export function useDownloadProcessor() {
  const { isAvailable, checkAvailable, extractContacts } = useExtensionBridge();
  const { settings } = useScrapingSettings();
  const queryClient = useQueryClient();
  const availableRef = useRef(isAvailable);

  const settingsRef = useRef(settings);
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { availableRef.current = isAvailable; }, [isAvailable]);

  const checkAvailableRef = useRef(checkAvailable);
  useEffect(() => { checkAvailableRef.current = checkAvailable; }, [checkAvailable]);
  const extractContactsRef = useRef(extractContacts);
  useEffect(() => { extractContactsRef.current = extractContacts; }, [extractContacts]);

  // Reset counter: used to trigger loop restart from resetStop via useEffect
  const resetCountRef = useRef(0);

  // ── Terminal log helper — batched write, no read-then-write race ──
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

  // Pre-job session check: DB-only, NO extension calls
  const verifySessionBeforeJob = useCallback(async (jobId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "wca_session_status")
        .maybeSingle();

      const status = data?.value;
      if (status === "ok") {
        await appendLog(jobId, "INFO", "✅ Sessione WCA attiva — procedo");
        return true;
      }

      if (status === "unknown") {
        await abortableDelay(5000, getDlState().abortController?.signal ?? undefined);
        const { data: recheck } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "wca_session_status")
          .maybeSingle();
        if (recheck?.value === "ok") {
          await appendLog(jobId, "INFO", "✅ Sessione WCA confermata — procedo");
          return true;
        }
      }

      await appendLog(jobId, "WARN", `❌ Sessione WCA: ${status || "no_cookie"} — job in pausa`);
      return false;
    } catch (err) {
      console.error("[DownloadProcessor] Pre-job session check failed:", err);
      return false;
    }
  }, []);

  const processJob = useCallback(async (job: any, loopId: number) => {
    const state = getDlState();
    
    // MUTEX: prevent concurrent processing (set by the polling loop BEFORE calling this)
    // Double-check here as a safety net
    if (!state.processing) {
      console.warn("[DownloadProcessor] processJob called without mutex, acquiring now");
      state.processing = true;
    }

    const jobId = job.id;
    const wcaIds: number[] = (job.wca_ids as number[]) || [];
    const startIndex = job.current_index || 0;
    const processedSet = new Set<number>(((job.processed_ids as number[]) || []));
    const s = settingsRef.current;

    // Verify loop ownership before starting
    if (loopId !== state.activeLoopId || state.stopped) {
      state.processing = false;
      return;
    }

    // ── FIX 3: Global running check BEFORE claiming the job ──
    const { data: alreadyRunning } = await supabase
      .from("download_jobs")
      .select("id")
      .eq("status", "running")
      .limit(1);

    if (alreadyRunning && alreadyRunning.length > 0) {
      console.log("[DownloadProcessor] Another job already running, backing off");
      state.processing = false;
      return;
    }

    // Pre-job: verify WCA session is active
    const sessionOk = await verifySessionBeforeJob(jobId);
    if (!sessionOk) {
      await supabase.from("download_jobs").update({
        status: "paused",
        error_message: "⚠️ Sessione WCA non attiva. Effettua il login su wcaworld.com e riprova.",
      }).eq("id", jobId);
      state.stopped = true;
      state.processing = false;
      return;
    }

    // ── FIX 2: Atomic claim — only succeeds if job is still pending ──
    const { data: claimed, error: claimErr } = await supabase
      .from("download_jobs")
      .update({ status: "running", error_message: null, terminal_log: [] as any })
      .eq("id", jobId)
      .eq("status", "pending")
      .select("id");

    if (claimErr || !claimed || claimed.length === 0) {
      console.log("[DownloadProcessor] Atomic claim failed — job already taken or not pending");
      state.processing = false;
      return;
    }

    await appendLog(jobId, "INFO", `Job avviato — ${wcaIds.length} profili, delay ${s.baseDelay}s ±${s.variation}s`);

    // Pre-load directory cache map
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

    // Create a fresh AbortController for this job
    const ac = new AbortController();
    state.abortController = ac;

    // Keep-alive
    const keepAlive = setInterval(async () => {
      try { await supabase.from("download_jobs").update({ updated_at: new Date().toISOString() }).eq("id", jobId); } catch {}
    }, s.keepAliveMs);

    let contactsFound = job.contacts_found_count || 0;
    let contactsMissing = job.contacts_missing_count || 0;

    /** Quick bail check */
    const shouldStop = () => state.cancel || state.stopped || loopId !== state.activeLoopId || ac.signal.aborted;

    try {
      for (let i = startIndex; i < wcaIds.length; i++) {
        if (shouldStop()) break;

        // Check job status from DB (pause/cancel from UI)
        const { data: freshJob } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
        if (!freshJob || freshJob.status === "cancelled") { state.cancel = true; break; }
        if (freshJob.status === "paused") {
          while (true) {
            try { await abortableDelay(2000, ac.signal); } catch { break; }
            if (shouldStop()) break;
            const { data: check } = await supabase.from("download_jobs").select("status").eq("id", jobId).single();
            if (!check || check.status === "cancelled") { state.cancel = true; break; }
            if (check.status === "running") break;
          }
          if (shouldStop()) break;
        }

        const wcaId = wcaIds[i];
        if (processedSet.has(wcaId)) continue;

        await appendLog(jobId, "START", `Profilo #${wcaId} (${i + 1}/${wcaIds.length})`);

        // ── Adaptive timing: measure extraction duration ──
        const extractionStartMs = Date.now();

        if (shouldStop()) break;

        // Check extension availability
        if (!availableRef.current && !(await checkAvailableRef.current())) {
          await supabase.from("download_jobs").update({
            status: "paused",
            error_message: "⚠️ Estensione Chrome non disponibile. Installala e ripremi il job.",
          }).eq("id", jobId);
          state.cancel = true;
          break;
        }

        // Ensure partner exists
        let partnerId: string | null = null;
        const { data: existing } = await supabase.from("partners").select("id, company_name").eq("wca_id", wcaId).maybeSingle();
        if (existing) {
          partnerId = existing.id;
        } else {
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

        // ══════════════════════════════════════════════════════
        // CHECKPOINT GATE — wait for green zone before any WCA call
        // ══════════════════════════════════════════════════════
        const greenOk = await waitForGreenLight(
          ac.signal,
          (secsLeft) => appendLog(jobId, "GATE", `⏳ Checkpoint: ${secsLeft}s alla zona verde`)
        );
        if (!greenOk || shouldStop()) break;

        // Extract contacts via Chrome Extension
        let hasEmail = false;
        let hasPhone = false;
        let companyName = existing?.company_name || `WCA ${wcaId}`;
        let extractedEmailCount = 0;
        let extractedPhoneCount = 0;
        let profileSaved = false;
        try {
          const result = await extractContactsRef.current(wcaId);

          // ── Mark request sent IMMEDIATELY after extraction ──
          markRequestSent();

          // ZERO RETRY: if page didn't load, mark as skipped
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
            if (i < wcaIds.length - 1 && !shouldStop()) {
              const extractionElapsedSec = Math.floor((Date.now() - extractionStartMs) / 1000);
              const desiredDelay = calcDelay(settingsRef.current.baseDelay, settingsRef.current.variation);
              const adaptiveDelay = Math.max(3, desiredDelay - extractionElapsedSec);
              await appendLog(jobId, "WAIT", `${adaptiveDelay}s (estrazione: ${extractionElapsedSec}s, target: ${desiredDelay}s)`);
              try { await abortableDelay(adaptiveDelay * 1000, ac.signal); } catch { break; }
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

            // Save full profile data
            if (result.profile && partnerId) {
              const p = result.profile;
              const profileUpdate: Record<string, any> = {};
              if (p.address) profileUpdate.address = p.address;
              if (p.phone) profileUpdate.phone = p.phone;
              if (p.fax) profileUpdate.fax = p.fax;
              if (p.mobile) profileUpdate.mobile = p.mobile;
              if (p.emergencyPhone) profileUpdate.emergency_phone = p.emergencyPhone;
              if (p.email) profileUpdate.email = p.email;
              if (p.website) profileUpdate.website = p.website;
              if (p.description) profileUpdate.profile_description = p.description;
              if (p.memberSince) profileUpdate.member_since = p.memberSince;
              if (p.membershipExpires) profileUpdate.membership_expires = p.membershipExpires;
              if (p.officeType) {
                const ot = p.officeType.toLowerCase();
                if (ot.includes("head") || ot.includes("main")) profileUpdate.office_type = "head_office";
                else if (ot.includes("branch")) profileUpdate.office_type = "branch";
              }
              if (p.branchCities && p.branchCities.length > 0) {
                profileUpdate.has_branches = true;
                profileUpdate.branch_cities = p.branchCities;
              }
              if (result.profileHtml) {
                profileUpdate.raw_profile_html = result.profileHtml;
              }
              if (Object.keys(profileUpdate).length > 0) {
                await supabase.from("partners").update(profileUpdate).eq("id", partnerId);
                profileSaved = true;
              }
            }
          }

          // Track extracted counts for indicators
          if (result.contacts) {
            extractedEmailCount = result.contacts.filter((c: any) => c.email).length;
            extractedPhoneCount = result.contacts.filter((c: any) => c.phone || c.mobile).length;
          }
          if (result.profileHtml || result.profile?.description) profileSaved = true;

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

        // ── Clear per-field OK indicators ──
        const indicators = [
          profileSaved ? "📋 Profilo ✓" : "📋 Profilo ✗",
          hasEmail ? `📧 Email ✓ (${extractedEmailCount})` : "📧 Email ✗",
          hasPhone ? `📱 Tel ✓ (${extractedPhoneCount})` : "📱 Tel ✗",
        ].join("  ");

        await appendLog(jobId, hasAny ? "OK" : "WARN", `${companyName} (#${wcaId}) — ${indicators}`);

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

        // Periodic invalidation
        if (processedSet.size > 0 && processedSet.size % 5 === 0) {
          queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
          queryClient.invalidateQueries({ queryKey: ["partner-counts-by-country-with-type"] });
        }

        // ── Adaptive delay: subtract extraction time from target ──
        if (i < wcaIds.length - 1 && !shouldStop()) {
          const extractionElapsedSec = Math.floor((Date.now() - extractionStartMs) / 1000);
          const desiredDelay = calcDelay(settingsRef.current.baseDelay, settingsRef.current.variation);
          const adaptiveDelay = Math.max(3, desiredDelay - extractionElapsedSec);
          await appendLog(jobId, "WAIT", `${adaptiveDelay}s (estrazione: ${extractionElapsedSec}s, target: ${desiredDelay}s)`);
          try { await abortableDelay(adaptiveDelay * 1000, ac.signal); } catch { break; }
        }
      }

      // Complete job
      if (!shouldStop()) {
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
      state.processing = false; // RELEASE MUTEX
      state.abortController = null;
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["ops-global-stats"] });
      queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
      queryClient.invalidateQueries({ queryKey: ["partner-counts-by-country-with-type"] });
      queryClient.invalidateQueries({ queryKey: ["cache-data-by-country"] });
    }
  }, [queryClient]);

  const processJobRef = useRef(processJob);
  useEffect(() => { processJobRef.current = processJob; }, [processJob]);

  // Shared polling loop function
  const startLoop = useCallback((loopId: number) => {
    const state = getDlState();
    
    const loop = async () => {
      state.loopRunning = true;
      let emptyRounds = 0;
      try {
      while (loopId === state.activeLoopId && !state.stopped && !state.cancel) {
        // ── FIX 5: Acquire mutex synchronously BEFORE any async work ──
        if (state.processing) {
          console.warn("[DownloadProcessor] RACE DETECTED: mutex already held! Waiting...");
          try { await abortableDelay(5000, state.abortController?.signal ?? undefined); } catch { break; }
          continue;
        }

        // Acquire mutex NOW (same tick, no await in between)
        state.processing = true;

        try {
          // ── FIX 3 (polling level): Check no running jobs exist ──
          const { data: runningNow } = await supabase
            .from("download_jobs")
            .select("id")
            .eq("status", "running")
            .limit(1);

          if (runningNow && runningNow.length > 0) {
            // A job is already running, release mutex and wait
            state.processing = false;
            emptyRounds = 0; // There IS a running job, reset counter
            try { await abortableDelay(10000, state.abortController?.signal ?? undefined); } catch { break; }
            continue;
          }

          const { data: jobs } = await supabase
            .from("download_jobs")
            .select("*")
            .eq("status", "pending")
            .eq("job_type", "download")
            .order("created_at", { ascending: true })
            .limit(1);

          if (jobs && jobs.length > 0 && loopId === state.activeLoopId && !state.stopped && !state.cancel) {
            emptyRounds = 0; // Found a job, reset counter
            // processJob expects mutex already acquired (state.processing = true)
            await processJobRef.current(jobs[0], loopId);

            // Cooldown inter-job (30s)
            if (loopId === state.activeLoopId && !state.stopped && !state.cancel) {
              try { await abortableDelay(30000, state.abortController?.signal ?? undefined); } catch { break; }
            }
            continue;
          } else {
            // No pending jobs found, release mutex
            state.processing = false;
            emptyRounds++;
            if (emptyRounds >= 3) {
              console.log("[DownloadProcessor] No jobs for 3 rounds (~45s), stopping loop");
              break;
            }
          }
        } catch (err) {
          console.error("[DownloadProcessor] Error:", err);
          state.processing = false;
        }

        // No job found or error: wait 15s and retry
        if (loopId === state.activeLoopId && !state.stopped && !state.cancel) {
          try { await abortableDelay(15000, state.abortController?.signal ?? undefined); } catch { break; }
        }
      }
      } finally {
        state.loopRunning = false;
        console.log(`[DownloadProcessor] Loop ${loopId} exited, loopRunning=false`);
      }
    };

    loop();
  }, []);

  // Main polling loop: mount-only — guard against duplicate loops (HMR/remount)
  useEffect(() => {
    const state = getDlState();
    // If a loop is already running (including during delays), don't start another
    if (state.loopRunning && !state.stopped && !state.cancel) {
      console.log("[DownloadProcessor] Mount: loop already running (loopRunning=true), skipping");
      return () => { state.cancel = true; };
    }
    state.cancel = false;
    state.stopped = false;
    const myId = ++state.activeLoopId;
    startLoop(myId);

    return () => {
      state.cancel = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const emergencyStop = useCallback(() => {
    const state = getDlState();
    state.cancel = true;
    state.stopped = true;
    state.abortController?.abort(); // Interrupt any in-progress delay immediately
    // Immediately update DB — don't wait for the loop to reach its check
    supabase
      .from("download_jobs")
      .update({ status: "cancelled", error_message: "EMERGENCY STOP" })
      .in("status", ["running", "pending"])
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      });
  }, [queryClient]);

  // resetStop: signals old loop to exit, waits for mutex release, then starts new loop.
  // NEVER force-releases the mutex — waits for the old loop to release it naturally.
  const resetStop = useCallback(() => {
    const state = getDlState();
    // 1. Signal old loop to exit
    state.cancel = true;
    state.stopped = true;
    state.abortController?.abort();

    // 2. Wait for mutex to be released naturally, then start new loop
    const waitAndStart = async () => {
      let attempts = 0;
      while (state.processing && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
      }
      if (state.processing) {
        console.warn("[DownloadProcessor] resetStop: mutex still held after 5s, forcing release");
        state.processing = false;
      }
      // 3. Reset flags and start new loop
      state.stopped = false;
      state.cancel = false;
      const myId = ++state.activeLoopId;
      startLoop(myId);
    };
    waitAndStart();
  }, [startLoop]);

  return { emergencyStop, resetStop };
}
