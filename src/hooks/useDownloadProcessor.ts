import { useRef, useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useQueryClient } from "@tanstack/react-query";
import { waitForGreenLight, markRequestSent, setGreenZoneDelay } from "@/lib/wcaCheckpoint";
import { appendLog } from "@/lib/download/terminalLog";
import { verifyWcaSession } from "@/lib/download/sessionVerifier";
import { processOneProfile, type ProcessContext } from "@/lib/download/processProfile";
import { updateJobProgress } from "@/lib/download/jobUpdater";
import { RateLimitDetector } from "@/lib/download/rateLimitDetector";

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

  const onProgressRef = useRef<((p: DlProgress) => void) | null>(null);
  const onResultRef = useRef<((r: DlResult) => void) | null>(null);

  // Stable refs
  const availableRef = useRef(isAvailable);
  availableRef.current = isAvailable;
  const checkAvailableRef = useRef(checkAvailable);
  checkAvailableRef.current = checkAvailable;
  const extractContactsRef = useRef(extractContacts);
  extractContactsRef.current = extractContacts;

  const emitSkip = (partnerId: string | null, wcaId: number, companyName: string, countryCode: string) => {
    onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
  };

  const invalidateCaches = () => {
    for (const key of ["contact-completeness", "partner-counts-by-country-with-type", "country-stats", "no-profile-wca-ids", "db-partners-for-countries", "partners"]) {
      queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  // ══════════════════════════════════════════════
  // startJob — the main processing loop
  // ══════════════════════════════════════════════
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

      const wcaIds: number[] = (job.wca_ids as number[]) || [];
      const processedSet = new Set<number>((job.processed_ids as number[]) || []);
      const startIndex = job.current_index || 0;

      // 2. Verify session
      const sessionOk = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
      if (!sessionOk) {
        await updateJobProgress(jobId, { status: "paused", errorMessage: "⚠️ Sessione WCA non attiva." });
        return;
      }

      // 3. Atomic claim
      const { data: claimed } = await supabase
        .from("download_jobs")
        .update({ status: "running", error_message: null, terminal_log: [] as any })
        .eq("id", jobId).eq("status", "pending").select("id");
      if (!claimed?.length) return;

      await appendLog(jobId, "INFO", `Job avviato — ${wcaIds.length} profili`);

      // 4. Pre-load cache
      const cacheMap = new Map<number, { name: string; city: string }>();
      const { data: cacheEntries } = await supabase.from("directory_cache").select("members").eq("country_code", job.country_code);
      for (const entry of cacheEntries || []) {
        const members = (entry.members || []) as Array<{ wca_id?: number; company_name?: string; city?: string }>;
        for (const m of members) {
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
      const rateLimit = new RateLimitDetector();

      const ctx: ProcessContext = {
        jobId, countryCode: job.country_code, countryName: job.country_name,
        cacheMap, extractContacts: extractContactsRef.current, isRetryPass: false,
      };

      // ═══════════════════════════════════════
      // PASS 1
      // ═══════════════════════════════════════
      for (let i = startIndex; i < wcaIds.length; i++) {
        if (ac.signal.aborted) break;
        const wcaId = wcaIds[i];
        if (processedSet.has(wcaId)) continue;

        await appendLog(jobId, "START", `Profilo #${wcaId} (${i + 1}/${wcaIds.length})`);
        const greenOk = await waitForGreenLight(ac.signal, () => {});
        if (!greenOk || ac.signal.aborted) break;

        const progressName = cacheMap.get(wcaId)?.name || `WCA ${wcaId}`;
        onProgressRef.current?.({ partnerId: `wca-${wcaId}`, companyName: progressName, countryCode: job.country_code, index: processedSet.size + 1, total: wcaIds.length });

        // Ensure fresh ref
        ctx.extractContacts = extractContactsRef.current;
        const { action, partnerId } = await processOneProfile(wcaId, null, progressName, ctx);

        // Handle action
        if (action.type === "bridge_missing") {
          contactsMissing++;
          processedSet.add(wcaId);
          await updateJobProgress(jobId, { currentIndex: processedSet.size, processedIds: [...processedSet], lastWcaId: wcaId, contactResult: "skipped", contactsMissing });
          continue;
        }

        if (action.type === "retry") {
          retryQueue.push(wcaId);
          consecutiveSkipped++;
          if (consecutiveSkipped >= 3) {
            await appendLog(jobId, "WARN", "⚠️ 3 profili non caricati consecutivi — verifica sessione WCA...");
            const recheck = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
            if (!recheck) {
              await appendLog(jobId, "WARN", "❌ Sessione WCA irrecuperabile — job in pausa");
              await updateJobProgress(jobId, { status: "paused", errorMessage: "⚠️ Sessione WCA scaduta." });
              return;
            }
            consecutiveSkipped = 0;
          }
          emitSkip(partnerId, wcaId, progressName, job.country_code);
          await updateJobProgress(jobId, { currentIndex: i + 1, processedIds: [...processedSet], lastWcaId: wcaId, contactResult: "retry_queued", contactsMissing });
          continue;
        }

        if (action.type === "rate_limited") {
          rateLimit.recordNotFound(action.htmlLength);

          if (rateLimit.isRateLimited()) {
            if (!rateLimit.detected) rateLimit.forceDetected();
            setGreenZoneDelay(30);
            await appendLog(jobId, "WARN", `🛡️ RATE-LIMIT RILEVATO — html identico (${action.htmlLength} chars). Delay 30s.`);
            retryQueue.push(wcaId);
            consecutiveNotFound++;
            if (consecutiveNotFound >= 6) {
              await appendLog(jobId, "WARN", "❌ 6+ rate-limited consecutivi — job in pausa.");
              await updateJobProgress(jobId, { status: "paused", errorMessage: "⚠️ WCA rate-limit attivo." });
              setGreenZoneDelay(20);
              return;
            }
            emitSkip(partnerId, wcaId, progressName, job.country_code);
            await updateJobProgress(jobId, { currentIndex: i + 1, processedIds: [...processedSet], lastWcaId: wcaId, contactResult: "rate_limited", contactsMissing });
            continue;
          }

          // Not yet rate-limited — check session if 3+ consecutive
          if (sessionVerifiedActive) {
            await appendLog(jobId, "SKIP", `Profilo #${wcaId} non esiste su WCA — skip permanente`);
            processedSet.add(wcaId);
            contactsMissing++;
            try {
              await supabase.from("partners_no_contacts").upsert({ wca_id: wcaId, company_name: progressName, country_code: job.country_code, scraped_at: new Date().toISOString() }, { onConflict: "wca_id" });
            } catch {}
            await updateJobProgress(jobId, { currentIndex: i + 1, processedIds: [...processedSet], lastWcaId: wcaId, contactResult: "not_found", contactsMissing });
            continue;
          }

          consecutiveNotFound++;
          if (consecutiveNotFound >= 3) {
            await appendLog(jobId, "WARN", "⚠️ 3+ 'member not found' consecutivi — verifico sessione...");
            const recheck = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
            if (!recheck) {
              await updateJobProgress(jobId, { status: "paused", errorMessage: "⚠️ Sessione WCA scaduta." });
              return;
            }
            const recentLens = rateLimit.getRecentLengths(3);
            const sameLen = recentLens.every(l => l === recentLens[0] && l > 1000);
            if (sameLen) {
              rateLimit.forceDetected();
              setGreenZoneDelay(30);
              await appendLog(jobId, "WARN", `🛡️ Sessione attiva MA html identico = RATE LIMIT. Delay 30s.`);
              consecutiveNotFound = 0;
              await updateJobProgress(jobId, { currentIndex: i + 1, processedIds: [...processedSet], lastWcaId: wcaId, contactResult: "rate_limited", contactsMissing });
              continue;
            }
            sessionVerifiedActive = true;
            await appendLog(jobId, "INFO", "✅ Sessione attiva — 'not found' genuini, skip permanente");
            const notFoundIds = [...retryQueue.splice(0), wcaId];
            for (const nfId of notFoundIds) {
              processedSet.add(nfId);
              contactsMissing++;
              try { await supabase.from("partners_no_contacts").upsert({ wca_id: nfId, company_name: cacheMap.get(nfId)?.name || `WCA ${nfId}`, country_code: job.country_code, scraped_at: new Date().toISOString() }, { onConflict: "wca_id" }); } catch {}
            }
            consecutiveNotFound = 0;
            await updateJobProgress(jobId, { currentIndex: i + 1, processedIds: [...processedSet], lastWcaId: wcaId, contactResult: "not_found", contactsMissing });
            continue;
          }

          await appendLog(jobId, "SKIP", `⚠️ #${wcaId} 'member not found' (html=${action.htmlLength}) — retry (${consecutiveNotFound} consecutivi)`);
          retryQueue.push(wcaId);
          emitSkip(partnerId, wcaId, progressName, job.country_code);
          await updateJobProgress(jobId, { currentIndex: i + 1, processedIds: [...processedSet], lastWcaId: wcaId, contactResult: "retry_queued", contactsMissing });
          continue;
        }

        if (action.type === "error") {
          retryQueue.push(wcaId);
          emitSkip(partnerId, wcaId, progressName, job.country_code);
          await updateJobProgress(jobId, { currentIndex: i + 1, lastWcaId: wcaId, contactResult: "retry_queued" });
          continue;
        }

        if (action.type === "skip_permanent") {
          processedSet.add(wcaId);
          contactsMissing++;
          await updateJobProgress(jobId, { currentIndex: processedSet.size, processedIds: [...processedSet], lastWcaId: wcaId, contactResult: "not_found", contactsMissing });
          continue;
        }

        // SUCCESS (action.type === "success")
        const s = action;
        const isCompletelyEmpty = !s.profileSaved && !s.hasEmail && !s.hasPhone;
        if (isCompletelyEmpty) {
          consecutiveEmpty++;
          if (consecutiveEmpty >= 3) {
            await appendLog(jobId, "WARN", "⚠️ 3 profili vuoti consecutivi — tentativo auto-login...");
            let recovered = false;
            for (let attempt = 1; attempt <= 2; attempt++) {
              const recheck = await verifyWcaSession(jobId, availableRef.current, checkAvailableRef.current);
              if (recheck) { consecutiveEmpty = 0; recovered = true; break; }
              if (attempt < 2) await new Promise(r => setTimeout(r, 10000));
            }
            if (!recovered) {
              await updateJobProgress(jobId, { status: "paused", errorMessage: "⚠️ Sessione WCA scaduta — auto-login fallito." });
              return;
            }
          }
        } else {
          consecutiveEmpty = 0;
        }
        consecutiveSkipped = 0;
        consecutiveNotFound = 0;
        sessionVerifiedActive = false;

        const hasAny = s.hasEmail || s.hasPhone;
        if (hasAny) contactsFound++; else contactsMissing++;
        processedSet.add(wcaId);

        onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName: s.companyName, countryCode: job.country_code, profileSaved: s.profileSaved, emailCount: s.emailCount, phoneCount: s.phoneCount, contactCount: s.emailCount + s.phoneCount });

        const indicators = [s.profileSaved ? "📋 ✓" : "📋 ✗", s.hasEmail ? `📧 ✓(${s.emailCount})` : "📧 ✗", s.hasPhone ? `📱 ✓(${s.phoneCount})` : "📱 ✗"].join("  ");
        await appendLog(jobId, hasAny ? "OK" : "WARN", `${s.companyName} (#${wcaId}) — ${indicators}`);

        const contactResult = s.hasEmail && s.hasPhone ? "email+phone" : s.hasEmail ? "email_only" : s.hasPhone ? "phone_only" : "no_contacts";
        await updateJobProgress(jobId, { currentIndex: processedSet.size, processedIds: [...processedSet], lastWcaId: wcaId, lastCompany: s.companyName, contactResult, contactsFound, contactsMissing, errorMessage: null });

        if (processedSet.size % 5 === 0) invalidateCaches();
      }

      // ═══════════════════════════════════════
      // PASS 2 — Retry queue
      // ═══════════════════════════════════════
      const failedIds: number[] = [];

      if (retryQueue.length > 0 && !ac.signal.aborted) {
        await appendLog(jobId, "INFO", `🔄 Retry pass — ${retryQueue.length} profili (delay +50%)`);
        let retryConsecutiveSkipped = 0;

        for (let ri = 0; ri < retryQueue.length; ri++) {
          if (ac.signal.aborted) break;
          const wcaId = retryQueue[ri];
          if (processedSet.has(wcaId)) continue;

          await appendLog(jobId, "START", `[Retry] #${wcaId} (${ri + 1}/${retryQueue.length})`);
          const greenOk = await waitForGreenLight(ac.signal, () => {});
          if (!greenOk || ac.signal.aborted) break;

          const { data: existing } = await supabase.from("partners").select("id, company_name").eq("wca_id", wcaId).maybeSingle();
          const retryCtx: ProcessContext = { ...ctx, extractContacts: extractContactsRef.current, isRetryPass: true };
          const companyName = existing?.company_name || cacheMap.get(wcaId)?.name || `WCA ${wcaId}`;

          // Bug fix: emit progress so canvas shows "extracting..." card during retry
          onProgressRef.current?.({ partnerId: existing?.id || `wca-${wcaId}`, companyName, countryCode: job.country_code, index: ri + 1, total: retryQueue.length });

          const { action, partnerId } = await processOneProfile(wcaId, existing?.id || null, companyName, retryCtx);

          if (action.type === "bridge_missing") {
            failedIds.push(wcaId);
            onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true, error: "bridge_missing" });
            continue;
          }

          if (action.type === "retry" || action.type === "error") {
            retryConsecutiveSkipped++;
            failedIds.push(wcaId);
            onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true, error: action.type });
            if (retryConsecutiveSkipped >= 3) {
              await appendLog(jobId, "WARN", "⚠️ 3 retry falliti — interrompo");
              for (let rj = ri + 1; rj < retryQueue.length; rj++) {
                if (!processedSet.has(retryQueue[rj])) failedIds.push(retryQueue[rj]);
              }
              break;
            }
            continue;
          }

          if (action.type === "rate_limited") {
            if (rateLimit.detected) {
              await appendLog(jobId, "SKIP", `[Retry] #${wcaId} still rate-limited — fallito`);
              failedIds.push(wcaId);
              onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true, error: "rate_limited" });
            } else {
              await appendLog(jobId, "SKIP", `[Retry] #${wcaId} non esiste — skip permanente`);
              processedSet.add(wcaId);
              contactsMissing++;
              onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
            }
            continue;
          }

          if (action.type === "skip_permanent") {
            processedSet.add(wcaId);
            contactsMissing++;
            onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName, countryCode: job.country_code, profileSaved: false, emailCount: 0, phoneCount: 0, contactCount: 0, skipped: true });
            continue;
          }

          // SUCCESS
          retryConsecutiveSkipped = 0;
          const s = action;
          const hasAny = s.hasEmail || s.hasPhone;
          if (hasAny) contactsFound++; else contactsMissing++;
          processedSet.add(wcaId);

          // Bug fix: emit result so canvas shows retry successes
          onResultRef.current?.({ partnerId: partnerId || `wca-${wcaId}`, companyName: s.companyName, countryCode: job.country_code, profileSaved: s.profileSaved, emailCount: s.emailCount, phoneCount: s.phoneCount, contactCount: s.emailCount + s.phoneCount });

          const indicators = [s.profileSaved ? "📋 ✓" : "📋 ✗", s.hasEmail ? `📧 ✓(${s.emailCount})` : "📧 ✗", s.hasPhone ? `📱 ✓(${s.phoneCount})` : "📱 ✗"].join(" ");
          await appendLog(jobId, hasAny ? "OK" : "WARN", `[Retry] ${s.companyName} (#${wcaId}) — ${indicators}`);

          await updateJobProgress(jobId, { processedIds: [...processedSet], contactsFound, contactsMissing, failedIds });
        }

        if (failedIds.length > 0) await appendLog(jobId, "WARN", `⚠️ ${failedIds.length} profili non scaricati dopo retry`);
        else await appendLog(jobId, "OK", "✅ Retry completato");
      }

      // Job complete
      if (!ac.signal.aborted) {
        await appendLog(jobId, "DONE", `Job completato — ${processedSet.size} processati, ${failedIds.length} falliti`);
        await updateJobProgress(jobId, { failedIds });
        try {
          await supabase.functions.invoke("process-download-job", { body: { jobId, action: "complete" } });
        } catch {
          await updateJobProgress(jobId, { status: "completed" });
          await supabase.from("download_jobs").update({ completed_at: new Date().toISOString() }).eq("id", jobId);
        }
      }
    } finally {
      setGreenZoneDelay(20);
      processingRef.current = false;
      setIsProcessing(false);
      abortRef.current = null;
      for (const key of ["download-jobs", "ops-global-stats", "contact-completeness", "cache-data-by-country", "country-stats"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    }
  }, [queryClient]);

  // Emergency stop
  const emergencyStop = useCallback(() => {
    abortRef.current?.abort();
    supabase.from("download_jobs").select("id, terminal_log").in("status", ["running", "pending"]).then(async ({ data }) => {
      const ts = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      for (const job of (data || [])) {
        const log = [...((job.terminal_log as any[]) || []), { ts, type: "STOP", msg: "🛑 EMERGENCY STOP" }].slice(-150);
        await supabase.from("download_jobs").update({ status: "cancelled", error_message: "EMERGENCY STOP", terminal_log: log as any }).eq("id", job.id);
      }
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
    });
  }, [queryClient]);

  // Auto-start: watch for pending/orphaned jobs
  const startJobRef = useRef(startJob);
  startJobRef.current = startJob;

  useEffect(() => {
    const interval = setInterval(async () => {
      if (processingRef.current) return;
      const { data: pending } = await supabase.from("download_jobs").select("id").eq("status", "pending").limit(1);
      if (pending?.length && !processingRef.current) { startJobRef.current(pending[0].id); return; }
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data: orphaned } = await supabase.from("download_jobs").select("id, terminal_log").eq("status", "running").lt("updated_at", cutoff).limit(1);
      if (orphaned?.length && !processingRef.current) {
        const job = orphaned[0];
        const ts = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
        const log = [...((job.terminal_log as any[]) || []), { ts, type: "INFO", msg: "🔄 Ripresa automatica dopo refresh" }].slice(-150);
        await supabase.from("download_jobs").update({ status: "pending", error_message: null, terminal_log: log as any }).eq("id", job.id).eq("status", "running");
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return { startJob, emergencyStop, isProcessing, onProgressRef, onResultRef };
}
