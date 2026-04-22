import { supabase, escapeLike, resolvePartnerId, type ExecuteContext } from "./shared.ts";

// ── Centralized imports from modular tool handlers ──
import {
  handleSendEmail,
  handleSendWhatsApp,
  handleSendLinkedIn,
  handleQueueOutreach,
  handleScheduleEmail,
  handleGenerateOutreach,
} from "./toolHandlers/emailTools.ts";

import {
  handleSearchPartners,
  handleGetPartnerDetail,
  handleSearchContacts,
  handleGetContactDetail,
  handleSearchProspects,
  handleSearchMemory,
  handleSearchBusinessCards,
  handleDeepSearchPartner,
  handleDeepSearchContact,
} from "./toolHandlers/searchTools.ts";

import {
  handleUpdatePartner,
  handleAddPartnerNote,
  handleCreateReminder,
  handleCreateActivity,
  handleUpdateActivity,
  handleListActivities,
  handleManagePartnerContact,
  handleUpdateReminder,
  handleUpdateLeadStatus,
  handleBulkUpdatePartners,
  handleDeleteRecords,
  handleGetEmailClassifications,
  handleAssignContactsToAgent,
} from "./toolHandlers/crmTools.ts";

import {
  handleGetCountryOverview,
  handleGetDirectoryStatus,
  handleGetGlobalSummary,
  handleListJobs,
  handleCheckJobStatus,
  handleGetOperationsDashboard,
  handleGetSystemAnalytics,
  handleAnalyzeIncomingEmail,
  handleEvaluatePartner,
  handleExecuteDecision,
  handleUndoAiAction,
  handleGetApprovalDashboard,
} from "./toolHandlers/analysisTools.ts";

// ── Local interfaces for typed row shapes ──
interface KbEntry { title: string; content: string; added_at: string; }
interface WorkPlanStep { index?: number; title?: string; description?: string; status?: string; tool?: string; args?: Record<string, unknown>; }
interface AgentRow { id: string; name: string; role: string; is_active: boolean; stats: Record<string, unknown>; avatar_emoji: string; updated_at: string; system_prompt: string; knowledge_base: unknown; }
interface ChannelMessageRow { id: string; channel: string; direction: string; from_address: string | null; to_address: string | null; subject: string | null; body_text: string | null; email_date: string | null; read_at: string | null; partner_id: string | null; category: string | null; created_at: string; thread_id?: string | null; in_reply_to?: string | null; }
interface HoldingItem { id: string; source: string; name: string; country: string; city?: string; email: string | null; status: string; days_waiting: number; interactions?: number; }
interface AbTestVariant { agent_name: string; tone: string; percentage: number; }
interface AbTestConfig { enabled?: boolean; variants?: AbTestVariant[]; }

// ═══ SHARED APPROVAL GUARD ═══
const SIDE_EFFECT_TOOLS = new Set<string>([
  "send_email",
  "send_whatsapp",
  "send_linkedin",
  "queue_channel_message",
  "update_partner",
  "create_task",
  "schedule_followup",
  "execute_decision",
]);

async function isApprovalRequired(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("user_id", userId)
    .eq("key", "agent_require_approval")
    .maybeSingle();
  return data?.value === "true" || (data?.value as unknown) === true;
}

export async function executeTool(name: string, args: Record<string, unknown>, userId: string, authHeader: string, context?: ExecuteContext): Promise<unknown> {
  // ── Centralized approval gate for side-effect tools ──
  if (SIDE_EFFECT_TOOLS.has(name)) {
    const requiresApproval = await isApprovalRequired(userId);
    if (requiresApproval) {
      const partnerId = (args.partner_id ?? args.partnerId) as string | undefined;
      const recipient = (args.to_email ?? args.to ?? args.email ?? args.recipient) as string | undefined;
      const { error: queueError } = await supabase.from("ai_pending_actions").insert({
        user_id: userId,
        partner_id: partnerId ? String(partnerId) : null,
        email_address: recipient ? String(recipient) : null,
        action_type: name,
        action_payload: args,
        reasoning: `Agent tool "${name}" intercepted by approval guard (agent_require_approval=true).`,
        confidence: 0.9,
        source: "agent_autonomous",
        status: "pending",
      });
      if (queueError) {
        console.error(`[approval-guard] Failed to queue ${name}:`, queueError);
        return { error: `Impossibile accodare azione "${name}" per approvazione` };
      }
      return {
        success: true,
        queued: true,
        requires_approval: true,
        action_type: name,
        message: `Azione "${name}" accodata per approvazione umana. Non eseguita.`,
      };
    }
  }

  // ═══ ROUTER ═══
  // Dispatches to modular handlers by tool category

  // ── EMAIL TOOLS ──
  switch (name) {
    case "send_email":
      return handleSendEmail(supabase, args, userId, authHeader, context);
    case "send_whatsapp":
      return handleSendWhatsApp(supabase, args, userId, context);
    case "send_linkedin_message":
    case "send_linkedin":
      return handleSendLinkedIn(supabase, args, userId, context);
    case "generate_outreach":
      return handleGenerateOutreach(authHeader, args);
    case "queue_outreach":
      return handleQueueOutreach(supabase, args, userId);
    case "schedule_email":
      return handleScheduleEmail(supabase, args, userId);

    // ── SEARCH TOOLS ──
    case "search_partners":
      return handleSearchPartners(supabase, args);
    case "get_partner_detail":
      return handleGetPartnerDetail(supabase, args);
    case "search_contacts":
      return handleSearchContacts(supabase, args);
    case "get_contact_detail":
      return handleGetContactDetail(supabase, args);
    case "search_prospects":
      return handleSearchProspects(supabase, args);
    case "search_memory":
      return handleSearchMemory(supabase, userId, args);
    case "search_business_cards":
      return handleSearchBusinessCards(supabase, args);
    case "deep_search_partner":
      return handleDeepSearchPartner(supabase, userId, args, authHeader);
    case "deep_search_contact":
      return handleDeepSearchContact(supabase, args);

    // ── CRM TOOLS ──
    case "update_partner":
      return handleUpdatePartner(supabase, args);
    case "add_partner_note":
      return handleAddPartnerNote(supabase, args);
    case "create_reminder":
      return handleCreateReminder(supabase, userId, args);
    case "create_activity":
      return handleCreateActivity(supabase, userId, args);
    case "update_activity":
      return handleUpdateActivity(supabase, args);
    case "list_activities":
      return handleListActivities(supabase, args);
    case "manage_partner_contact":
      return handleManagePartnerContact(supabase, args);
    case "update_reminder":
      return handleUpdateReminder(supabase, args);
    case "update_lead_status":
      return handleUpdateLeadStatus(supabase, args);
    case "bulk_update_partners":
      return handleBulkUpdatePartners(supabase, args);
    case "delete_records":
      return handleDeleteRecords(supabase, userId, args);
    case "get_email_classifications":
      return handleGetEmailClassifications(supabase, userId, args);
    case "assign_contacts_to_agent":
      return handleAssignContactsToAgent(supabase, userId, args);

    // ── ANALYSIS TOOLS ──
    case "get_country_overview":
      return handleGetCountryOverview(supabase, args);
    case "get_directory_status":
      return handleGetDirectoryStatus(supabase, args);
    case "get_global_summary":
      return handleGetGlobalSummary(supabase);
    case "list_jobs":
      return handleListJobs(supabase, args);
    case "check_job_status":
      return handleCheckJobStatus(supabase, args);
    case "get_operations_dashboard":
      return handleGetOperationsDashboard(supabase, userId);
    case "get_system_analytics":
      return handleGetSystemAnalytics(supabase, userId);
    case "analyze_incoming_email":
      return handleAnalyzeIncomingEmail(supabase, userId, args, context);
    case "evaluate_partner":
      return handleEvaluatePartner(supabase, userId, args);
    case "execute_decision":
      return handleExecuteDecision(supabase, userId, args);
    case "undo_ai_action":
      return handleUndoAiAction(supabase, userId, args);
    case "get_approval_dashboard":
      return handleGetApprovalDashboard(supabase, userId);

    // ── REMAINING TOOLS (not yet refactored into modules) ──

    case "create_download_job": {
      const cc = String(args.country_code || "").toUpperCase();
      const cn = String(args.country_name || "");
      const mode = String(args.mode || "no_profile");
      const delay = Math.max(15, Number(args.delay_seconds) || 15);
      if (!cc || !cn) return { error: "country_code e country_name obbligatori" };
      const { data: active } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
      if (active && active.length > 0) return { error: "C'è già un job attivo." };
      let wcaIds: number[] = [];
      if (mode === "no_profile") {
        const { data } = await supabase.from("partners").select("wca_id").eq("country_code", cc).not("wca_id", "is", null).is("raw_profile_html", null);
        wcaIds = (data || []).map((p: { wca_id: number | null }) => p.wca_id).filter(Boolean);
      } else {
        const { data } = await supabase.from("partners").select("wca_id").eq("country_code", cc).not("wca_id", "is", null);
        wcaIds = (data || []).map((p: { wca_id: number | null }) => p.wca_id).filter(Boolean);
      }
      if (wcaIds.length === 0) return { error: `Nessun partner da scaricare per ${cn}.` };
      const { data: job, error } = await supabase.from("download_jobs").insert({ country_code: cc, country_name: cn, wca_ids: wcaIds as unknown as Record<string, unknown>, total_count: wcaIds.length, delay_seconds: delay, status: "pending" }).select("id").single();
      if (error) return { error: error.message };
      const jobItems = wcaIds.map((id: number, i: number) => ({ job_id: job.id, wca_id: id, position: i, status: "pending" }));
      for (let i = 0; i < jobItems.length; i += 500) { await supabase.from("download_job_items").insert(jobItems.slice(i, i + 500)); }
      return { success: true, job_id: job.id, total: wcaIds.length, message: `Job creato: ${wcaIds.length} partner per ${cn}.` };
    }

    case "download_single_partner": {
      const partnerName = String(args.company_name || "").trim();
      if (!partnerName) return { error: "Nome azienda obbligatorio" };
      const { data: found } = await supabase.from("partners").select("id, wca_id, company_name, country_code, country_name, raw_profile_html").ilike("company_name", `%${escapeLike(partnerName)}%`).limit(1);
      if (!found || found.length === 0) return { error: `"${partnerName}" non trovata nel database.` };
      const p = found[0];
      if (p.raw_profile_html) return { success: true, already_downloaded: true, message: `"${p.company_name}" ha già il profilo.` };
      if (!p.wca_id) return { error: `"${p.company_name}" non ha wca_id.` };
      const { data: active } = await supabase.from("download_jobs").select("id").in("status", ["pending", "running"]).limit(1);
      if (active && active.length > 0) return { error: "C'è già un job attivo." };
      const { data: job, error } = await supabase.from("download_jobs").insert({ country_code: p.country_code, country_name: p.country_name, wca_ids: [p.wca_id] as unknown as Record<string, unknown>, total_count: 1, delay_seconds: 15, status: "pending" }).select("id").single();
      if (error) return { error: error.message };
      await supabase.from("download_job_items").insert({ job_id: job.id, wca_id: p.wca_id, position: 0, status: "pending" });
      return { success: true, job_id: job.id, message: `Download avviato per "${p.company_name}".` };
    }

    case "save_memory": {
      const { data, error } = await supabase.from("ai_memory").insert({ user_id: userId, content: String(args.content), memory_type: String(args.memory_type || "fact"), tags: (args.tags as string[]) || [], importance: Math.min(5, Math.max(1, Number(args.importance) || 3)) }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, memory_id: data.id };
    }

    case "get_blacklist": {
      const cc = String(args.country_code || "").toUpperCase();
      const { data, error } = await supabase.from("blacklist").select("id, company_name, reason, added_at").eq("user_id", userId).eq("country_code", cc);
      if (error) return { error: error.message };
      return { count: data?.length || 0, items: data || [] };
    }

    case "list_reminders": {
      const { data, error } = await supabase.from("reminders").select("id, title, partner_id, due_date, priority, status").eq("user_id", userId).eq("status", "active").order("due_date", { ascending: true }).limit(Math.min(Number(args.limit) || 20, 50));
      if (error) return { error: error.message };
      return { count: data?.length || 0, reminders: data || [] };
    }

    case "get_partners_without_contacts": {
      const { data, error } = await supabase.from("partners").select("id, company_name, city, country_code, email").is("partner_contacts", null).limit(Math.min(Number(args.limit) || 20, 50));
      if (error) return { error: error.message };
      return { count: data?.length || 0, partners: data || [] };
    }

    case "get_inbox":
      return handleGetInbox(supabase, userId, args);

    case "get_conversation_history":
      return handleGetConversationHistory(supabase, userId, args);

    case "get_holding_pattern":
      return handleGetHoldingPattern(supabase, userId, args);

    case "update_message_status": {
      const { error } = await supabase.from("channel_messages").update({ read_at: new Date().toISOString() }).eq("id", args.message_id).eq("user_id", userId);
      return error ? { error: error.message } : { success: true, message: "Messaggio marcato come letto." };
    }

    case "get_email_thread":
      return handleGetEmailThread(supabase, userId, args);

    case "create_agent_task": {
      let agentQuery = supabase.from("agents").select("id, name").eq("user_id", userId);
      if (args.agent_name) agentQuery = agentQuery.ilike("name", `%${escapeLike(args.agent_name as string)}%`);
      else if (args.agent_role) agentQuery = agentQuery.eq("role", args.agent_role);
      const { data: agents } = await agentQuery.limit(1);
      if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name || args.agent_role}" non trovato.` };
      const targetAgent = agents[0];
      const { data, error } = await supabase.from("agent_tasks").insert({
        agent_id: targetAgent.id, user_id: userId,
        task_type: String(args.task_type || "research"),
        description: String(args.description),
        target_filters: (args.target_filters || {}) as Record<string, unknown>,
      }).select("id").single();
      if (error) return { error: error.message };
      return { success: true, task_id: data.id, agent_name: targetAgent.name, message: `Task creato per ${targetAgent.name}: "${args.description}"` };
    }

    case "list_agent_tasks": {
      let query = supabase.from("agent_tasks").select("id, agent_id, task_type, description, status, result_summary, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(Number(args.limit) || 30);
      if (args.status) query = query.eq("status", args.status);
      const { data: tasks, error } = await query;
      if (error) return { error: error.message };
      const agentIds = [...new Set((tasks || []).map((t: any) => t.agent_id))];
      const { data: agentsData } = await supabase.from("agents").select("id, name").in("id", agentIds);
      const nameMap: Record<string, string> = {};
      for (const a of (agentsData || []) as Array<{ id: string; name: string }>) nameMap[a.id] = a.name;
      let results = (tasks || []).map((t: any) => ({ ...t, agent_name: nameMap[t.agent_id] || "?" }));
      if (args.agent_name) results = results.filter((t: any) => (t.agent_name as string).toLowerCase().includes(String(args.agent_name).toLowerCase()));
      return { count: results.length, tasks: results };
    }

    case "get_team_status": {
      const { data: agents } = await supabase.from("agents").select("id, name, role, is_active, stats, avatar_emoji, updated_at").eq("user_id", userId).order("name");
      if (!agents) return { error: "Nessun agente trovato" };
      const agentIds = agents.map((a: any) => a.id);
      const { data: tasks } = await supabase.from("agent_tasks").select("agent_id, status").in("agent_id", agentIds);
      const taskStats: Record<string, { pending: number; running: number; completed: number; failed: number }> = {};
      for (const t of (tasks || []) as Array<{ agent_id: string; status: string }>) {
        if (!taskStats[t.agent_id]) taskStats[t.agent_id] = { pending: 0, running: 0, completed: 0, failed: 0 };
        if (taskStats[t.agent_id][t.status as keyof typeof taskStats[string]] !== undefined) taskStats[t.agent_id][t.status as keyof typeof taskStats[string]]++;
      }
      return {
        team_size: agents.length,
        active_agents: agents.filter((a: any) => a.is_active).length,
        agents: agents.map((a: AgentRow) => ({
          name: a.name, role: a.role, emoji: a.avatar_emoji, is_active: a.is_active,
          stats: a.stats, tasks: taskStats[a.id] || { pending: 0, running: 0, completed: 0, failed: 0 },
          last_activity: a.updated_at,
        })),
      };
    }

    case "update_agent_prompt": {
      const { data: agents } = await supabase.from("agents").select("id, name, system_prompt").eq("user_id", userId).ilike("name", `%${escapeLike(args.agent_name as string)}%`).limit(1);
      if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name}" non trovato.` };
      const agent = agents[0];
      let newPrompt = agent.system_prompt;
      if (args.replace_prompt) newPrompt = String(args.replace_prompt);
      else if (args.prompt_addition) newPrompt += "\n\n" + String(args.prompt_addition);
      const { error } = await supabase.from("agents").update({ system_prompt: newPrompt, updated_at: new Date().toISOString() }).eq("id", agent.id);
      if (error) return { error: error.message };
      return { success: true, agent_name: agent.name, prompt_length: newPrompt.length, message: `Prompt di ${agent.name} aggiornato.` };
    }

    case "add_agent_kb_entry": {
      const { data: agents } = await supabase.from("agents").select("id, name, knowledge_base").eq("user_id", userId).ilike("name", `%${escapeLike(args.agent_name as string)}%`).limit(1);
      if (!agents || agents.length === 0) return { error: `Agente "${args.agent_name}" non trovato.` };
      const agent = agents[0];
      const kb = (agent.knowledge_base as KbEntry[]) || [];
      kb.push({ title: String(args.title), content: String(args.content), added_at: new Date().toISOString() });
      const { error } = await supabase.from("agents").update({ knowledge_base: kb as unknown as Record<string, unknown>, updated_at: new Date().toISOString() }).eq("id", agent.id);
      if (error) return { error: error.message };
      return { success: true, agent_name: agent.name, kb_entries: kb.length, message: `KB entry "${args.title}" aggiunta a ${agent.name}.` };
    }

    case "create_work_plan": {
      const steps = (args.steps as WorkPlanStep[] || []).map((s: WorkPlanStep, i: number) => ({
        index: i, title: s.title || `Step ${i + 1}`, description: s.description || "", status: "pending",
      }));
      const { data, error } = await supabase.from("ai_work_plans").insert({
        user_id: userId, title: String(args.title),
        description: String(args.description || ""),
        steps: steps as unknown as Record<string, unknown>, status: "active",
        tags: (args.tags || []) as string[],
        metadata: { created_by: "luca_director", created_at: new Date().toISOString() } as Record<string, unknown>,
      }).select("id, title").single();
      if (error) return { error: error.message };
      return { success: true, plan_id: data.id, title: data.title, total_steps: steps.length, message: `Piano "${data.title}" creato con ${steps.length} step.` };
    }

    case "list_work_plans": {
      let query = supabase.from("ai_work_plans").select("id, title, description, status, current_step, steps, tags, created_at, completed_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(Number(args.limit) || 20);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      const plans = (data || []).map((p: any) => ({
        ...p, total_steps: Array.isArray(p.steps) ? p.steps.length : 0,
        completed_steps: Array.isArray(p.steps) ? p.steps.filter((s: WorkPlanStep) => s.status === "completed").length : 0,
      }));
      if (args.tag) return { count: plans.filter((p: any) => (p.tags as string[])?.includes(args.tag)).length, plans: plans.filter((p: any) => (p.tags as string[])?.includes(args.tag)) };
      return { count: plans.length, plans };
    }

    case "update_work_plan": {
      const { data: plan, error: fetchErr } = await supabase.from("ai_work_plans").select("*").eq("id", args.plan_id).eq("user_id", userId).single();
      if (fetchErr || !plan) return { error: "Piano non trovato" };
      const updates: Record<string, unknown> = {};
      if (args.status) updates.status = args.status;
      if (args.advance_step) {
        const steps = (plan.steps as WorkPlanStep[]) || [];
        if (plan.current_step < steps.length) {
          steps[plan.current_step].status = "completed";
          updates.steps = steps;
          updates.current_step = plan.current_step + 1;
          if (plan.current_step + 1 >= steps.length) { updates.status = "completed"; updates.completed_at = new Date().toISOString(); }
        }
      }
      if (args.metadata_note) {
        const meta = (plan.metadata as Record<string, unknown>) || {};
        const notes = (meta.notes as string[]) || [];
        notes.push(`[${new Date().toISOString()}] ${args.metadata_note}`);
        meta.notes = notes;
        updates.metadata = meta;
      }
      const { error } = await supabase.from("ai_work_plans").update(updates).eq("id", args.plan_id);
      if (error) return { error: error.message };
      return { success: true, message: `Piano aggiornato.`, updates: Object.keys(updates) };
    }

    case "manage_workspace_preset": {
      const action = String(args.action);
      if (action === "list") {
        const { data, error } = await supabase.from("workspace_presets").select("id, name, goal, base_proposal, created_at").eq("user_id", userId).order("created_at", { ascending: false });
        return error ? { error: error.message } : { count: data?.length || 0, presets: data || [] };
      }
      if (action === "create") {
        const { data, error } = await supabase.from("workspace_presets").insert({
          user_id: userId, name: String(args.name || "Nuovo preset"),
          goal: String(args.goal || ""), base_proposal: String(args.base_proposal || ""),
        }).select("id, name").single();
        return error ? { error: error.message } : { success: true, preset_id: data.id, message: `Preset "${data.name}" creato.` };
      }
      if (action === "update" && args.preset_id) {
        const updates: Record<string, unknown> = {};
        if (args.name) updates.name = args.name;
        if (args.goal) updates.goal = args.goal;
        if (args.base_proposal) updates.base_proposal = args.base_proposal;
        const { error } = await supabase.from("workspace_presets").update(updates).eq("id", args.preset_id).eq("user_id", userId);
        return error ? { error: error.message } : { success: true, message: "Preset aggiornato." };
      }
      if (action === "delete" && args.preset_id) {
        const { error } = await supabase.from("workspace_presets").delete().eq("id", args.preset_id).eq("user_id", userId);
        return error ? { error: error.message } : { success: true, message: "Preset eliminato." };
      }
      return { error: "Azione non valida. Usa: create, list, update, delete." };
    }

    case "enrich_partner_website": {
      let pid = args.partner_id as string;
      if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
      if (!pid) return { error: "Partner non trovato" };
      console.warn("[LEGACY] agent-execute → enrich_partner_website: preferire Deep Search client-side.");
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-partner-website`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({ partner_id: pid }),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "scan_directory": {
      return { error: "Funzione scrape-wca-directory rimossa. Il download directory è ora gestito dal sistema esterno wca-app." };
    }

    case "generate_aliases": {
      const body: Record<string, unknown> = { type: args.type || "company", limit: Number(args.limit) || 20 };
      if (args.partner_ids) body.partner_ids = args.partner_ids;
      if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-aliases`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "execute_ui_action": {
      const action = String(args.action || "toast");
      const target = String(args.target || "");
      const params = (args.params || {}) as Record<string, unknown>;
      return {
        success: true,
        ui_action: { action, target, params },
        message: action === "navigate" ? `Navigazione a ${target}` :
                 action === "toast" ? `Notifica: ${target}` :
                 `Filtro applicato: ${target}`,
      };
    }

    case "get_conversation_context": {
      const { data, error } = await supabase.from("contact_conversation_context").select("*").eq("email_address", String(args.email_address)).eq("user_id", userId).maybeSingle();
      if (error) return { error: error.message };
      if (!data) return { message: "No conversation context found." };
      return data;
    }

    case "get_address_rules": {
      let q = supabase.from("email_address_rules").select("*").eq("user_id", userId).order("interaction_count", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
      if (args.email_address) q = q.eq("email_address", args.email_address);
      if (args.is_active !== undefined) q = q.eq("is_active", !!args.is_active);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length, rules: data };
    }

    case "suggest_next_contacts": {
      const url = Deno.env.get("SUPABASE_URL")!;
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const res = await fetch(`${url}/functions/v1/ai-arena-suggest`, {
        method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ focus: args.focus || "tutti", preferred_channel: args.channel || "email", batch_size: Math.min(Number(args.batch_size) || 5, 10), excluded_ids: [] }),
      });
      if (!res.ok) return { error: await res.text() };
      return await res.json();
    }

    case "detect_language": {
      const map: Record<string, string> = { IT: "Italiano", DE: "Deutsch", FR: "Français", ES: "Español", PT: "Português", NL: "Nederlands", PL: "Polski", US: "English", GB: "English", BR: "Português", RU: "Русский", TR: "Türkçe", CN: "中文", JP: "日本語" };
      const lang = map[String(args.country_code).toUpperCase()] || "English";
      return { country_code: args.country_code, language: lang };
    }

    case "get_pending_actions": {
      const status = String(args.status || "pending");
      let q = supabase.from("ai_pending_actions").select("id, action_type, confidence, reasoning, suggested_content, partner_id, contact_id, email_address, status, created_at, source")
        .eq("user_id", userId)
        .eq("status", status)
        .order("confidence", { ascending: false })
        .limit(Number(args.limit) || 20);
      if (args.action_type) q = q.eq("action_type", String(args.action_type));
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { count: data?.length || 0, actions: data || [] };
    }

    case "approve_ai_action": {
      const actionId = String(args.action_id);
      const { error } = await supabase.from("ai_pending_actions")
        .update({ status: "approved", executed_at: new Date().toISOString() })
        .eq("id", actionId)
        .eq("user_id", userId);
      if (error) return { error: error.message };
      return { success: true, message: `Azione ${actionId} approvata.` };
    }

    case "reject_ai_action": {
      const actionId = String(args.action_id);
      const reason = args.reason ? String(args.reason) : null;
      const updatePayload: Record<string, unknown> = { status: "rejected" };
      if (reason) updatePayload.reasoning = reason;
      const { error } = await supabase.from("ai_pending_actions")
        .update(updatePayload)
        .eq("id", actionId)
        .eq("user_id", userId);
      if (error) return { error: error.message };
      return { success: true, message: `Azione ${actionId} rifiutata.` };
    }

    case "create_campaign": {
      const steps: WorkPlanStep[] = [];
      const contactType = String(args.contact_type || "all");
      const countryCodes = (args.country_codes as string[]) || [];
      steps.push({ index: 0, title: "Selezione contatti", description: `Tipo: ${contactType}, Paesi: ${countryCodes.join(", ") || "tutti"}`, status: "pending" });
      const agentNames = (args.agent_names as string[]) || [];
      if (agentNames.length > 0) steps.push({ index: 1, title: "Assegnazione agenti", description: `Agenti: ${agentNames.join(", ")}`, status: "pending" });
      const abTest = args.ab_test as AbTestConfig | undefined;
      if (abTest?.enabled && abTest?.variants?.length > 0) {
        steps.push({ index: steps.length, title: "Configurazione A/B Test", description: `Varianti: ${abTest.variants.map((v: AbTestVariant) => `${v.agent_name}(${v.tone}/${v.percentage}%)`).join(" vs ")}`, status: "pending" });
      }
      steps.push({ index: steps.length, title: "Invio outreach", description: "Esecuzione invii tramite agenti assegnati", status: "pending" });
      steps.push({ index: steps.length, title: "Monitoraggio circuito", description: "Verifica risposte e follow-up secondo workflow", status: "pending" });
      const { data, error } = await supabase.from("ai_work_plans").insert({
        user_id: userId, title: `Campagna: ${args.name}`, description: String(args.objective || ""),
        steps: steps as unknown as Record<string, unknown>, status: "active",
        tags: ["campaign", contactType, ...(countryCodes.map((c) => `country:${c}`))],
        metadata: { campaign: true, contact_type: contactType, country_codes: countryCodes, agent_names: agentNames, ab_test: abTest || null, max_contacts: Number(args.max_contacts) || 100 } as Record<string, unknown>,
      }).select("id, title").single();
      if (error) return { error: error.message };
      return { success: true, campaign_id: data.id, name: data.title, steps: steps.length, message: `Campagna "${args.name}" creata con ${steps.length} step.` };
    }

    default:
      return { error: `Tool sconosciuto: ${name}` };
  }
}

// ── Helper functions for tools still inline ──

async function handleGetInbox(supabase: any, userId: string, args: Record<string, unknown>): Promise<unknown> {
  let query = supabase.from("channel_messages").select("id, channel, direction, from_address, to_address, subject, body_text, email_date, read_at, partner_id, category, created_at")
    .eq("user_id", userId).eq("direction", "inbound").order("email_date", { ascending: false }).limit(Math.min(Number(args.limit) || 20, 50));
  if (args.channel) query = query.eq("channel", args.channel);
  if (args.unread_only) query = query.is("read_at", null);
  if (args.partner_id) query = query.eq("partner_id", args.partner_id);
  if (args.from_date) query = query.gte("email_date", args.from_date);
  if (args.to_date) query = query.lte("email_date", args.to_date);
  const { data, error } = await query;
  if (error) return { error: error.message };
  return { count: data?.length || 0, messages: (data || []).map((m: ChannelMessageRow) => ({ id: m.id, channel: m.channel, from: m.from_address, subject: m.subject, preview: m.body_text?.substring(0, 300) || "", date: m.email_date, read: !!m.read_at, partner_id: m.partner_id, category: m.category })) };
}

async function handleGetConversationHistory(supabase: any, userId: string, args: Record<string, unknown>): Promise<unknown> {
  let pid = args.partner_id as string;
  if (!pid && args.company_name) { const r = await resolvePartnerId(args); if (r) pid = r.id; }
  const timeline: Record<string, unknown>[] = [];
  if (pid) {
    const { data: emails } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel")
      .eq("user_id", userId).or(`partner_id.eq.${pid},from_address.ilike.%${pid}%`).order("email_date", { ascending: false }).limit(30);
    (emails || []).forEach((e: any) => timeline.push({ type: "email", direction: e.direction, subject: e.subject, from: e.from_address, date: e.email_date, channel: e.channel, preview: e.body_text?.substring(0, 200) }));
    const { data: acts } = await supabase.from("activities").select("id, title, activity_type, status, created_at, description")
      .or(`partner_id.eq.${pid},source_id.eq.${pid}`).order("created_at", { ascending: false }).limit(30);
    (acts || []).forEach((a: any) => timeline.push({ type: "activity", subtype: a.activity_type, title: a.title, status: a.status, date: a.created_at, description: a.description?.substring(0, 200) }));
    const { data: ints } = await supabase.from("interactions").select("id, interaction_type, subject, notes, created_at")
      .eq("partner_id", pid).order("created_at", { ascending: false }).limit(30);
    (ints || []).forEach((i: any) => timeline.push({ type: "interaction", subtype: i.interaction_type, title: i.subject, notes: i.notes?.substring(0, 200), date: i.created_at }));
    const { data: sent } = await supabase.from("email_campaign_queue").select("id, subject, recipient_email, status, sent_at")
      .eq("partner_id", pid).eq("status", "sent").order("sent_at", { ascending: false }).limit(20);
    (sent || []).forEach((s: any) => timeline.push({ type: "email_sent", subject: s.subject, to: s.recipient_email, date: s.sent_at }));
  } else if (args.contact_id) {
    const { data: cInts } = await supabase.from("contact_interactions").select("id, interaction_type, title, description, outcome, created_at")
      .eq("contact_id", args.contact_id).order("created_at", { ascending: false }).limit(30);
    (cInts || []).forEach((i: any) => timeline.push({ type: "interaction", subtype: i.interaction_type, title: i.title, description: i.description?.substring(0, 200), outcome: i.outcome, date: i.created_at }));
  }
  timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return { count: timeline.length, timeline: timeline.slice(0, Number(args.limit) || 50) };
}

async function handleGetHoldingPattern(supabase: any, userId: string, args: Record<string, unknown>): Promise<unknown> {
  const items: HoldingItem[] = [];
  const activeStatuses = ["first_touch_sent", "holding", "engaged", "qualified", "negotiation"];
  const now = new Date();
  if (!args.source_type || args.source_type === "wca" || args.source_type === "all") {
    let pq = supabase.from("partners").select("id, company_name, country_code, city, email, lead_status, last_interaction_at, interaction_count")
      .in("lead_status", activeStatuses).order("last_interaction_at", { ascending: true, nullsFirst: true });
    if (args.country_code) pq = pq.eq("country_code", String(args.country_code).toUpperCase());
    const { data: partners } = await pq.limit(Number(args.limit) || 50);
    (partners || []).forEach((p: any) => {
      const days = p.last_interaction_at ? Math.floor((now.getTime() - new Date(p.last_interaction_at).getTime()) / 86400000) : 999;
      if (args.min_days_waiting && days < Number(args.min_days_waiting)) return;
      if (args.max_days_waiting && days > Number(args.max_days_waiting)) return;
      items.push({ id: p.id, source: "wca", name: p.company_name, country: p.country_code, city: p.city, email: p.email, status: p.lead_status, days_waiting: days, interactions: p.interaction_count });
    });
  }
  if (!args.source_type || args.source_type === "crm" || args.source_type === "all") {
    const cq = supabase.from("imported_contacts").select("id, name, company_name, country, city, email, lead_status, last_interaction_at, interaction_count")
      .in("lead_status", activeStatuses).order("last_interaction_at", { ascending: true, nullsFirst: true });
    const { data: contacts } = await cq.limit(Number(args.limit) || 50);
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

async function handleGetEmailThread(supabase: any, userId: string, args: Record<string, unknown>): Promise<unknown> {
  let messages: ChannelMessageRow[] = [];
  if (args.thread_id) {
    const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel")
      .eq("user_id", userId).eq("thread_id", args.thread_id).order("email_date", { ascending: true });
    messages = data || [];
  }
  if (messages.length === 0 && args.partner_id) {
    const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel, thread_id, in_reply_to")
      .eq("user_id", userId).eq("partner_id", args.partner_id).eq("channel", "email").order("email_date", { ascending: true }).limit(Number(args.limit) || 50);
    messages = data || [];
  }
  if (messages.length === 0 && args.email_address) {
    const { data } = await supabase.from("channel_messages").select("id, direction, from_address, to_address, subject, body_text, email_date, channel")
      .eq("user_id", userId).eq("channel", "email").or(`from_address.ilike.%${args.email_address}%,to_address.ilike.%${args.email_address}%`)
      .order("email_date", { ascending: true }).limit(Number(args.limit) || 50);
    messages = data || [];
  }
  return { count: messages.length, thread: (messages as ChannelMessageRow[]).map((m) => ({ id: m.id, direction: m.direction, from: m.from_address, to: m.to_address, subject: m.subject, preview: m.body_text?.substring(0, 500), date: m.email_date })) };
}
