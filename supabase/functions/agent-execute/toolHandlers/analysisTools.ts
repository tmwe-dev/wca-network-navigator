import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolvePartnerId, type ExecuteContext } from "../shared.ts";
import { evaluatePartner } from "../../_shared/decisionEngine.ts";
import { processAllDecisionActions, undoAction, getApprovalDashboard } from "../../_shared/approvalFlow.ts";

interface CountryStatRow { country_code: string; total_partners: number; with_profile: number; without_profile: number; with_email: number; with_phone: number; hq_count?: number; branch_count?: number; }
interface DownloadJobRow { id: string; country_name: string; status: string; current_index: number; total_count: number; contacts_found_count: number; contacts_missing_count: number; last_processed_company: string | null; error_message: string | null; created_at: string; }
interface EmailQueueRow { id: string; status: string; scheduled_at: string | null; sent_at: string | null; recipient_email: string; subject: string; }
interface AgentTaskRow { id: string; agent_id: string; description: string; status: string; task_type: string; created_at: string; result_summary: string | null; }

export async function handleGetCountryOverview(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const cc = String(args.country_code || "").toUpperCase();
  if (!cc) return { error: "country_code obbligatorio" };
  const { data, error } = await supabase.rpc("get_country_stats", { p_country_code: cc });
  if (error) return { error: error.message };
  const stats = data as CountryStatRow[] | null;
  if (!stats || stats.length === 0) return { error: `Nessun dato per ${cc}` };
  return stats[0];
}

export async function handleGetDirectoryStatus(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const result: Record<string, unknown> = {};
  const { count: memberCount } = await supabase.from("directory_members").select("id", { count: "exact", head: true });
  result.total_directory_members = memberCount;
  const { data: countryCounts } = await supabase.from("directory_members").select("country_code").order("country_code");
  const uniqueCountries = new Set((countryCounts || []).map((d: { country_code: string }) => d.country_code));
  result.countries_in_directory = uniqueCountries.size;
  const { count: importsRunning } = await supabase.from("download_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "running"]);
  result.active_imports = importsRunning;
  return result;
}

export async function handleGetGlobalSummary(
  supabase: SupabaseClient
): Promise<unknown> {
  const { count: totalPartners } = await supabase.from("partners").select("id", { count: "exact", head: true });
  const { count: withProfile } = await supabase.from("partners").select("id", { count: "exact", head: true }).not("raw_profile_html", "is", null);
  const { count: withEmail } = await supabase.from("partners").select("id", { count: "exact", head: true }).not("email", "is", null);
  return {
    total_partners: totalPartners,
    with_profile: withProfile,
    with_email: withEmail,
    coverage_profile_percent: totalPartners ? Math.round((withProfile! / totalPartners) * 100) : 0,
    coverage_email_percent: totalPartners ? Math.round((withEmail! / totalPartners) * 100) : 0,
  };
}

export async function handleListJobs(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data, error } = await supabase.from("download_jobs").select("id, country_name, status, current_index, total_count, contacts_found_count").in("status", ["pending", "running", "completed"]).order("created_at", { ascending: false }).limit(Math.min(Number(args.limit) || 10, 20));
  if (error) return { error: error.message };
  return { count: data?.length || 0, jobs: data || [] };
}

export async function handleCheckJobStatus(
  supabase: SupabaseClient,
  args: Record<string, unknown>
): Promise<unknown> {
  if (args.job_id) {
    const { data } = await supabase.from("download_jobs").select("id, status, current_index, total_count, contacts_found_count, last_processed_company, error_message").eq("id", args.job_id).single();
    return data || { error: "Job non trovato" };
  }
  const { data } = await supabase.from("download_jobs").select("id, country_name, status, current_index, total_count").in("status", ["running", "pending"]).limit(5);
  return { active_jobs: data || [] };
}

export async function handleGetOperationsDashboard(
  supabase: SupabaseClient,
  userId: string
): Promise<unknown> {
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
      active: downloads.filter((j: { status: string }) => ["running", "pending"].includes(j.status)).length,
      completed: downloads.filter((j: { status: string }) => j.status === "completed").length,
      failed: downloads.filter((j: { status: string }) => j.status === "failed").length,
      jobs: downloads.map((j: DownloadJobRow) => ({ id: j.id, country: j.country_name, status: j.status, progress: `${j.current_index}/${j.total_count}`, found: j.contacts_found_count })),
    },
    emails: {
      pending: emails.filter((e: { status: string; scheduled_at?: string | null }) => e.status === "pending").length,
      sent: emails.filter((e: { status: string }) => e.status === "sent").length,
      scheduled: emails.filter((e: { status: string; scheduled_at?: string | null }) => e.scheduled_at && e.status === "pending").length,
      recent: emails.slice(0, 10).map((e: EmailQueueRow) => ({ status: e.status, to: e.recipient_email, subject: e.subject, scheduled: e.scheduled_at })),
    },
    agent_tasks: {
      running: tasks.filter((t: { status: string }) => ["pending", "running"].includes(t.status)).length,
      completed: tasks.filter((t: { status: string }) => t.status === "completed").length,
      recent: tasks.slice(0, 8),
    },
    activities: {
      pending: activities.filter((a: { status: string; scheduled_at?: string | null }) => a.status === "pending").length,
      scheduled: activities.filter((a: { scheduled_at?: string | null }) => a.scheduled_at).length,
      recent: activities.slice(0, 8),
    },
  };
}

export async function handleGetSystemAnalytics(
  supabase: SupabaseClient,
  userId: string
): Promise<unknown> {
  const results: Record<string, unknown> = {};
  const { count: totalPartners } = await supabase.from("partners").select("id", { count: "exact", head: true });
  const { count: partnersWithEmail } = await supabase.from("partners").select("id", { count: "exact", head: true }).not("email", "is", null);
  const { count: partnersWithProfile } = await supabase.from("partners").select("id", { count: "exact", head: true }).not("raw_profile_html", "is", null);
  const { count: partnersConverted } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("lead_status", "converted");
  const { count: partnersContacted } = await supabase.from("partners").select("id", { count: "exact", head: true }).eq("lead_status", "first_touch_sent");
  results.partners = { total: totalPartners, with_email: partnersWithEmail, with_profile: partnersWithProfile, converted: partnersConverted, contacted: partnersContacted };

  const { count: totalContacts } = await supabase.from("imported_contacts").select("id", { count: "exact", head: true });
  const { count: contactsWithEmail } = await supabase.from("imported_contacts").select("id", { count: "exact", head: true }).not("email", "is", null);
  results.contacts = { total: totalContacts, with_email: contactsWithEmail };

  const { count: totalProspects } = await supabase.from("prospects").select("id", { count: "exact", head: true });
  results.prospects = { total: totalProspects };

  const { count: emailsPending } = await supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "pending");
  const { count: emailsSent } = await supabase.from("email_campaign_queue").select("id", { count: "exact", head: true }).eq("status", "sent");
  results.email_campaigns = { pending: emailsPending, sent: emailsSent };

  const { data: taskData } = await supabase.from("agent_tasks").select("status").eq("user_id", userId);
  const taskCounts: Record<string, number> = {};
  for (const t of (taskData || []) as Array<{ status: string }>) { taskCounts[t.status] = (taskCounts[t.status] || 0) + 1; }
  results.agent_tasks = taskCounts;

  const { count: activitiesPending } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending");
  const { count: activitiesOverdue } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "pending").lt("due_date", new Date().toISOString().split("T")[0]);
  results.activities = { pending: activitiesPending, overdue: activitiesOverdue };

  const { count: plansActive } = await supabase.from("ai_work_plans").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "active");
  results.work_plans = { active: plansActive };

  return results;
}

export async function handleAnalyzeIncomingEmail(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>,
  context?: ExecuteContext
): Promise<unknown> {
  const { data: msg } = await supabase.from("channel_messages").select("from_address, to_address, subject, body_text, email_date, partner_id").eq("id", args.message_id).eq("user_id", userId).single();
  if (!msg) return { error: "Messaggio non trovato" };

  let exclusiveAgentName: string | null = null;
  if (msg.from_address) {
    const fromAddr = msg.from_address.toLowerCase().trim();
    const { data: rule } = await supabase.from("email_address_rules").select("id, exclusive_agent_id").eq("email_address", fromAddr).eq("user_id", userId).maybeSingle();
    if (rule && !rule.exclusive_agent_id) {
      const executingAgentId = context?.agent_id;
      if (executingAgentId) {
        await supabase.from("email_address_rules").update({ exclusive_agent_id: executingAgentId }).eq("id", rule.id);
        const { data: ag } = await supabase.from("agents").select("name").eq("id", executingAgentId).single();
        exclusiveAgentName = ag?.name || null;
      }
    } else if (!rule) {
      const executingAgentId = context?.agent_id;
      if (executingAgentId) {
        await supabase.from("email_address_rules").insert({ email_address: fromAddr, user_id: userId, exclusive_agent_id: executingAgentId, category: "auto" });
        const { data: ag } = await supabase.from("agents").select("name").eq("id", executingAgentId).single();
        exclusiveAgentName = ag?.name || null;
      }
    } else if (rule?.exclusive_agent_id) {
      const { data: ag } = await supabase.from("agents").select("name").eq("id", rule.exclusive_agent_id).single();
      exclusiveAgentName = ag?.name || null;
    }
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const analysisRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: "Analizza questa email e rispondi SOLO con un JSON valido: {\"sentiment\": \"positive|neutral|negative\", \"intent\": \"interest|info_request|refusal|ooo|auto_reply|spam|other\", \"suggested_action\": \"follow_up|escalation|close|schedule_call|respond_info|ignore\", \"urgency\": 1-5, \"summary\": \"breve riassunto in italiano\"}" },
        { role: "user", content: `Da: ${msg.from_address}\nOggetto: ${msg.subject}\n\n${msg.body_text?.substring(0, 2000) || "(vuoto)"}` },
      ],
      max_tokens: 500,
    }),
  });

  if (!analysisRes.ok) return { error: "Errore analisi AI" };
  const analysisData = await analysisRes.json();
  const analysisText = analysisData.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(analysisText.replace(/```json\n?|\n?```/g, "").trim());
    return { success: true, message_id: args.message_id, from: msg.from_address, subject: msg.subject, date: msg.email_date, partner_id: msg.partner_id, exclusive_agent: exclusiveAgentName, analysis: parsed };
  } catch {
    return { success: true, message_id: args.message_id, from: msg.from_address, subject: msg.subject, exclusive_agent: exclusiveAgentName, analysis: { raw: analysisText } };
  }
}

export async function handleEvaluatePartner(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const partnerId = await resolvePartnerId(args, userId);
  if (!partnerId) return { error: "Partner non trovato" };
  const { state, actions } = await evaluatePartner(supabase, partnerId, userId);
  return {
    partner_id: partnerId,
    lead_status: state.leadStatus,
    touch_count: state.touchCount,
    days_since_last_outbound: state.daysSinceLastOutbound,
    days_since_last_inbound: state.daysSinceLastInbound,
    enrichment_score: state.enrichmentScore,
    has_active_reminder: state.hasActiveReminder,
    recommended_actions: actions.map((a) => ({
      action: a.action,
      autonomy: a.autonomy,
      channel: a.channel,
      due_in_days: a.due_in_days,
      journalist_role: a.journalist_role,
      priority: a.priority,
      reasoning: a.reasoning,
    })),
  };
}

export async function handleExecuteDecision(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const partnerId = await resolvePartnerId(args, userId);
  if (!partnerId) return { error: "Partner non trovato" };
  const autonomyOverride = args.autonomy as string | undefined;
  const { state, actions } = await evaluatePartner(
    supabase,
    partnerId,
    userId,
    autonomyOverride as import("../../_shared/decisionEngine.ts").AutonomyLevel | undefined
  );
  const results = await processAllDecisionActions(supabase, userId, partnerId, actions);
  return {
    partner_id: partnerId,
    lead_status: state.leadStatus,
    actions_processed: results.length,
    results: results.map((r) => ({
      status: r.status,
      action_id: r.action_id,
      message: r.message,
      undo_until: r.undo_until,
    })),
  };
}

export async function handleUndoAiAction(
  supabase: SupabaseClient,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const actionId = String(args.action_id);
  const result = await undoAction(supabase, actionId, userId);
  return result;
}

export async function handleGetApprovalDashboard(
  supabase: SupabaseClient,
  userId: string
): Promise<unknown> {
  const dashboard = await getApprovalDashboard(supabase, userId);
  return dashboard;
}
