import { useRef, useCallback, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useExtensionBridge } from "./useExtensionBridge";
import { useQueryClient } from "@tanstack/react-query";
import { waitForGreenLight, markRequestSent } from "@/lib/wcaCheckpoint";

/**
 * NEW download processor — minimal, checkpoint-driven.
 *
 * No polling loop. No singleton. No mutex. No auto-restart.
 * Just a simple `for` loop that:
 *   1. Waits for green light (15s checkpoint)
 *   2. Makes ONE request
 *   3. Marks request sent
 *   4. Repeats until done or aborted
 */

export function useDownloadProcessor() {
  const { isAvailable, checkAvailable, extractContacts } = useExtensionBridge();
  const queryClient = useQueryClient();
  const abortRef = useRef<AbortController | null>(null);
  const processingRef = useRef(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const availableRef = useRef(isAvailable);
  availableRef.current = isAvailable;
  const checkAvailableRef = useRef(checkAvailable);
  checkAvailableRef.current = checkAvailable;
  const extractContactsRef = useRef(extractContacts);
  extractContactsRef.current = extractContacts;

  // ── Terminal log helper ──
  const appendLog = async (jobId: string, type: string, msg: string) => {
    const ts = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    try {
      const { data } = await supabase.from("download_jobs").select("terminal_log").eq("id", jobId).single();
      const current = (data?.terminal_log as any[] || []);
      const updated = [...current, { ts, type, msg }].slice(-100);
      await supabase.from("download_jobs").update({ terminal_log: updated as any }).eq("id", jobId);
    } catch {}
  };

  // ── Session verification (reused from old processor) ──
  const verifySession = async (jobId: string): Promise<boolean> => {
    const extOk = availableRef.current || await checkAvailableRef.current();
    if (!extOk) { await appendLog(jobId, "WARN", "❌ Estensione Chrome non disponibile"); return false; }

    const verify = () => new Promise<any>((resolve) => {
      const requestId = `verifySession_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timer = setTimeout(() => resolve({ success: false }), 30000);
      const handler = (event: MessageEvent) => {
        if (event.source !== window || event.data?.direction !== "from-extension" || event.data?.requestId !== requestId) return;
        clearTimeout(timer); window.removeEventListener("message", handler);
        resolve(event.data?.response || { success: false });
      };
      window.addEventListener("message", handler);
      window.postMessage({ direction: "from-webapp", action: "verifySession", requestId }, "*");
    });

    const result = await verify();
    if (result.success && result.authenticated) { await appendLog(jobId, "INFO", "✅ Sessione WCA attiva"); return true; }

    // Auto-login attempt
    await appendLog(jobId, "INFO", "🔑 Tentativo auto-login...");
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-wca-credentials`;
      const res = await fetch(url, { headers: { "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
      const creds = await res.json();
      if (!creds.username || !creds.password) { await appendLog(jobId, "WARN", "❌ Credenziali WCA non configurate"); return false; }

      const loginOk = await new Promise<boolean>((resolve) => {
        const requestId = `autoLogin_${Date.now()}`;
        const timer = setTimeout(() => resolve(false), 45000);
        const handler = (event: MessageEvent) => {
          if (event.source !== window || event.data?.direction !== "from-extension" || event.data?.requestId !== requestId) return;
          clearTimeout(timer); window.removeEventListener("message", handler);
          resolve(event.data?.response?.success === true);
        };
        window.addEventListener("message", handler);
        window.postMessage({ direction: "from-webapp", action: "autoLogin", requestId, username: creds.username, password: creds.password }, "*");
      });

      if (!loginOk) { await appendLog(jobId, "WARN", "❌ Auto-login fallito"); return false; }
      const retry = await verify();
      if (retry.success && retry.authenticated) { await appendLog(jobId, "INFO", "✅ Sessione attiva dopo auto-login"); return true; }
      await appendLog(jobId, "WARN", "❌ Sessione ancora non attiva"); return false;
    } catch { await appendLog(jobId, "WARN", "❌ Errore auto-login"); return false; }
  };

  // ══════════════════════════════════════════════
  // THE CORE: startJob — simple for loop
  // ══════════════════════════════════════════════
  const startJob = useCallback(async (jobId: string) => {
    if (processingRef.current) {
      console.log("[Processor] Already processing, skipping startJob for:", jobId);
      return;
    }
    processingRef.current = true;
    setIsProcessing(true);
    console.log("[Processor] startJob BEGIN:", jobId);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Fetch job
      const { data: job } = await supabase.from("download_jobs").select("*").eq("id", jobId).single();
      if (!job) { setIsProcessing(false); return; }

      const wcaIds: number[] = (job.wca_ids as number[]) || [];
      const startIndex = job.current_index || 0;
      const processedSet = new Set<number>(((job.processed_ids as number[]) || []));

      // Verify session
      const sessionOk = await verifySession(jobId);
      if (!sessionOk) {
        await supabase.from("download_jobs").update({ status: "paused", error_message: "⚠️ Sessione WCA non attiva." }).eq("id", jobId);
        setIsProcessing(false); return;
      }

      // Atomic claim
      const { data: claimed } = await supabase.from("download_jobs")
        .update({ status: "running", error_message: null, terminal_log: [] as any })
        .eq("id", jobId).eq("status", "pending").select("id");
      if (!claimed || claimed.length === 0) { setIsProcessing(false); return; }

      await appendLog(jobId, "INFO", `Job avviato — ${wcaIds.length} profili`);

      // Pre-load directory cache
      const cacheMap = new Map<number, { name: string; city: string }>();
      const { data: cacheEntries } = await supabase.from("directory_cache").select("members").eq("country_code", job.country_code);
      for (const entry of (cacheEntries || [])) {
        for (const m of (entry.members as any[] || [])) {
          if (m.wca_id) cacheMap.set(m.wca_id, { name: m.company_name || `WCA ${m.wca_id}`, city: m.city || "" });
        }
      }

      let contactsFound = job.contacts_found_count || 0;
      let contactsMissing = job.contacts_missing_count || 0;

      // ══════════════════════════════════════════════
      // MAIN LOOP — one profile at a time
      // ══════════════════════════════════════════════
      for (let i = startIndex; i < wcaIds.length; i++) {
        if (ac.signal.aborted) break;

        const wcaId = wcaIds[i];
        if (processedSet.has(wcaId)) continue;

        await appendLog(jobId, "START", `Profilo #${wcaId} (${i + 1}/${wcaIds.length})`);

        // 1. WAIT FOR GREEN LIGHT — checkpoint gate
        const greenOk = await waitForGreenLight(ac.signal, (remaining) => {
          console.log(`[Processor] Waiting ${remaining}s for green light...`);
        });
        if (!greenOk || ac.signal.aborted) break;

        // 2. Ensure partner exists in DB
        let partnerId: string | null = null;
        const { data: existing } = await supabase.from("partners").select("id, company_name").eq("wca_id", wcaId).maybeSingle();
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

        // 3. EXTRACT — single request with 4s timeout
        let hasEmail = false, hasPhone = false, profileSaved = false;
        let companyName = existing?.company_name || cacheMap.get(wcaId)?.name || `WCA ${wcaId}`;
        let extractedEmailCount = 0, extractedPhoneCount = 0;

        try {
          const timeout4s = new Promise<{ success: false; error: string; pageLoaded: false }>((r) =>
            setTimeout(() => r({ success: false, error: "Timeout 4s", pageLoaded: false }), 4000)
          );
          const result = await Promise.race([extractContactsRef.current(wcaId), timeout4s]);

          // 4. MARK REQUEST SENT — immediately after extraction
          markRequestSent();

          // Zero Retry: skip if page didn't load
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

          // Save contacts (deduplicate)
          if (result.success && result.contacts?.length > 0 && partnerId) {
            const { data: existingContacts } = await supabase.from("partner_contacts").select("id, name, email").eq("partner_id", partnerId);
            const existingByName = new Map((existingContacts || []).map(c => [c.name?.trim().toLowerCase(), c]));

            for (const c of result.contacts) {
              const nameKey = (c.name || c.title || "Sconosciuto").trim().toLowerCase();
              if (!existingByName.has(nameKey)) {
                await supabase.from("partner_contacts").insert({
                  partner_id: partnerId, name: c.name || c.title || "Sconosciuto",
                  title: c.title || null, email: c.email || null,
                  direct_phone: c.phone || null, mobile: c.mobile || null,
                });
              } else {
                const ex = existingByName.get(nameKey)!;
                const updates: Record<string, string> = {};
                if (c.email && !ex.email) updates.email = c.email;
                if (Object.keys(updates).length > 0) await supabase.from("partner_contacts").update(updates).eq("id", ex.id);
              }
              if (c.email) hasEmail = true;
              if (c.phone || c.mobile) hasPhone = true;
            }
            extractedEmailCount = result.contacts.filter((c: any) => c.email).length;
            extractedPhoneCount = result.contacts.filter((c: any) => c.phone || c.mobile).length;
          }

          // Save company name
          if (result.companyName && !result.companyName.startsWith("WCA ") && partnerId) {
            companyName = result.companyName;
            await supabase.from("partners").update({ company_name: companyName }).eq("id", partnerId);
          }

          // Save profile data
          if (result.profile && partnerId) {
            const p = result.profile;
            const upd: Record<string, any> = {};
            if (p.address) upd.address = p.address;
            if (p.phone) upd.phone = p.phone;
            if (p.fax) upd.fax = p.fax;
            if (p.mobile) upd.mobile = p.mobile;
            if (p.emergencyPhone) upd.emergency_phone = p.emergencyPhone;
            if (p.email) upd.email = p.email;
            if (p.website) upd.website = p.website;
            if (p.description) upd.profile_description = p.description;
            if (p.memberSince) upd.member_since = p.memberSince;
            if (p.membershipExpires) upd.membership_expires = p.membershipExpires;
            if (p.officeType) {
              const ot = p.officeType.toLowerCase();
              if (ot.includes("head") || ot.includes("main")) upd.office_type = "head_office";
              else if (ot.includes("branch")) upd.office_type = "branch";
            }
            if (p.branchCities?.length > 0) { upd.has_branches = true; upd.branch_cities = p.branchCities; }
            if (result.profileHtml) upd.raw_profile_html = result.profileHtml;
            if (Object.keys(upd).length > 0) { await supabase.from("partners").update(upd).eq("id", partnerId); profileSaved = true; }
          }
          if (result.profileHtml || result.profile?.description) profileSaved = true;
        } catch (err) {
          markRequestSent(); // still mark to avoid rapid-fire
          await appendLog(jobId, "ERROR", `Errore #${wcaId}: ${(err as Error).message || err}`);
        }

        // Update counters
        const hasAny = hasEmail || hasPhone;
        if (hasAny) contactsFound++; else contactsMissing++;
        const contactResult = hasEmail && hasPhone ? "email+phone" : hasEmail ? "email_only" : hasPhone ? "phone_only" : "no_contacts";
        processedSet.add(wcaId);

        const indicators = [
          profileSaved ? "📋 Profilo ✓" : "📋 Profilo ✗",
          hasEmail ? `📧 Email ✓ (${extractedEmailCount})` : "📧 Email ✗",
          hasPhone ? `📱 Tel ✓ (${extractedPhoneCount})` : "📱 Tel ✗",
        ].join("  ");
        await appendLog(jobId, hasAny ? "OK" : "WARN", `${companyName} (#${wcaId}) — ${indicators}`);

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

      // Complete job
      if (!ac.signal.aborted) {
        await appendLog(jobId, "DONE", `Job completato — ${processedSet.size} profili processati`);
        try {
          await supabase.functions.invoke("process-download-job", { body: { jobId, action: "complete" } });
        } catch {
          await supabase.from("download_jobs").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", jobId);
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
        const log = [...((job.terminal_log as any[]) || []), { ts, type: "STOP", msg: "🛑 EMERGENCY STOP" }].slice(-100);
        await supabase.from("download_jobs").update({ status: "cancelled", error_message: "EMERGENCY STOP", terminal_log: log as any }).eq("id", job.id);
      }
      queryClient.invalidateQueries({ queryKey: ["download-jobs"] });
    });
  }, [queryClient]);

  // ── Auto-start: watch for pending jobs when idle (supports "Riprendi" from JobMonitor) ──
  const startJobRef = useRef(startJob);
  startJobRef.current = startJob;

  useEffect(() => {
    const interval = setInterval(() => {
      if (processingRef.current) return;
      supabase.from("download_jobs").select("id").eq("status", "pending").limit(1).then(({ data }) => {
        if (data && data.length > 0 && !processingRef.current) {
          console.log("[Processor] Auto-starting pending job:", data[0].id);
          startJobRef.current(data[0].id);
        }
      });
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return { startJob, emergencyStop, isProcessing };
}
