/**
 * tools/stats.ts — handler del dominio "directory / stats / dashboards"
 * per agent-execute.
 *
 * Estratto da `index.ts` in sessione #25 (Ondata 2, Fase 4 Vol. I — split
 * dei file monolitici). Contiene i case che leggono metriche, KPI,
 * dashboards operativi, blacklist, holding pattern dei contatti.
 *
 * Alcuni case (`get_operations_dashboard`, `get_system_analytics`)
 * richiedono `userId` per filtrare entità dell'utente corrente.
 *
 * Tool gestiti:
 *  - get_country_overview
 *  - get_directory_status
 *  - get_global_summary
 *  - check_blacklist
 *  - get_operations_dashboard
 *  - get_system_analytics
 *  - get_holding_pattern
 */
import { escapeLike } from "../../_shared/sqlEscape.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any;

export const STATS_TOOLS = new Set<string>([
  "get_country_overview",
  "get_directory_status",
  "get_global_summary",
  "check_blacklist",
  "get_operations_dashboard",
  "get_system_analytics",
  "get_holding_pattern",
]);

export async function executeStatsTool(
  name: string,
  args: Record<string, unknown>,
  supabase: SupabaseClient,
  userId: string,
): Promise<unknown> {
  switch (name) {
    case "get_country_overview": {
      const { data, error } = await supabase.rpc("get_country_stats");
      if (error) return { error: error.message };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let stats = (data || []) as any[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (args.country_code) stats = stats.filter((s: any) => s.country_code === String(args.country_code).toUpperCase());
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      stats.sort((a: any, b: any) => (b.total_partners || 0) - (a.total_partners || 0));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { total_countries: stats.length, countries: stats.slice(0, Number(args.limit) || 30).map((s: any) => ({ country_code: s.country_code, total_partners: s.total_partners, with_profile: s.with_profile, without_profile: s.without_profile, with_email: s.with_email, with_phone: s.with_phone })) };
    }

    case "get_directory_status": {
      const { data: dirData } = await supabase.rpc("get_directory_counts");
      const { data: statsData } = await supabase.rpc("get_country_stats");
      const dirMap: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (dirData || []) as any[]) dirMap[r.country_code] = Number(r.member_count);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statsMap: Record<string, any> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const r of (statsData || []) as any[]) statsMap[r.country_code] = r;
      if (args.country_code) {
        const code = String(args.country_code).toUpperCase();
        return { country_code: code, directory_members: dirMap[code] || 0, db_partners: statsMap[code]?.total_partners || 0, gap: (dirMap[code] || 0) - (statsMap[code]?.total_partners || 0) };
      }
      const allCodes = [...new Set([...Object.keys(dirMap), ...Object.keys(statsMap)])];
      const gaps = allCodes.map(c => ({ country_code: c, dir: dirMap[c] || 0, db: statsMap[c]?.total_partners || 0, gap: (dirMap[c] || 0) - (statsMap[c]?.total_partners || 0) })).filter(r => r.gap > 0).sort((a, b) => b.gap - a.gap);
      return { countries_with_gaps: gaps.length, gaps: gaps.slice(0, 30) };
    }

    case "get_global_summary": {
      const [statsRes, dirRes, jobsRes] = await Promise.all([
        supabase.rpc("get_country_stats"), supabase.rpc("get_directory_counts"),
        supabase.from("download_jobs").select("id, status").in("status", ["running", "pending"]),
      ]);
      const rows = statsRes.data || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totals = rows.reduce((acc: any, r: any) => ({ partners: acc.partners + (Number(r.total_partners) || 0), with_profile: acc.with_profile + (Number(r.with_profile) || 0), with_email: acc.with_email + (Number(r.with_email) || 0) }), { partners: 0, with_profile: 0, with_email: 0 });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dirTotal = (dirRes.data || []).reduce((s: number, r: any) => s + (Number(r.member_count) || 0), 0);
      return { total_countries: rows.length, total_partners: totals.partners, with_profile: totals.with_profile, with_email: totals.with_email, directory_members: dirTotal, active_jobs: jobsRes.data?.length || 0 };
    }

    case "check_blacklist": {
      let query = supabase.from("blacklist_entries").select("company_name, country, total_owed_amount, claims, status");
      if (args.company_name) query = query.ilike("company_name", `%${escapeLike(String(args.company_name))}%`);
      if (args.country) query = query.ilike("country", `%${escapeLike(String(args.country))}%`);
      const { data, error } = await query.limit(20);
      if (error) return { error: error.message };
      return { count: data?.length || 0, entries: data || [] };
    }

    case "get_operations_dashboard": {
      const [dlJobs, emailQ, agTasks, acts] = await Promise.all([
        supabase.from("download_jobs").select("id, country_name, status, current_index, total_count, contacts_found_count, error_message, created_at").order("created_at", { ascending: false }).limit(10),
        supabase.from("email_campaign_queue").select("id, status, scheduled_at, sent_at, recipient_email, subject").order("created_at", { ascending: false }).limit(20),
        supabase.from("agent_tasks").select("id, agent_id, description, status, task_type, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(15),
        supabase.from("activities").select("id, title, status, activity_type, scheduled_at, due_date").neq("status", "cancelled").order("created_at", { ascending: false }).limit(15),
      ]);

      const downloads = dlJobs.data || [];
      const emails = emailQ.data || [];
      const tasks = agTasks.data || [];
      const activities = acts.data || [];

      return {
        downloads: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          active: downloads.filter((j: any) => ["running", "pending"].includes(j.status)).length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          completed: downloads.filter((j: any) => j.status === "completed").length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          failed: downloads.filter((j: any) => j.status === "failed").length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          jobs: downloads.map((j: any) => ({ id: j.id, country: j.country_name, status: j.status, progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count })),
        },
        emails: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pending: emails.filter((e: any) => e.status === "pending").length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          sent: emails.filter((e: any) => e.status === "sent").length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          scheduled: emails.filter((e: any) => e.scheduled_at && e.status === "pending").length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          recent: emails.slice(0, 10).map((e: any) => ({ status: e.status, to: e.recipient_email, subject: e.subject, scheduled: e.scheduled_at })),
        },
        agent_tasks: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          running: tasks.filter((t: any) => ["pending", "running"].includes(t.status)).length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          completed: tasks.filter((t: any) => t.status === "completed").length,
          recent: tasks.slice(0, 8),
        },
        activities: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          pending: activities.filter((a: any) => a.status === "pending").length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          scheduled: activities.filter((a: any) => a.scheduled_at).length,
          recent: activities.slice(0, 8),
        },
      };
    }

    case "get_system_analytics": {
      const results: Record<string, unknown> = {};
      // Partners
      const { count: totalPartners } = await supabase.from("partners").select("id", { count: "exact", head: true });
      const { count: partnersWithEmail } = await supabase.from("partners").select("id", { count: "exact", head: true }).not("email", "is", null);
      const { count: partnersWithProfile } = await supabase.from("partners").select("id", { count: "exact", head: true }).not("raw_profile_html", "is", null);
      const { count: partnersConverted } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("lead_status", "converted");
      const { count: partnersContacted } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("lead_status", "contacted");
      results.partners = { total: totalPartners, with_email: partnersWithEmail, with_profile: partnersWithProfile, converted: partnersConverted, contacted: partnersContacted };
      // Contacts
      const { count: totalContacts } = await supabase.from("imported_contacts").select("id", { count: "exact", head: true });
      const { count: contactsWithEmail } = await supabase.from("imported_contacts").select("id", { count: "exact", head: true }).not("email", "is", null);
      results.contacts = { total: totalContacts, with_email: contactsWithEmail };
      // Prospects
      const { count: totalProspects } = await supabase.from("prospects").select("id", { count: "exact", head: true });
      results.prospects = { total: totalProspects };
      // Email queue
      const { count: emailsPending } = await supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending");
      const { count: emailsSent } = await supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "sent");
      results.email_campaigns = { pending: emailsPending, sent: emailsSent };
      // Agent tasks
      const { data: taskData } = await supabase.from("agent_tasks").select("status").eq("user_id", userId);
      const taskCounts: Record<string, number> = {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of (taskData || []) as any[]) { taskCounts[t.status] = (taskCounts[t.status] || 0) + 1; }
      results.agent_tasks = taskCounts;
      // Activities
      const { count: activitiesPending } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending");
      const { count: activitiesOverdue } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", new Date().toISOString().split("T")[0]);
      results.activities = { pending: activitiesPending, overdue: activitiesOverdue };
      // Work plans
      const { count: plansActive } = await supabase.from("ai_work_plans").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active");
      results.work_plans = { active: plansActive };
      return results;
    }

    case "get_holding_pattern": {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: any[] = [];
      const activeStatuses = ["contacted", "in_progress"];
      const now = new Date();
      // Partners (WCA)
      if (!args.source_type || args.source_type === "wca" || args.source_type === "all") {
        let pq = supabase.from("partners").select("id, company_name, country_code, city, email, lead_status, last_interaction_at, interaction_count")
          .in("lead_status", activeStatuses).order("last_interaction_at", { ascending: true, nullsFirst: true });
        if (args.country_code) pq = pq.eq("country_code", String(args.country_code).toUpperCase());
        const { data: partners } = await pq.limit(Number(args.limit) || 50);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (partners || []).forEach((p: any) => {
          const days = p.last_interaction_at ? Math.floor((now.getTime() - new Date(p.last_interaction_at).getTime()) / 86400000) : 999;
          if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
          if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
          items.push({ id: p.id, source: "wca", name: p.company_name, country: p.country_code, city: p.city, email: p.email, status: p.lead_status, days_waiting: days, interactions: p.interaction_count });
        });
      }
      // Contacts (CRM)
      if (!args.source_type || args.source_type === "crm" || args.source_type === "all") {
        const cq = supabase.from("imported_contacts").select("id, name, company_name, country, city, email, lead_status, last_interaction_at, interaction_count")
          .in("lead_status", activeStatuses).order("last_interaction_at", { ascending: true, nullsFirst: true });
        const { data: contacts } = await cq.limit(Number(args.limit) || 50);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (contacts || []).forEach((c: any) => {
          const days = c.last_interaction_at ? Math.floor((now.getTime() - new Date(c.last_interaction_at).getTime()) / 86400000) : 999;
          if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
          if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
          items.push({ id: c.id, source: "crm", name: c.company_name || c.name || "—", country: c.country, city: c.city, email: c.email, status: c.lead_status, days_waiting: days, interactions: c.interaction_count });
        });
      }
      items.sort((a, b) => b.days_waiting - a.days_waiting);
      return { count: items.length, items: items.slice(0, Number(args.limit) || 50) };
    }

    default:
      throw new Error(`executeStatsTool: tool non gestito "${name}"`);
  }
}
