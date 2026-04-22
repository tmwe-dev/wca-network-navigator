/**
 * systemHandler.ts - System-related tool handlers
 * Handles: global summary, blacklist, operations dashboard
 */

import { supabase, escapeLike } from "./supabaseClient.ts";

interface CountryStatRow {
  total_partners: number;
  with_profile: number;
  with_email: number;
}

interface DirectoryCountRow {
  member_count: number;
}

interface DownloadJobRow {
  id: string;
  country_name: string;
  status: string;
  current_index: number;
  total_count: number;
  contacts_found_count: number;
  error_message: string | null;
  created_at: string;
}

interface EmailQueueRow {
  id: string;
  status: string;
  scheduled_at: string;
  sent_at: string | null;
  recipient_email: string;
  subject: string;
}

interface AgentTaskRow {
  id: string;
  agent_id: string;
  description: string;
  status: string;
  task_type: string;
  created_at: string;
}

interface ActivityRow {
  id: string;
  title: string;
  status: string;
  activity_type: string;
  scheduled_at: string | null;
  due_date: string | null;
}

export async function handleGetGlobalSummary(): Promise<unknown> {
  const [statsRes, dirRes, jobsRes] = await Promise.all([
    supabase.rpc("get_country_stats"),
    supabase.rpc("get_directory_counts"),
    supabase.from("download_jobs").select("id, status").in("status", ["running", "pending"]),
  ]);
  const rows = (statsRes.data || []) as CountryStatRow[];
  const totals = rows.reduce(
    (
      acc: { partners: number; with_profile: number; with_email: number },
      r: CountryStatRow
    ) => ({
      partners: acc.partners + (Number(r.total_partners) || 0),
      with_profile: acc.with_profile + (Number(r.with_profile) || 0),
      with_email: acc.with_email + (Number(r.with_email) || 0),
    }),
    { partners: 0, with_profile: 0, with_email: 0 }
  );
  const dirTotal = ((dirRes.data || []) as DirectoryCountRow[]).reduce(
    (s: number, r: DirectoryCountRow) => s + (Number(r.member_count) || 0),
    0
  );
  return {
    total_countries: rows.length,
    total_partners: totals.partners,
    with_profile: totals.with_profile,
    with_email: totals.with_email,
    directory_members: dirTotal,
    active_jobs: jobsRes.data?.length || 0,
  };
}

export async function handleCheckBlacklist(
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("blacklist_entries")
    .select("company_name, country, total_owed_amount, claims, status");
  if (args.company_name)
    query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
  if (args.country)
    query = query.ilike("country", `%${escapeLike(String(args.country))}%`);
  const { data, error } = await query.limit(20);
  if (error) return { error: error.message };
  return { count: data?.length || 0, entries: data || [] };
}

export async function handleGetOperationsDashboard(
  userId: string
): Promise<unknown> {
  const [dlJobs, emailQ, agTasks, acts] = await Promise.all([
    supabase
      .from("download_jobs")
      .select(
        "id, country_name, status, current_index, total_count, contacts_found_count, error_message, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("email_campaign_queue")
      .select("id, status, scheduled_at, sent_at, recipient_email, subject")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_tasks")
      .select("id, agent_id, description, status, task_type, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("activities")
      .select("id, title, status, activity_type, scheduled_at, due_date")
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);
  return {
    downloads: {
      active: (dlJobs.data || []).filter((j: DownloadJobRow) =>
        ["running", "pending"].includes(j.status)
      ).length,
      jobs: (dlJobs.data || []).map((j: DownloadJobRow) => ({
        id: j.id,
        country: j.country_name,
        status: j.status,
        progress: `${j.current_index}/${j.total_count}`,
      })),
    },
    emails: {
      pending: (emailQ.data || []).filter((e: EmailQueueRow) => e.status === "pending").length,
      sent: (emailQ.data || []).filter((e: EmailQueueRow) => e.status === "sent").length,
    },
    agent_tasks: {
      running: (agTasks.data || []).filter((t: AgentTaskRow) =>
        ["pending", "running"].includes(t.status)
      ).length,
      recent: (agTasks.data || []).slice(0, 8),
    },
    activities: {
      pending: (acts.data || []).filter((a: ActivityRow) => a.status === "pending").length,
      recent: (acts.data || []).slice(0, 8),
    },
  };
}
