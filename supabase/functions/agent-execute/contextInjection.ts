// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTEXT INJECTION - User Settings, Memory, KB, Team Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type AgentExecuteSupabaseClient = SupabaseClient<any, "public", any>;

type AgentRow = {
  id: string;
  name: string;
  role: string;
  is_active?: boolean | null;
  stats?: Record<string, unknown> | null;
  avatar_emoji?: string | null;
  system_prompt?: string | null;
};

type AppSettingRow = { key: string; value: string | null };
type MemoryRow = { content: string; memory_type: string; level: number; importance?: number | null };
type KbEntryRow = { title: string; content: string | null; chapter?: string | null; category?: string | null };
type OperativePromptRow = {
  name: string;
  objective: string | null;
  procedure: string | null;
  criteria: string | null;
  tags?: string[] | null;
  priority: number | null;
};
type ClientAssignmentRow = { agent_id: string; source_id: string; source_type: string; assigned_at?: string | null };
type AgentTaskRow = { agent_id: string; status: string; task_type?: string | null; description?: string | null };
type EmailRow = { email: string | null };
type ChannelMessageRow = {
  from_address: string | null;
  to_address?: string | null;
  direction: string;
  subject: string | null;
  body_text: string | null;
  created_at: string;
  category?: string | null;
};
type EmailClassificationRow = {
  email_address: string | null;
  category: string | null;
  sentiment: string | null;
  confidence: number | null;
  ai_summary: string | null;
  classified_at: string;
};
type OutreachMissionRow = {
  title: string;
  status: string;
  channel: string | null;
  total_contacts: number | null;
  processed_contacts: number | null;
  target_filters: Record<string, unknown> | null;
  ai_summary?: string | null;
};
type DecisionLogRow = {
  decision_type: string;
  input_context: Record<string, unknown> | null;
  decision_output: Record<string, unknown> | string | null;
  user_correction: string | null;
  created_at: string | null;
};
type AgentMissionRow = {
  title: string;
  goal_description: string | null;
  goal_type: string;
  kpi_target: Record<string, number> | null;
  kpi_current: Record<string, number> | null;
  budget: Record<string, unknown> | string | number | null;
  budget_consumed: Record<string, unknown> | string | number | null;
  approval_only_for: string[] | null;
};

const asArray = <T>(data: T[] | null | undefined): T[] => data ?? [];
const asMaybe = <T>(data: T | null | undefined): T | null => data ?? null;

/**
 * Build comprehensive context block with user profile, memory, KB, team status
 */
export async function buildContextBlock(
  supabase: AgentExecuteSupabaseClient,
  userId: string,
  agentId: string,
  allAgents: AgentRow[] | null
): Promise<string> {
  let contextBlock = "";

  try {
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "ai_%");
    const settings = asArray(settingsData as AppSettingRow[] | null);
    if (settings.length) {
      contextBlock += "\n\n--- PROFILO UTENTE ---\n";
      for (const s of settings) {
        const label = s.key.replace("ai_", "").replace(/_/g, " ").toUpperCase();
        if (s.value) contextBlock += `${label}: ${s.value}\n`;
      }
    }

    const { data: timingSettingsData } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "agent_%")
      .or("key.like.email_%,key.like.whatsapp_%,key.like.linkedin_%,key.like.scraping_%,key.like.deep_search_%");
    const timingSettings = asArray(timingSettingsData as AppSettingRow[] | null);
    if (timingSettings.length) {
      contextBlock += "\n--- TIMING & SCHEDULING ---\n";
      for (const s of timingSettings) {
        if (s.value) contextBlock += `${s.key}: ${s.value}\n`;
      }
      const approvalSetting = timingSettings.find((s) => s.key === "agent_require_approval");
      if (approvalSetting?.value === "true") {
        contextBlock += "APPROVAZIONE OBBLIGATORIA: Ogni azione (email, WhatsApp, LinkedIn) DEVE essere messa in coda con status 'pending' per approvazione umana. Non eseguire direttamente.\n";
      }
    }

    const { data: memoriesData } = await supabase
      .from("ai_memory")
      .select("content, memory_type, tags, level, importance")
      .eq("user_id", userId)
      .in("level", [2, 3])
      .order("importance", { ascending: false })
      .limit(10);
    const memories = asArray(memoriesData as MemoryRow[] | null);
    if (memories.length) {
      contextBlock += "\n--- MEMORIA OPERATIVA ---\n";
      for (const m of memories) {
        contextBlock += `- [L${m.level}/${m.memory_type}] ${m.content}\n`;
      }
    }

    const { data: kbEntriesData } = await supabase
      .from("kb_entries")
      .select("title, content, chapter, category")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(50);
    const kbEntries = asArray(kbEntriesData as KbEntryRow[] | null);
    if (kbEntries.length) {
      contextBlock += "\n--- KNOWLEDGE BASE GLOBALE ---\n";
      for (const k of kbEntries) {
        contextBlock += `### ${k.title}\n${(k.content || "").substring(0, 800)}\n\n`;
      }
    }

    const { data: opPromptsData } = await supabase
      .from("operative_prompts")
      .select("name, objective, procedure, criteria, tags, priority")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false });
    const opPrompts = asArray(opPromptsData as OperativePromptRow[] | null);
    if (opPrompts.length) {
      contextBlock += "\n--- PROMPT OPERATIVI ---\n";
      for (const p of opPrompts) {
        contextBlock += `### ${p.name} (priorità: ${p.priority ?? 0})\n`;
        if (p.objective) contextBlock += `Obiettivo: ${p.objective}\n`;
        if (p.procedure) contextBlock += `Procedura: ${p.procedure.substring(0, 300)}\n`;
        if (p.criteria) contextBlock += `Criteri: ${p.criteria.substring(0, 200)}\n`;
        contextBlock += "\n";
      }
    }

    if (allAgents?.length) {
      const { data: allAssignmentsData } = await supabase
        .from("client_assignments")
        .select("agent_id, source_id")
        .eq("user_id", userId);
      const allAssignments = asArray(allAssignmentsData as Array<Pick<ClientAssignmentRow, "agent_id" | "source_id">> | null);
      const assignMap = new Map<string, number>();
      for (const assignment of allAssignments) {
        assignMap.set(assignment.agent_id, (assignMap.get(assignment.agent_id) || 0) + 1);
      }

      const { data: activeTasksData } = await supabase
        .from("agent_tasks")
        .select("agent_id, status")
        .eq("user_id", userId)
        .in("status", ["pending", "running"]);
      const activeTasks = asArray(activeTasksData as AgentTaskRow[] | null);
      const taskMap = new Map<string, number>();
      for (const task of activeTasks) {
        taskMap.set(task.agent_id, (taskMap.get(task.agent_id) || 0) + 1);
      }

      contextBlock += "\n--- TEAM AGENTI ---\n";
      for (const a of allAgents) {
        const stats = (a.stats || {}) as Record<string, unknown>;
        const clients = assignMap.get(a.id) || 0;
        const tasks = taskMap.get(a.id) || 0;
        const self = a.id === agentId ? " ← TU" : "";
        contextBlock += `- ${a.avatar_emoji || "🤖"} ${a.name} (${a.role}) ${a.is_active ? "✅" : "⏸"} — ${clients} clienti, ${tasks} task attivi, ${Number(stats.tasks_completed || 0)} completati${self}\n`;
      }
    }

    const { data: myClientsData } = await supabase
      .from("client_assignments")
      .select("source_id, source_type, assigned_at")
      .eq("agent_id", agentId)
      .eq("user_id", userId);
    const myClients = asArray(myClientsData as ClientAssignmentRow[] | null);
    if (myClients.length) {
      contextBlock += `\n--- I TUOI CLIENTI ASSEGNATI (${myClients.length}) ---\n`;
      contextBlock += `Tipi: ${myClients.filter((c) => c.source_type === "partner").length} partner, ${myClients.filter((c) => c.source_type === "contact").length} contatti\n`;

      const clientEmails: string[] = [];
      for (const client of myClients.slice(0, 10)) {
        let email: string | null = null;
        if (client.source_type === "partner") {
          const { data } = await supabase
            .from("partners")
            .select("email")
            .eq("id", client.source_id)
            .maybeSingle();
          email = asMaybe(data as EmailRow | null)?.email || null;
        } else if (client.source_type === "contact" || client.source_type === "imported_contact") {
          const { data } = await supabase
            .from("imported_contacts")
            .select("email")
            .eq("id", client.source_id)
            .maybeSingle();
          email = asMaybe(data as EmailRow | null)?.email || null;
        }
        if (email) clientEmails.push(email.toLowerCase());
      }

      if (clientEmails.length > 0) {
        const { data: clientMsgsData } = await supabase
          .from("channel_messages")
          .select("from_address, to_address, direction, subject, body_text, created_at, category")
          .eq("user_id", userId)
          .in("from_address", clientEmails)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(30);
        const clientMsgs = asArray(clientMsgsData as ChannelMessageRow[] | null);

        if (clientMsgs.length) {
          contextBlock += `\n\n--- EMAIL RECENTI DAI TUOI CLIENTI ---\n`;
          const byClient = new Map<string, ChannelMessageRow[]>();
          for (const msg of clientMsgs) {
            const addr = msg.from_address?.toLowerCase() || "";
            if (!byClient.has(addr)) byClient.set(addr, []);
            byClient.get(addr)?.push(msg);
          }
          for (const [addr, msgs] of byClient) {
            contextBlock += `\n${addr} (ultime ${Math.min(msgs.length, 3)}):\n`;
            for (const msg of msgs.slice(0, 3)) {
              const date = new Date(msg.created_at).toLocaleDateString("it-IT");
              contextBlock += `  [${date}] ${msg.subject || "(nessun subject)"}\n`;
              if (msg.body_text) {
                contextBlock += `  ${msg.body_text.slice(0, 150)}...\n`;
              }
            }
          }
        }

        const { data: clientClassificationsData } = await supabase
          .from("email_classifications")
          .select("email_address, category, sentiment, confidence, ai_summary, classified_at")
          .eq("user_id", userId)
          .in("email_address", clientEmails)
          .order("classified_at", { ascending: false })
          .limit(20);
        const clientClassifications = asArray(clientClassificationsData as EmailClassificationRow[] | null);

        if (clientClassifications.length) {
          contextBlock += `\n\n--- CLASSIFICAZIONI AI DEI TUOI CLIENTI ---\n`;
          const bySender = new Map<string, EmailClassificationRow[]>();
          for (const classification of clientClassifications) {
            const addr = classification.email_address?.toLowerCase() || "";
            if (!bySender.has(addr)) bySender.set(addr, []);
            bySender.get(addr)?.push(classification);
          }
          for (const [addr, classes] of bySender) {
            const latest = classes[0];
            contextBlock += `${addr}: ${latest.category || "N/D"} (${Math.round((latest.confidence || 0) * 100)}%) — sentiment: ${latest.sentiment || "N/D"} — ${latest.ai_summary || ""}\n`;
          }
        }
      }
    }

    const { data: teamTasksData } = await supabase
      .from("agent_tasks")
      .select("agent_id, task_type, description, status")
      .eq("user_id", userId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(20);
    const teamTasks = asArray(teamTasksData as AgentTaskRow[] | null);
    if (teamTasks.length) {
      contextBlock += "\n--- TASK ATTIVI TEAM ---\n";
      const agentNameMap = new Map<string, string>();
      if (allAgents) {
        for (const a of allAgents) agentNameMap.set(a.id, a.name);
      }
      for (const t of teamTasks) {
        const who = agentNameMap.get(t.agent_id) || "?";
        contextBlock += `- [${t.status}] ${who}: ${(t.description || "").substring(0, 100)}\n`;
      }
    }

    try {
      const { data: missionsData } = await supabase
        .from("outreach_missions")
        .select("title, status, channel, total_contacts, processed_contacts, target_filters, ai_summary")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      const missions = asArray(missionsData as OutreachMissionRow[] | null);
      if (missions.length) {
        contextBlock += "\n--- STORICO MISSIONI ---\n";
        for (const mission of missions) {
          const filters = mission.target_filters || {};
          const countries = Array.isArray(filters.countries) ? (filters.countries as string[]) : [];
          contextBlock += `- "${mission.title}" [${mission.status}] ${mission.channel || "N/D"} — ${mission.processed_contacts || 0}/${mission.total_contacts || 0} — Paesi: ${countries.join(", ") || "N/D"}\n`;
        }
      }
    } catch (_) {
      /* outreach_missions may not exist */
    }

    if ((allAgents?.find((a) => a.id === agentId)?.role as string | undefined) === "director" ||
        (allAgents?.find((a) => a.id === agentId)?.role as string | undefined) === "account") {
      if (allAgents?.length) {
        const otherAgentIds = allAgents
          .filter((a) => a.id !== agentId)
          .map((a) => a.id);
        if (otherAgentIds.length > 0) {
          const { data: agentDetailsData } = await supabase
            .from("agents")
            .select("id, name, role, system_prompt")
            .in("id", otherAgentIds);
          const agentDetails = asArray(agentDetailsData as AgentRow[] | null);
          if (agentDetails.length) {
            contextBlock += "\n--- PROMPT AGENTI (Director View) ---\n";
            for (const ad of agentDetails) {
              if (ad.system_prompt) {
                contextBlock += `\n### ${ad.name} (${ad.role})\n${ad.system_prompt.substring(0, 500)}\n...\n`;
              }
            }
          }
        }
      }
      if (opPrompts.length) {
        contextBlock += "\n--- PROMPT OPERATIVI COMPLETI (Director View) ---\n";
        for (const p of opPrompts) {
          contextBlock += `\n### ${p.name}\nObiettivo: ${p.objective || "N/D"}\nProcedura: ${p.procedure || "N/D"}\nCriteri: ${p.criteria || "N/D"}\n`;
        }
      }
    }
  } catch (e) {
    console.error("Context injection error:", e);
  }

  return contextBlock;
}

/**
 * Build learning block from past decisions and corrections
 */
export async function buildLearningBlock(
  supabase: AgentExecuteSupabaseClient,
  agentId: string
): Promise<string> {
  let learningBlock = "";
  try {
    const { data: decisionsData } = await supabase
      .from("ai_decision_log")
      .select("decision_type, input_context, decision_output, user_correction, created_at")
      .eq("operator_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10);
    const decisions = asArray(decisionsData as DecisionLogRow[] | null);
    if (decisions.length) {
      learningBlock += "\n\n--- APPRENDIMENTO DA DECISIONI PASSATE ---\n";
      for (const d of decisions) {
        const date = new Date(d.created_at || new Date().toISOString()).toLocaleDateString("it-IT");
        learningBlock += `[${date}] ${d.decision_type}: `;
        if (d.user_correction) {
          learningBlock += `⚠️ CORRETTO: "${d.user_correction}" (originale: ${JSON.stringify(d.input_context).substring(0, 150)})\n`;
        } else if (d.decision_output) {
          learningBlock += `✅ ${typeof d.decision_output === "string" ? d.decision_output : JSON.stringify(d.decision_output).substring(0, 200)}\n`;
        } else {
          learningBlock += `${JSON.stringify(d.input_context).substring(0, 200)}\n`;
        }
      }
      learningBlock += "IMPORTANTE: Evita di ripetere errori corretti dall'utente. Adatta il tuo approccio in base ai feedback.\n";
    }
  } catch (_) {
    /* ai_decision_log may not exist */
  }
  return learningBlock;
}

/**
 * Build mission context if running within a mission
 */
export async function buildMissionBlock(
  supabase: AgentExecuteSupabaseClient,
  missionId: string | undefined
): Promise<string> {
  let missionBlock = "";
  try {
    if (missionId) {
      const { data } = await supabase
        .from("agent_missions")
        .select("title, goal_description, goal_type, kpi_target, kpi_current, budget, budget_consumed, approval_only_for")
        .eq("id", missionId)
        .maybeSingle();
      const mission = asMaybe(data as AgentMissionRow | null);
      if (mission) {
        const kpiTarget = mission.kpi_target || {};
        const kpiCurrent = mission.kpi_current || {};
        const approvalFor = mission.approval_only_for || [];
        missionBlock += `\n\n--- MISSIONE ATTIVA ---\n`;
        missionBlock += `Titolo: ${mission.title}\n`;
        missionBlock += `Obiettivo: ${mission.goal_description || ""}\n`;
        missionBlock += `KPI Target: ${JSON.stringify(kpiTarget)}\n`;
        missionBlock += `KPI Attuale: ${JSON.stringify(kpiCurrent)}\n`;
        missionBlock += `Budget: ${JSON.stringify(mission.budget_consumed)}/${JSON.stringify(mission.budget)} azioni\n`;
        if (approvalFor.length) {
          missionBlock += `⚠️ RICHIEDI APPROVAZIONE per: ${approvalFor.join(", ")} — usa ai_pending_actions con status 'pending'\n`;
        }
      }
    }
  } catch (_) {
    /* mission may not exist */
  }
  return missionBlock;
}
