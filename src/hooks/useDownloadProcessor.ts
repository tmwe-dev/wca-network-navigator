import { useRef, useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useQueryClient } from "@tanstack/react-query";
import { waitForGreenLight, markRequestSent, setGreenZoneDelay } from "@/lib/wcaCheckpoint";
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
export interface DlProgress {
  partnerId: string;
  companyName: string;
  countryCode?: string;
  index: number;
  total: number;
}

export interface DlResult {
  partnerId: string;
  companyName: string;
  countryCode?: string;
  profileSaved: boolean;
  emailCount: number;
  phoneCount: number;
  contactCount: number;
  skipped?: boolean;
  error?: string;
}

export function useDownloadProcessor() {
  const { isAvailable, checkAvailable, extractContacts } = useExtensionBridge();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Callback refs for canvas integration
  const onProgressRef = useRef<((p: DlProgress) => void) | null>(null);
  const onResultRef = useRef<((r: DlResult) => void) | null>(null);

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
      let consecutiveEmpty = 0;
      let consecutiveSkipped = 0;
      let consecutiveNotFound = 0;
      let sessionVerifiedActive = false;
      const retryQueue: number[] = [];
      
      // ── Rate-limit detection: track HTML lengths of "not found" pages ──
      const notFoundHtmlLengths: number[] = []; // last N html lengths for "not found" responses
      let rateLimitDetected = false;

      // ═══════════════════════════════════════
      // MAIN LOOP — one profile at a time (PASS 1)
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

        // Emit progress to canvas
        const progressName = existing?.company_name || cacheMap.get(wcaId)?.name || `WCA ${wcaId}`;
        onProgressRef.current?.({
          partnerId: partnerId || `wca-${wcaId}`,
          companyName: progressName,
          countryCode: job.country_code,
          index: processedSet.size + 1,
          total: wcaIds.length,
        });

        // Extract profile via Chrome extension
        let hasEmail = false, hasPhone = false, profileSaved = false;
        let companyName = progressName;
        let extractedEmailCount = 0, extractedPhoneCount = 0;

        try {
          if (typeof extractContactsRef.current !== 'function') {
            markRequestSent();
            await appendLog(jobId, "ERROR", `Errore #${wcaId}: Extension bridge non inizializzato — saltato`);
            contactsMissing++;
            processedSet.add(wcaId);
            await supabase.from("download_jobs").update({
              current_index: processedSet.size, processed_ids: [...processedSet] as any,
              last_processed_wca_id: wcaId, last_contact_result: "skipped", contacts_missing_count: contactsMissing,
            }).eq("id", jobId);
            continue;
          }
          const result = await extractContactsRef.current(wcaId);
          markRequestSent();

          // ── DIAGNOSTIC LOG: log every profile's raw result ──
          const diagHtmlLen = (result as any).profileHtml?.length || 0;
          const diagCompany = (result as any).companyName || "N/A";
          const diagContacts = (result as any).contacts?.length || 0;
          const diagPageLoaded = result.pageLoaded;
          const diagError = (result as any).error || null;
          await appendLog(jobId, "INFO", `🔍 #${wcaId} | html=${diagHtmlLen} | name="${diagCompany}" | contacts=${diagContacts} | loaded=${diagPageLoaded} | err=${diagError || "—"}`);

          // Save raw HTML even for failed profiles (for post-mortem analysis)
          if (partnerId && (result as any).profileHtml && diagHtmlLen > 100) {
            try {
              await supabase.from("partners").update({ raw_profile_html: (result as any).profileHtml }).eq("id", partnerId);
            } catch { /* non-critical */ }
          }

          // ── REORDERED DETECTION (fix false positives) ──
          // 1. Check pageLoaded FIRST — if page didn't load, it's a recoverable skip
          if (result.pageLoaded === false) {
            await appendLog(jobId, "SKIP", `Profilo #${wcaId} non caricato — aggiunto a retry queue`);
            retryQueue.push(wcaId);
            consecutiveSkipped++;

            // Se troppi salti consecutivi → probabile sessione scaduta
            if (consecutiveSkipped >= 3) {
              await appendLog(jobId, "WARN", "⚠️ 3 profili non caricati consecutivi — verifica sessione WCA...");
              const recheck = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
              if (!recheck) {
                await appendLog(jobId, "WARN", "❌ Sessione WCA irrecuperabile — job in pausa");
                await supabase.from("download_jobs").update({
                  status: "paused",
                  error_message: "⚠️ Sessione WCA scaduta — troppi profili non caricati.",
                }).eq("id", jobId);
                return;
              }
              consecutiveSkipped = 0;
            }

            onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
            await supabase.from("download_jobs").update({
              current_index: i + 1, processed_ids: [...processedSet] as any,
              last_processed_wca_id: wcaId, last_contact_result: "retry_queued", contacts_missing_count: contactsMissing,
            }).eq("id", jobId);
            continue;
          }

          // 2. ONLY if pageLoaded === true, check for "Member not found"
          const isMemberNotFound = (result as any).companyName?.toLowerCase().includes("member not found") ||
            (result as any).error?.toLowerCase().includes("member not found");

          if (isMemberNotFound) {
            const htmlLen = (result as any).htmlLength || (result as any).profileHtml?.length || 0;
            notFoundHtmlLengths.push(htmlLen);
            
            // ── RATE-LIMIT DETECTION ──
            // If 3+ consecutive "not found" with identical HTML length → anti-bot page, NOT genuine
            if (notFoundHtmlLengths.length >= 3) {
              const last3 = notFoundHtmlLengths.slice(-3);
              const allSameLength = last3.every(l => l === last3[0] && l > 1000);
              
              if (allSameLength && !rateLimitDetected) {
                rateLimitDetected = true;
                setGreenZoneDelay(30); // backoff to 30s
                await appendLog(jobId, "WARN", `🛡️ RATE-LIMIT RILEVATO — 3+ profili 'not found' con html identico (${last3[0]} chars). Delay aumentato a 30s.`);
              }
            }
            
            if (rateLimitDetected) {
              // Treat as temporary error — DO NOT save to partners_no_contacts
              await appendLog(jobId, "SKIP", `⚠️ #${wcaId} rate-limited (html=${htmlLen}) — retry queue (NON marcato come inesistente)`);
              retryQueue.push(wcaId);
              consecutiveNotFound++;
              
              // If too many rate-limited, pause job
              if (consecutiveNotFound >= 6) {
                await appendLog(jobId, "WARN", "❌ 6+ profili rate-limited consecutivi — job in pausa. Riprova più tardi.");
                await supabase.from("download_jobs").update({
                  status: "paused",
                  error_message: "⚠️ WCA rate-limit attivo — troppi blocchi consecutivi. Riprova tra qualche minuto.",
                }).eq("id", jobId);
                setGreenZoneDelay(20); // reset
                return;
              }
              
              onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
              await supabase.from("download_jobs").update({
                current_index: i + 1, processed_ids: [...processedSet] as any,
                last_processed_wca_id: wcaId, last_contact_result: "rate_limited", contacts_missing_count: contactsMissing,
              }).eq("id", jobId);
              continue;
            }
            
            // ── Original logic for non-rate-limited "not found" ──
            if (sessionVerifiedActive) {
              await appendLog(jobId, "SKIP", `Profilo #${wcaId} non esiste su WCA — skip permanente (sessione verificata)`);
              processedSet.add(wcaId);
              contactsMissing++;
              
              try {
                await supabase.from("partners_no_contacts").upsert({
                  wca_id: wcaId,
                  company_name: companyName,
                  country_code: job.country_code,
                  scraped_at: new Date().toISOString(),
                }, { onConflict: "wca_id" });
              } catch { /* non-critical */ }
              
              onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
              await supabase.from("download_jobs").update({
                current_index: i + 1, processed_ids: [...processedSet] as any,
                last_processed_wca_id: wcaId, last_contact_result: "not_found", contacts_missing_count: contactsMissing,
              }).eq("id", jobId);
              continue;
            }
            
            consecutiveNotFound++;
            
            if (consecutiveNotFound >= 3) {
              await appendLog(jobId, "WARN", "⚠️ 3+ profili 'member not found' consecutivi — verifico sessione...");
              const recheck = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
              if (!recheck) {
                await appendLog(jobId, "WARN", "❌ Sessione WCA scaduta — job in pausa.");
                await supabase.from("download_jobs").update({
                  status: "paused",
                  error_message: "⚠️ Sessione WCA scaduta — 'member not found' era un falso positivo.",
                }).eq("id", jobId);
                return;
              }
              // Session is active but ALSO check for rate-limit pattern
              const recentLens = notFoundHtmlLengths.slice(-3);
              const sameLen = recentLens.every(l => l === recentLens[0] && l > 1000);
              if (sameLen) {
                // Session active BUT identical html = rate limit even with valid session
                rateLimitDetected = true;
                setGreenZoneDelay(30);
                await appendLog(jobId, "WARN", `🛡️ Sessione attiva MA html identico (${recentLens[0]} chars) = RATE LIMIT. Delay 30s, profili in retry.`);
                // Move all queued not-found back to retry (don't mark permanent)
                consecutiveNotFound = 0;
                await supabase.from("download_jobs").update({
                  current_index: i + 1, processed_ids: [...processedSet] as any,
                  last_processed_wca_id: wcaId, last_contact_result: "rate_limited", contacts_missing_count: contactsMissing,
                }).eq("id", jobId);
                continue;
              }
              
              // Session active + different html lengths = genuinely not found
              sessionVerifiedActive = true;
              await appendLog(jobId, "INFO", "✅ Sessione attiva — i profili 'not found' sono genuini, skip permanente");
              
              const notFoundIds = [...retryQueue.splice(0), wcaId];
              for (const nfId of notFoundIds) {
                processedSet.add(nfId);
                contactsMissing++;
                try {
                  await supabase.from("partners_no_contacts").upsert({
                    wca_id: nfId,
                    company_name: cacheMap.get(nfId)?.name || `WCA ${nfId}`,
                    country_code: job.country_code,
                    scraped_at: new Date().toISOString(),
                  }, { onConflict: "wca_id" });
                } catch { /* non-critical */ }
              }
              consecutiveNotFound = 0;
              await supabase.from("download_jobs").update({
                current_index: i + 1, processed_ids: [...processedSet] as any,
                last_processed_wca_id: wcaId, last_contact_result: "not_found", contacts_missing_count: contactsMissing,
              }).eq("id", jobId);
              continue;
            }

            await appendLog(jobId, "SKIP", `⚠️ Profilo #${wcaId} 'member not found' (html=${htmlLen}) — retry queue (${consecutiveNotFound} consecutivi)`);
            retryQueue.push(wcaId);
            onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
            await supabase.from("download_jobs").update({
              current_index: i + 1, processed_ids: [...processedSet] as any,
              last_processed_wca_id: wcaId, last_contact_result: "retry_queued", contacts_missing_count: contactsMissing,
            }).eq("id", jobId);
            continue;
          }

          // 3. Extension error (success: false, no pageLoaded info) → retry queue
          if (result.success === false) {
            await appendLog(jobId, "SKIP", `Profilo #${wcaId} errore estensione: ${(result as any).error || "sconosciuto"} — retry queue`);
            retryQueue.push(wcaId);
            consecutiveSkipped++;
            if (consecutiveSkipped >= 3) {
              await appendLog(jobId, "WARN", "⚠️ 3 errori estensione consecutivi — verifica sessione WCA...");
              const recheck = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
              if (!recheck) {
                await appendLog(jobId, "WARN", "❌ Sessione WCA irrecuperabile — job in pausa");
                await supabase.from("download_jobs").update({
                  status: "paused",
                  error_message: "⚠️ Sessione WCA scaduta — troppi errori estensione.",
                }).eq("id", jobId);
                return;
              }
              consecutiveSkipped = 0;
            }
            onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
            await supabase.from("download_jobs").update({
              current_index: i + 1, processed_ids: [...processedSet] as any,
              last_processed_wca_id: wcaId, last_contact_result: "retry_queued", contacts_missing_count: contactsMissing,
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
          retryQueue.push(wcaId);
          await appendLog(jobId, "ERROR", `Errore #${wcaId}: ${(err as Error).message || err} — aggiunto a retry queue`);
          onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
          await supabase.from("download_jobs").update({
            current_index: i + 1, last_processed_wca_id: wcaId, last_contact_result: "retry_queued",
          }).eq("id", jobId);
          continue;
        }

        // ── Consecutive empty detection (session expiry) ──
        const isCompletelyEmpty = !profileSaved && !hasEmail && !hasPhone;
        if (isCompletelyEmpty) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) {
            await appendLog(jobId, "WARN", "⚠️ 3 profili vuoti consecutivi — tentativo auto-login...");
            // Try re-login up to 2 times before giving up
            let recovered = false;
            for (let attempt = 1; attempt <= 2; attempt++) {
              const recheck = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
              if (recheck) {
                await appendLog(jobId, "INFO", `✅ Sessione ripristinata (tentativo ${attempt}) — continuo`);
                consecutiveEmpty = 0;
                recovered = true;
                break;
              }
              if (attempt < 2) {
                await appendLog(jobId, "WARN", `⚠️ Tentativo ${attempt} fallito — riprovo tra 10s...`);
                await new Promise(r => setTimeout(r, 10000));
              }
            }
            if (!recovered) {
              await appendLog(jobId, "WARN", "❌ Sessione WCA irrecuperabile — job in pausa");
              await supabase.from("download_jobs")
                .update({ status: "paused", error_message: "⚠️ Sessione WCA scaduta — auto-login fallito 2 volte." })
                .eq("id", jobId);
              return;
            }
          }
        } else {
          consecutiveEmpty = 0;
        }
        consecutiveSkipped = 0; // reset quando un profilo carica correttamente
        consecutiveNotFound = 0;
        sessionVerifiedActive = false; // reset: next "not found" batch needs fresh verification

        // Update counters and log
        const hasAny = hasEmail || hasPhone;
        if (hasAny) contactsFound++; else contactsMissing++;
        processedSet.add(wcaId);

        // Emit result to canvas
        onResultRef.current?.({
          partnerId: partnerId || `wca-${wcaId}`,
          companyName,
          countryCode: job.country_code,
          profileSaved,
          emailCount: extractedEmailCount,
          phoneCount: extractedPhoneCount,
          contactCount: extractedEmailCount + extractedPhoneCount,
        });

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
          queryClient.invalidateQueries({ queryKey: ["country-stats"] });
          queryClient.invalidateQueries({ queryKey: ["no-profile-wca-ids"] });
          queryClient.invalidateQueries({ queryKey: ["db-partners-for-countries"] });
          queryClient.invalidateQueries({ queryKey: ["partners"] });
        }
      }

      // ═══════════════════════════════════════
      // PASS 2 — Retry queue (delay +50%)
      // ═══════════════════════════════════════
      const failedIds: number[] = [];

      if (retryQueue.length > 0 && !ac.signal.aborted) {
        await appendLog(jobId, "INFO", `🔄 Inizio retry pass — ${retryQueue.length} profili da riprovare (delay +50%)`);
        const retryDelay = Math.ceil(job.delay_seconds * 1.5);
        let retryConsecutiveSkipped = 0;

        for (let ri = 0; ri < retryQueue.length; ri++) {
          if (ac.signal.aborted) break;

          const wcaId = retryQueue[ri];
          if (processedSet.has(wcaId)) continue;

          await appendLog(jobId, "START", `[Retry] Profilo #${wcaId} (${ri + 1}/${retryQueue.length})`);

          const greenOk = await waitForGreenLight(ac.signal, () => {});
          if (!greenOk || ac.signal.aborted) break;

          // Look up partner
          const { data: existing } = await supabase
            .from("partners").select("id, company_name").eq("wca_id", wcaId).maybeSingle();
          const partnerId = existing?.id || null;
          const companyName = existing?.company_name || cacheMap.get(wcaId)?.name || `WCA ${wcaId}`;

          let hasEmail = false, hasPhone = false, profileSaved = false;
          let extractedEmailCount = 0, extractedPhoneCount = 0;

          try {
            if (typeof extractContactsRef.current !== 'function') {
              markRequestSent();
              failedIds.push(wcaId);
              await appendLog(jobId, "ERROR", `[Retry] #${wcaId}: Extension bridge non inizializzato — fallito definitivamente`);
              continue;
            }
            const result = await extractContactsRef.current(wcaId);
            markRequestSent();

            // Diagnostic log for retry pass
            const diagHtmlLen = (result as any).profileHtml?.length || 0;
            const diagCompany = (result as any).companyName || "N/A";
            const diagContacts = (result as any).contacts?.length || 0;
            await appendLog(jobId, "INFO", `🔍 [Retry] #${wcaId} | html=${diagHtmlLen} | name="${diagCompany}" | contacts=${diagContacts} | loaded=${result.pageLoaded}`);

            // Save raw HTML for post-mortem even on retry
            if (partnerId && (result as any).profileHtml && diagHtmlLen > 100) {
              try {
                await supabase.from("partners").update({ raw_profile_html: (result as any).profileHtml }).eq("id", partnerId);
              } catch { /* non-critical */ }
            }

            if (result.pageLoaded === false) {
              retryConsecutiveSkipped++;
              failedIds.push(wcaId);
              await appendLog(jobId, "FAIL", `[Retry] #${wcaId} non caricato — fallito definitivamente`);

              if (retryConsecutiveSkipped >= 3) {
                await appendLog(jobId, "WARN", "⚠️ 3 retry consecutivi falliti — sessione probabilmente scaduta, interrompo retry");
                // Add remaining retry items to failed
                for (let rj = ri + 1; rj < retryQueue.length; rj++) {
                  if (!processedSet.has(retryQueue[rj])) failedIds.push(retryQueue[rj]);
                }
                break;
              }
              continue;
            }

            const isMemberNotFound = (result as any).companyName?.toLowerCase().includes("member not found") ||
              (result as any).error?.toLowerCase().includes("member not found");
            if (isMemberNotFound) {
              const htmlLen = (result as any).htmlLength || (result as any).profileHtml?.length || 0;
              // In retry pass, if rate-limit was detected earlier, don't mark permanent
              if (rateLimitDetected) {
                await appendLog(jobId, "SKIP", `[Retry] #${wcaId} still rate-limited (html=${htmlLen}) — fallito`);
                failedIds.push(wcaId);
                continue;
              }
              await appendLog(jobId, "SKIP", `[Retry] #${wcaId} non esiste su WCA — skip permanente`);
              processedSet.add(wcaId);
              contactsMissing++;
              continue;
            }

            // 3. Extension error (success: false, no pageLoaded) → failed permanently
            if (result.success === false) {
              retryConsecutiveSkipped++;
              failedIds.push(wcaId);
              await appendLog(jobId, "FAIL", `[Retry] #${wcaId} errore estensione: ${(result as any).error || "sconosciuto"} — fallito definitivamente`);
              if (retryConsecutiveSkipped >= 3) {
                await appendLog(jobId, "WARN", "⚠️ 3 retry consecutivi falliti — interrompo retry");
                for (let rj = ri + 1; rj < retryQueue.length; rj++) {
                  if (!processedSet.has(retryQueue[rj])) failedIds.push(retryQueue[rj]);
                }
                break;
              }
              continue;
            }

            retryConsecutiveSkipped = 0;

            // Save extracted data
            if (partnerId) {
              const saved = await saveExtractionResult(partnerId, wcaId, result, companyName);
              hasEmail = saved.hasEmail;
              hasPhone = saved.hasPhone;
              profileSaved = saved.profileSaved;
              extractedEmailCount = saved.extractedEmailCount;
              extractedPhoneCount = saved.extractedPhoneCount;
            }

            const hasAny = hasEmail || hasPhone;
            if (hasAny) contactsFound++; else contactsMissing++;
            processedSet.add(wcaId);

            const indicators = [
              profileSaved ? "📋 ✓" : "📋 ✗",
              hasEmail ? `📧 ✓(${extractedEmailCount})` : "📧 ✗",
              hasPhone ? `📱 ✓(${extractedPhoneCount})` : "📱 ✗",
            ].join(" ");
            await appendLog(jobId, hasAny ? "OK" : "WARN", `[Retry] ${companyName} (#${wcaId}) — ${indicators}`);
          } catch (err) {
            markRequestSent();
            failedIds.push(wcaId);
            await appendLog(jobId, "ERROR", `[Retry] Errore #${wcaId}: ${(err as Error).message || err}`);
          }

          // Update DB
          await supabase.from("download_jobs").update({
            processed_ids: [...processedSet] as any,
            contacts_found_count: contactsFound,
            contacts_missing_count: contactsMissing,
            failed_ids: failedIds as any,
          }).eq("id", jobId);
        }

        if (failedIds.length > 0) {
          await appendLog(jobId, "WARN", `⚠️ ${failedIds.length} profili non scaricati dopo retry`);
        } else {
          await appendLog(jobId, "OK", "✅ Tutti i profili del retry completati con successo");
        }
      }

      // Job complete — save failed_ids
      if (!ac.signal.aborted) {
        await appendLog(jobId, "DONE", `Job completato — ${processedSet.size} processati, ${failedIds.length} falliti`);
        await supabase.from("download_jobs").update({
          failed_ids: failedIds as any,
        }).eq("id", jobId);
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
      setGreenZoneDelay(20); // reset delay to default after job ends
      processingRef.current = false;
      setIsProcessing(false);
      abortRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["ops-global-stats"] });
      queryClient.invalidateQueries({ queryKey: ["contact-completeness"] });
      queryClient.invalidateQueries({ queryKey: ["cache-data-by-country"] });
      queryClient.invalidateQueries({ queryKey: ["country-stats"] });
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
    const interval = setInterval(async () => {
      if (processingRef.current) return;

      // 1. Check for pending jobs first
      const { data: pending } = await supabase
        .from("download_jobs").select("id").eq("status", "pending").limit(1);
      if (pending?.length && !processingRef.current) {
        console.log("[Processor] Auto-starting pending job:", pending[0].id);
        startJobRef.current(pending[0].id);
        return;
      }

      // 2. Recover orphaned "running" jobs (no update for 60s = no active tab)
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data: orphaned } = await supabase
        .from("download_jobs")
        .select("id, terminal_log")
        .eq("status", "running")
        .lt("updated_at", cutoff)
        .limit(1);

      if (orphaned?.length && !processingRef.current) {
        const job = orphaned[0];
        console.log("[Processor] Recovering orphaned job:", job.id);
        const ts = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const log = [...((job.terminal_log as any[]) || []), { ts, type: "INFO", msg: "🔄 Ripresa automatica dopo refresh" }].slice(-150);
        await supabase.from("download_jobs").update({
          status: "pending", error_message: null, terminal_log: log as any,
        }).eq("id", job.id).eq("status", "running");
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return { startJob, emergencyStop, isProcessing, onProgressRef, onResultRef };
}
