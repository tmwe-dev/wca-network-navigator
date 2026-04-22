/**
 * downloadJobs.ts — Download job creation executor.
 * Handles create_download_job tool.
 */

import { loadWcaIds } from "./wcaIdResolver.ts";

type SupabaseClient = ReturnType<
  typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient
>;

export async function executeCreateDownloadJob(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
): Promise<unknown> {
  const countryCode = String(args.country_code || "").toUpperCase();
  const countryName = String(args.country_name || "");
  const mode = String(args.mode || "no_profile");
  const networkName = String(args.network_name || "Tutti");
  const delaySec = Math.max(15, Number(args.delay_seconds) || 15);

  if (!countryCode || !countryName) {
    return { error: "country_code e country_name sono obbligatori" };
  }

  const { data: activeJobs } = await supabase
    .from("download_jobs")
    .select("id, country_code, status")
    .in("status", ["pending", "running"])
    .limit(5);
  if (activeJobs && activeJobs.length > 0) {
    const sameCountry = (activeJobs as Record<string, unknown>[]).find(
      (j) => j.country_code === countryCode,
    );
    if (sameCountry) {
      return {
        error: `Esiste già un job attivo per ${countryName} (${countryCode}).`,
        active_job_id: sameCountry.id,
      };
    }
    if (activeJobs.length >= 1) {
      return {
        error: `C'è già un job attivo (${
          (activeJobs[0] as Record<string, unknown>).country_code
        }). Attendi il completamento prima di avviarne un altro.`,
        active_job_id: (activeJobs[0] as Record<string, unknown>).id,
      };
    }
  }

  const { data: deadRows } = await supabase
    .from("partners_no_contacts")
    .select("wca_id")
    .eq("resolved", false);
  const deadIdSet = new Set(
    (deadRows || []).map((r: Record<string, unknown>) => Number(r.wca_id)),
  );

  const wcaIds = await loadWcaIds(supabase, countryCode, mode, deadIdSet);

  if (wcaIds.length === 0) {
    const modeLabels: Record<string, string> = {
      new: "nuovi",
      no_profile: "senza profilo",
      all: "tutti",
    };
    return {
      success: false,
      message: `Nessun partner da scaricare in modalità "${
        modeLabels[mode] || mode
      }" per ${countryName}.`,
    };
  }

  const { data: job, error } = await supabase
    .from("download_jobs")
    .insert({
      country_code: countryCode,
      country_name: countryName,
      network_name: networkName,
      wca_ids: wcaIds as unknown,
      total_count: wcaIds.length,
      delay_seconds: delaySec,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) return { error: `Errore creazione job: ${error.message}` };

  const jobItems = wcaIds.map((id: number, i: number) => ({
    job_id: (job as Record<string, unknown>).id,
    wca_id: id,
    position: i,
    status: "pending",
  }));
  for (let i = 0; i < jobItems.length; i += 500) {
    await supabase
      .from("download_job_items")
      .insert(jobItems.slice(i, i + 500));
  }

  const modeLabels: Record<string, string> = {
    new: "Nuovi partner",
    no_profile: "Solo profili mancanti",
    all: "Aggiorna tutti",
  };
  return {
    success: true,
    job_id: (job as Record<string, unknown>).id,
    country: `${countryName} (${countryCode})`,
    mode: modeLabels[mode] || mode,
    total_partners: wcaIds.length,
    delay_seconds: delaySec,
    estimated_time_minutes: Math.ceil(wcaIds.length * (delaySec + 5) / 60),
    message: `Job creato! ${wcaIds.length} partner da scaricare per ${countryName}. Il download partirà automaticamente.`,
  };
}
