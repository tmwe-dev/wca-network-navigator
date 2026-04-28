import type { AnySupabaseClient } from "../../_shared/supabaseClient.ts";
import { escapeLike } from "../shared.ts";

export async function handleCreateDownloadJob(
  supabase: AnySupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const cc = String(args.country_code || "").toUpperCase();
  const cn = String(args.country_name || "");
  const mode = String(args.mode || "no_profile");
  const delay = Math.max(15, Number(args.delay_seconds) || 15);

  if (!cc || !cn) {
    return { error: "country_code e country_name obbligatori" };
  }

  const { data: active } = await supabase
    .from("download_jobs")
    .select("id")
    .in("status", ["pending", "running"])
    .limit(1);

  if (active && active.length > 0) {
    return { error: "C'è già un job attivo." };
  }

  let wcaIds: number[] = [];
  if (mode === "no_profile") {
    const { data } = await supabase
      .from("partners")
      .select("wca_id")
      .eq("country_code", cc)
      .not("wca_id", "is", null)
      .is("raw_profile_html", null);
    wcaIds = (data || [])
      .map((p: { wca_id: number | null }) => p.wca_id)
      .filter(Boolean);
  } else {
    const { data } = await supabase
      .from("partners")
      .select("wca_id")
      .eq("country_code", cc)
      .not("wca_id", "is", null);
    wcaIds = (data || [])
      .map((p: { wca_id: number | null }) => p.wca_id)
      .filter(Boolean);
  }

  if (wcaIds.length === 0) {
    return { error: `Nessun partner da scaricare per ${cn}.` };
  }

  const { data: job, error } = await supabase
    .from("download_jobs")
    .insert({
      country_code: cc,
      country_name: cn,
      wca_ids: wcaIds as unknown as Record<string, unknown>,
      total_count: wcaIds.length,
      delay_seconds: delay,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  const jobItems = wcaIds.map((id: number, i: number) => ({
    job_id: job.id,
    wca_id: id,
    position: i,
    status: "pending",
  }));

  for (let i = 0; i < jobItems.length; i += 500) {
    await supabase
      .from("download_job_items")
      .insert(jobItems.slice(i, i + 500));
  }

  return {
    success: true,
    job_id: job.id,
    total: wcaIds.length,
    message: `Job creato: ${wcaIds.length} partner per ${cn}.`,
  };
}

export async function handleDownloadSinglePartner(
  supabase: AnySupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const partnerName = String(args.company_name || "").trim();
  if (!partnerName) {
    return { error: "Nome azienda obbligatorio" };
  }

  const { data: found } = await supabase
    .from("partners")
    .select("id, wca_id, company_name, country_code, country_name, raw_profile_html")
    .ilike("company_name", `%${escapeLike(partnerName)}%`)
    .limit(1);

  if (!found || found.length === 0) {
    return { error: `"${partnerName}" non trovata nel database.` };
  }

  const p = found[0];

  if (p.raw_profile_html) {
    return {
      success: true,
      already_downloaded: true,
      message: `"${p.company_name}" ha già il profilo.`,
    };
  }

  if (!p.wca_id) {
    return { error: `"${p.company_name}" non ha wca_id.` };
  }

  const { data: active } = await supabase
    .from("download_jobs")
    .select("id")
    .in("status", ["pending", "running"])
    .limit(1);

  if (active && active.length > 0) {
    return { error: "C'è già un job attivo." };
  }

  const { data: job, error } = await supabase
    .from("download_jobs")
    .insert({
      country_code: p.country_code,
      country_name: p.country_name,
      wca_ids: [p.wca_id] as unknown as Record<string, unknown>,
      total_count: 1,
      delay_seconds: 15,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await supabase
    .from("download_job_items")
    .insert({ job_id: job.id, wca_id: p.wca_id, position: 0, status: "pending" });

  return {
    success: true,
    job_id: job.id,
    message: `Download avviato per "${p.company_name}".`,
  };
}

export async function handleGetBlacklist(
  supabase: AnySupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const cc = String(args.country_code || "").toUpperCase();
  const { data, error } = await supabase
    .from("blacklist")
    .select("id, company_name, reason, added_at")
    .eq("user_id", userId)
    .eq("country_code", cc);

  if (error) {
    return { error: error.message };
  }

  return { count: data?.length || 0, items: data || [] };
}

export async function handleListReminders(
  supabase: AnySupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase
    .from("reminders")
    .select("id, title, partner_id, due_date, priority, status")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("due_date", { ascending: true })
    .limit(Math.min(Number(args.limit) || 20, 50));

  if (error) {
    return { error: error.message };
  }

  return { count: data?.length || 0, reminders: data || [] };
}

export async function handleGetPartnersWithoutContacts(
  supabase: AnySupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase
    .from("partners")
    .select("id, company_name, city, country_code, email")
    .is("partner_contacts", null)
    .limit(Math.min(Number(args.limit) || 20, 50));

  if (error) {
    return { error: error.message };
  }

  return { count: data?.length || 0, partners: data || [] };
}
