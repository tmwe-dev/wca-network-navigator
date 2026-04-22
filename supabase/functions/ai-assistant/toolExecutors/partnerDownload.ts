/**
 * partnerDownload.ts — Single partner profile download executor.
 * Handles download_single_partner tool with company name lookup.
 */

import {
  resolveWcaId,
  resolveWcaIdFromCache,
  resolveCountry,
  resolveCountryName,
} from "./partnerLookup.ts";

type SupabaseClient = ReturnType<
  typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient
>;

export async function executeDownloadSinglePartner(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<unknown> {
  const companyName = String(args.company_name || "").trim();
  const city = args.city ? String(args.city).trim() : null;
  const countryCode = args.country_code
    ? String(args.country_code).toUpperCase()
    : null;
  let wcaId = args.wca_id ? Number(args.wca_id) : null;

  if (!companyName && !wcaId) {
    return { error: "Serve almeno il nome dell'azienda o il wca_id." };
  }

  if (!wcaId) {
    const resolved = await resolveWcaId(supabase, companyName, city, countryCode);
    if (resolved === null && companyName) {
      const { data: partner } = await supabase
        .from("partners")
        .select("company_name, city, country_code")
        .ilike("company_name", `%${escapeLike(companyName)}%`)
        .limit(1)
        .single();
      if (partner && !(partner as Record<string, unknown>).raw_profile_html) {
        const exact = partner as Record<string, unknown>;
        return {
          success: true,
          already_downloaded: true,
          partner_id: exact.id,
          company_name: exact.company_name,
          city: exact.city,
          country_code: exact.country_code,
          message: `"${exact.company_name}" ha già il profilo scaricato. Non serve un nuovo download.`,
        };
      }
    }
    wcaId = resolved;
  }

  if (!wcaId) {
    wcaId = await resolveWcaIdFromCache(supabase, companyName, countryCode);
  }

  if (!wcaId) {
    return {
      error: `"${companyName}" non trovata nel database, nella directory cache, né cercando direttamente su WCA. Verifica il nome esatto dell'azienda.`,
    };
  }

  const { data: deadRows } = await supabase
    .from("partners_no_contacts")
    .select("wca_id")
    .eq("resolved", false);
  const deadIdSet = new Set(
    (deadRows || []).map((r: Record<string, unknown>) => Number(r.wca_id)),
  );
  if (deadIdSet.has(Number(wcaId))) {
    return {
      error: `"${companyName}" (WCA ID: ${wcaId}) è nella lista "senza contatti". Probabilmente non ha dati utili.`,
    };
  }

  const { data: activeJobs } = await supabase
    .from("download_jobs")
    .select("id, status, country_code")
    .in("status", ["pending", "running"])
    .limit(5);
  if (activeJobs && activeJobs.length >= 1) {
    return {
      error: `C'è già un job attivo. Attendi il completamento prima di avviarne un altro.`,
      active_job_id: (activeJobs[0] as Record<string, unknown>).id,
    };
  }

  let jobCountryCode = countryCode || "";
  let jobCountryName = "";
  if (!jobCountryCode) {
    const country = await resolveCountry(supabase, wcaId);
    jobCountryCode = country.code;
    jobCountryName = country.name;
  }
  if (!jobCountryName) {
    jobCountryName = await resolveCountryName(supabase, jobCountryCode);
  }

  const { data: job, error } = await supabase
    .from("download_jobs")
    .insert({
      country_code: jobCountryCode,
      country_name: jobCountryName,
      network_name: "Tutti",
      wca_ids: [wcaId] as unknown,
      total_count: 1,
      delay_seconds: 15,
      status: "pending",
      job_type: "download",
    })
    .select("id")
    .single();

  if (error) return { error: `Errore creazione job: ${error.message}` };

  await supabase.from("download_job_items").insert({
    job_id: (job as Record<string, unknown>).id,
    wca_id: wcaId,
    position: 0,
    status: "pending",
  });

  return {
    success: true,
    job_id: (job as Record<string, unknown>).id,
    country: `${jobCountryName} (${jobCountryCode})`,
    mode: "Singolo partner",
    total_partners: 1,
    wca_id: wcaId,
    delay_seconds: 15,
    estimated_time_minutes: 1,
    message: `Job creato per scaricare il profilo di "${companyName}" (WCA ID: ${wcaId}). Tempo stimato: ~1 minuto.`,
  };
}
