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
 * Process a single WCA profile: ensure partner exists, extract via extension, save results.
 * Returns a structured action telling the caller what to do next.
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
    markRequestSent();
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
  try {
    const result = await ctx.extractContacts(wcaId);
    markRequestSent();

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

    // 4a. Page not loaded → retry
    if (result.pageLoaded === false) {
      await appendLog(jobId, "SKIP", `${tag}Profilo #${wcaId} non caricato — retry`);
      return { action: { type: "retry", reason: "page_not_loaded" }, partnerId };
    }

    // 4b. Member not found
    const isMemberNotFound =
      result.companyName?.toLowerCase().includes("member not found") ||
      result.error?.toLowerCase().includes("member not found");
    if (isMemberNotFound) {
      const htmlLen = result.htmlLength || result.profileHtml?.length || 0;
      return { action: { type: "rate_limited", htmlLength: htmlLen }, partnerId };
    }

    // 4c. Extension error (success: false but page loaded)
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
    markRequestSent();
    await appendLog(jobId, "ERROR", `${tag}Errore #${wcaId}: ${(err as Error).message || err} — retry`);
    return { action: { type: "error", message: (err as Error).message || String(err) }, partnerId };
  }
}
