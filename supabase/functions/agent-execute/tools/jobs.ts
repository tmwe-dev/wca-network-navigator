/**
 * tools/jobs.ts — handler del dominio "download jobs" per agent-execute.
 *
 * Estratto da `index.ts` in sessione #24 (Ondata 2, Fase 4 Vol. I — split
 * dei file monolitici). Contiene i case che operano su `download_jobs` e
 * `download_job_items`.
 *
 * Tool gestiti:
 *  - list_jobs
 *  - create_download_job
 *  - download_single_partner
 *  - check_job_status
 */
import { escapeLike } from "../../_shared/sqlEscape.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export const JOB_TOOLS = new Set<string>([
  "list_jobs",
  "create_download_job",
  "download_single_partner",
  "check_job_status",
]);

export async function executeJobTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
): Promise<unknown> {
  switch (name) {
    case "list_jobs": {
      let query = supabase.from("download_jobs").select("id, country_code, country_name, status, current_index, total_count, contacts_found_count, contacts_missing_count, last_processed_company, error_message, created_at").order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
      if (args.status) query = query.eq("status", args.status);
      if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
      const { data, error } = await query;
      if (error) return { error: error.message };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { count: data?.length, jobs: (data || []).map((j: any) => ({ id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status, progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count, missing: j.contacts_missing_count, last: j.last_processed_company, error: j.error_message })) };
    }

    case "create_download_job": {
      const cc = String(args.country_code || "").toUpperCase();
      const cn = String(args.country_name || "");
      const mode = String(args.mode || "no_profile");
      const delay = Math.max(15, Number(args.delay_seconds) || 15);
      if (!cc || !cn) return { error: "country_code e country_name obbligatori" };
      const { data: active } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
      if (active && active.length > 0) return { error: "C'è già un job attivo." };
      // Simplified: get IDs based on mode
      let wcaIds: number[] = [];
      if (mode === "no_profile") {
        const { data } = await supabase.from("partners").select("wca_id").eq("country_code", cc).not("wca_id", "is", null).is("raw_profile_html", null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wcaIds = (data || []).map((p: any) => p.wca_id).filter(Boolean);
      } else {
        const { data } = await supabase.from("partners").select("wca_id").eq("country_code", cc).not("wca_id", "is", null);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wcaIds = (data || []).map((p: any) => p.wca_id).filter(Boolean);
      }
      if (wcaIds.length === 0) return { error: `Nessun partner da scaricare per ${cn}.` };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: job, error } = await supabase.from("download_jobs").insert({ country_code: cc, country_name: cn, wca_ids: wcaIds as any, total_count: wcaIds.length, delay_seconds: delay, status: "pending" }).select("id").single();
      if (error) return { error: error.message };
      // Create items for V4 item-level tracking
      const jobItems = wcaIds.map((id: number, i: number) => ({ job_id: job.id, wca_id: id, position: i, status: "pending" }));
      for (let i = 0; i < jobItems.length; i += 500) { await supabase.from("download_job_items").insert(jobItems.slice(i, i + 500)); }
      return { success: true, job_id: job.id, total: wcaIds.length, message: `Job creato: ${wcaIds.length} partner per ${cn}.` };
    }

    case "download_single_partner": {
      const n = String(args.company_name || "").trim();
      if (!n) return { error: "Nome azienda obbligatorio" };
      const { data: found } = await supabase.from("partners").select("id, wca_id, company_name, country_code, country_name, raw_profile_html").ilike("company_name", `%${escapeLike(n)}%`).limit(1);
      if (!found || found.length === 0) return { error: `"${n}" non trovata nel database.` };
      const p = found[0];
      if (p.raw_profile_html) return { success: true, already_downloaded: true, message: `"${p.company_name}" ha già il profilo.` };
      if (!p.wca_id) return { error: `"${p.company_name}" non ha wca_id.` };
      const { data: active } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
      if (active && active.length > 0) return { error: "C'è già un job attivo." };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: job, error } = await supabase.from("download_jobs").insert({ country_code: p.country_code, country_name: p.country_name, wca_ids: [p.wca_id] as any, total_count: 1, delay_seconds: 15, status: "pending" }).select("id").single();
      if (error) return { error: error.message };
      // Create item for V4 tracking
      await supabase.from("download_job_items").insert({ job_id: job.id, wca_id: p.wca_id, position: 0, status: "pending" });
      return { success: true, job_id: job.id, message: `Download avviato per "${p.company_name}".` };
    }

    case "check_job_status": {
      if (args.job_id) {
        const { data } = await supabase.from("download_jobs").select("id, status, current_index, total_count, contacts_found_count, last_processed_company, error_message").eq("id", args.job_id).single();
        return data || { error: "Job non trovato" };
      }
      const { data } = await supabase.from("download_jobs").select("id, country_name, status, current_index, total_count").in("status", ["running", "pending"]).limit(5);
      return { active_jobs: data || [] };
    }

    default:
      throw new Error(`executeJobTool: tool non gestito "${name}"`);
  }
}
