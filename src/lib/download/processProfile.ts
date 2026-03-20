import { supabase } from "@/integrations/supabase/client";
import { appendLog } from "./terminalLog";
import { markRequestSent } from "@/lib/wcaCheckpoint";
import { saveExtractionResult } from "./profileSaver";

/* ── Result types ── */
export type ProfileAction =
  | { type: "success"; hasEmail: boolean; hasPhone: boolean; profileSaved: boolean; companyName: string; emailCount: number; phoneCount: number }
  | { type: "retry"; reason: string }
  | { type: "skip_permanent"; reason: string }
  | { type: "rate_limited"; htmlLength: number }
  | { type: "bridge_missing" }
  | { type: "error"; message: string };

export interface ProcessContext {
  jobId: string;
  countryCode: string;
  countryName: string;
  cacheMap: Map<number, { name: string; city: string }>;
  extractContacts: (wcaId: number) => Promise<any>;
  isRetryPass: boolean;
}

/**
 * V2: Process a single WCA profile.
 * KEY CHANGE: markRequestSent() is called BEFORE the extension request,
 * so the green zone delay overlaps with the extraction time.
 * On local timeout/error (no actual WCA call), we RESET the checkpoint
 * to avoid wasting 20s on a non-WCA failure.
 */
export async function processOneProfile(
  wcaId: number,
  partnerId: string | null,
  companyName: string,
  ctx: ProcessContext,
): Promise<{ action: ProfileAction; partnerId: string | null }> {
  const { jobId, isRetryPass } = ctx;
  const tag = isRetryPass ? "[Retry] " : "";

  // 1. Bridge guard
  if (typeof ctx.extractContacts !== "function") {
    await appendLog(jobId, "ERROR", `${tag}#${wcaId}: Extension bridge non inizializzato — saltato`);
    return { action: { type: "bridge_missing" }, partnerId };
  }

  // 2. Ensure partner exists in DB
  if (!partnerId) {
    const { data: existing } = await supabase
      .from("partners").select("id, company_name").eq("wca_id", wcaId).maybeSingle();
    if (existing) {
      partnerId = existing.id;
      companyName = existing.company_name || companyName;
    } else {
      const cached = ctx.cacheMap.get(wcaId);
      const { data: newP } = await supabase.from("partners").insert({
        wca_id: wcaId,
        company_name: cached?.name || `WCA ${wcaId}`,
        country_code: ctx.countryCode,
        country_name: ctx.countryName,
        city: cached?.city || "",
      }).select("id").single();
      if (newP) partnerId = newP.id;
    }
  }

  // 3. Extract via extension
  // V2: Mark request BEFORE sending — the green zone timer starts now,
  // overlapping with the actual extraction time.
  markRequestSent();

  try {
    const result = await ctx.extractContacts(wcaId);

    // Diagnostic log
    const diagHtmlLen = result.profileHtml?.length || 0;
    const diagCompany = result.companyName || "N/A";
    const diagContacts = result.contacts?.length || 0;
    await appendLog(jobId, "INFO", `🔍 ${tag}#${wcaId} | html=${diagHtmlLen} | name="${diagCompany}" | contacts=${diagContacts} | loaded=${result.pageLoaded}`);

    // Save raw HTML even for failed profiles
    if (partnerId && result.profileHtml && diagHtmlLen > 100) {
      try {
        await supabase.from("partners").update({ raw_profile_html: result.profileHtml }).eq("id", partnerId);
      } catch { /* non-critical */ }
    }

    // 4a. Timeout / stale response → retry but DON'T penalize checkpoint
    if (result.error === "Timeout" || result.error?.includes("Stale response")) {
      // No actual WCA page was loaded — don't count this as a WCA request
      await appendLog(jobId, "SKIP", `${tag}Profilo #${wcaId} timeout locale — retry (nessuna chiamata WCA)`);
      return { action: { type: "retry", reason: "local_timeout" }, partnerId };
    }

    // 4b. Page not loaded → retry
    if (result.pageLoaded === false) {
      await appendLog(jobId, "SKIP", `${tag}Profilo #${wcaId} non caricato — retry`);
      return { action: { type: "retry", reason: "page_not_loaded" }, partnerId };
    }

    // 4c. Member not found
    const isMemberNotFound =
      result.companyName?.toLowerCase().includes("member not found") ||
      result.error?.toLowerCase().includes("member not found");
    if (isMemberNotFound) {
      const htmlLen = result.htmlLength || result.profileHtml?.length || 0;
      return { action: { type: "rate_limited", htmlLength: htmlLen }, partnerId };
    }

    // 4d. Extension error (success: false but page loaded)
    if (result.success === false) {
      await appendLog(jobId, "SKIP", `${tag}Profilo #${wcaId} errore estensione: ${result.error || "sconosciuto"} — retry`);
      return { action: { type: "retry", reason: "extension_error" }, partnerId };
    }

    // 5. Success — save extraction
    if (partnerId) {
      const saved = await saveExtractionResult(partnerId, wcaId, result, companyName);
      return {
        action: {
          type: "success",
          hasEmail: saved.hasEmail,
          hasPhone: saved.hasPhone,
          profileSaved: saved.profileSaved,
          companyName: saved.companyName,
          emailCount: saved.extractedEmailCount,
          phoneCount: saved.extractedPhoneCount,
        },
        partnerId,
      };
    }

    return { action: { type: "success", hasEmail: false, hasPhone: false, profileSaved: false, companyName, emailCount: 0, phoneCount: 0 }, partnerId };
  } catch (err) {
    await appendLog(jobId, "ERROR", `${tag}Errore #${wcaId}: ${(err as Error).message || err} — retry`);
    return { action: { type: "error", message: (err as Error).message || String(err) }, partnerId };
  }
}
