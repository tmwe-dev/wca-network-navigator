/**
 * Read handler: job e code operative.
 * Estratto da `toolHandlersRead.ts` (stessi handler, stessa firma, stesso comportamento).
 */

// Permissive client type — vedi toolHandlersRead.ts
// deno-lint-ignore no-explicit-any
type SupabaseClient = import("./supabaseClient.ts").AnySupabaseClient;

export function createJobReadHandlers(supabase: SupabaseClient) {

  async function executeListJobs(args: Record<string, unknown>, userId?: string) {
    let query = supabase.from("download_jobs")
      .select("id, country_code, country_name, status, job_type, current_index, total_count, contacts_found_count, contacts_missing_count, created_at, updated_at, last_processed_company, error_message, network_name")
      .order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
    if (userId) query = query.eq("user_id", userId);
    if (args.status) query = query.eq("status", args.status);
    if (args.country_code) query = query.eq("country_code", String(args.country_code).toUpperCase());
    const { data, error } = await query;
    if (error) return { error: error.message };
    return {
      count: data?.length,
      jobs: (data || []).map((j: Record<string, unknown>) => ({
        id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status, type: j.job_type,
        progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count, missing: j.contacts_missing_count,
        last_company: j.last_processed_company || null, network: j.network_name, error: j.error_message || null, created: j.created_at,
      })),
    };
  }

  async function executeCheckJobStatus(args: Record<string, unknown>, userId?: string) {
    const result: Record<string, unknown> = {};
    if (args.job_id) {
      let jq = supabase.from("download_jobs")
        .select("id, country_code, country_name, status, job_type, current_index, total_count, contacts_found_count, contacts_missing_count, created_at, updated_at, completed_at, last_processed_company, error_message, network_name")
        .eq("id", args.job_id);
      if (userId) jq = jq.eq("user_id", userId);
      const { data: job, error } = await jq.maybeSingle();
      if (error || !job) {
        result.job = { error: "Job non trovato", job_id: args.job_id };
      } else {
        const progress = job.total_count > 0 ? Math.round((job.current_index / job.total_count) * 100) : 0;
        const elapsed = job.updated_at && job.created_at ? Math.round((new Date(job.updated_at).getTime() - new Date(job.created_at).getTime()) / 60000) : null;
        result.job = {
          id: job.id, country: `${job.country_name} (${job.country_code})`, status: job.status, type: job.job_type,
          progress_percent: progress, current: job.current_index, total: job.total_count,
          contacts_found: job.contacts_found_count, contacts_missing: job.contacts_missing_count,
          last_company: job.last_processed_company, error: job.error_message || null, elapsed_minutes: elapsed,
          completed_at: job.completed_at, is_finished: ["completed", "cancelled", "failed"].includes(job.status),
          verdict: job.status === "completed" ? `✅ Completato: ${job.contacts_found_count} contatti trovati, ${job.contacts_missing_count} mancanti`
            : job.status === "running" ? `⏳ In corso: ${progress}% (${job.current_index}/${job.total_count})`
            : job.status === "failed" || job.error_message ? `❌ Errore: ${job.error_message || "sconosciuto"}`
            : `🕐 ${job.status}`,
        };
      }
    }
    let activeQ = supabase.from("download_jobs")
      .select("id, country_name, country_code, status, current_index, total_count, job_type, last_processed_company, error_message, created_at")
      .in("status", ["running", "pending", "paused"]).order("created_at", { ascending: false }).limit(10);
    if (userId) activeQ = activeQ.eq("user_id", userId);
    const { data: activeJobs } = await activeQ;
    result.active_downloads = {
      count: activeJobs?.length || 0,
      jobs: (activeJobs || []).map((j: Record<string, unknown>) => {
        const total = Number(j.total_count) || 0;
        const current = Number(j.current_index) || 0;
        return {
          id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status,
          progress: total > 0 ? `${Math.round((current / total) * 100)}%` : "0%",
          detail: `${current}/${total}`, last_company: j.last_processed_company, error: j.error_message,
        };
      }),
    };
    let recentQ = supabase.from("download_jobs")
      .select("id, country_name, country_code, status, current_index, total_count, contacts_found_count, contacts_missing_count, completed_at, error_message")
      .in("status", ["completed", "cancelled", "failed"]).order("completed_at", { ascending: false }).limit(5);
    if (userId) recentQ = recentQ.eq("user_id", userId);
    const { data: recentJobs } = await recentQ;
    result.recently_completed = {
      count: recentJobs?.length || 0,
      jobs: (recentJobs || []).map((j: Record<string, unknown>) => ({
        id: j.id, country: `${j.country_name} (${j.country_code})`, status: j.status,
        processed: `${j.current_index}/${j.total_count}`, contacts_found: j.contacts_found_count,
        contacts_missing: j.contacts_missing_count, completed_at: j.completed_at, error: j.error_message,
      })),
    };
    if (args.include_email_queue !== false) {
      let eq = supabase.from("email_campaign_queue").select("status").in("status", ["pending", "sending"]);
      if (userId) eq = eq.eq("user_id", userId);
      const { data: emailQueue } = await eq;
      const pending = (emailQueue || []).filter((r: Record<string, unknown>) => r.status === "pending").length;
      const sending = (emailQueue || []).filter((r: Record<string, unknown>) => r.status === "sending").length;
      result.email_queue = { pending, sending, total: pending + sending };
    }
    return result;
  }

  return {
    executeListJobs,
    executeCheckJobStatus,
  };
}
