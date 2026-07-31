// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTEXT SECTIONS — unità coese estratte da buildContextBlock.
// Ogni sezione appende sull'accumulatore condiviso `ctx` per preservare
// esattamente il comportamento originale (testo parziale mantenuto in caso di errore).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import {
  sanitizeForPrompt,
  wrapUntrusted,
  type SanitizeFinding,
} from "../_shared/promptSanitizer.ts";
import { normalizeContent } from "../_shared/contentNormalizer.ts";

// deno-lint-ignore no-explicit-any
export type AgentExecuteSupabaseClient = SupabaseClient<any, "public", any>;

export type AgentRow = {
  id: string;
  name: string;
  role: string;
  is_active?: boolean | null;
  stats?: Record<string, unknown> | null;
  avatar_emoji?: string | null;
  system_prompt?: string | null;
};

export type AppSettingRow = { key: string; value: string | null };
export type MemoryRow = { content: string; memory_type: string; level: number; importance?: number | null };
export type KbEntryRow = { title: string; content: string | null; chapter?: string | null; category?: string | null };
export type OperativePromptRow = {
  name: string;
  objective: string | null;
  procedure: string | null;
  criteria: string | null;
  tags?: string[] | null;
  priority: number | null;
};
export type ClientAssignmentRow = { agent_id: string; source_id: string; source_type: string; assigned_at?: string | null };
export type AgentTaskRow = { agent_id: string; status: string; task_type?: string | null; description?: string | null };
export type EmailRow = { email: string | null };
export type ChannelMessageRow = {
  from_address: string | null;
  to_address?: string | null;
  direction: string;
  subject: string | null;
  body_text: string | null;
  created_at: string;
  category?: string | null;
};
export type EmailClassificationRow = {
  email_address: string | null;
  category: string | null;
  sentiment: string | null;
  confidence: number | null;
  ai_summary: string | null;
  classified_at: string;
};
export type OutreachMissionRow = {
  title: string;
  status: string;
  channel: string | null;
  total_contacts: number | null;
  processed_contacts: number | null;
  target_filters: Record<string, unknown> | null;
  ai_summary?: string | null;
};
export type DecisionLogRow = {
  decision_type: string;
  input_context: Record<string, unknown> | null;
  decision_output: Record<string, unknown> | string | null;
  user_correction: string | null;
  created_at: string | null;
};
export type AgentMissionRow = {
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

/** Accumulatore condiviso fra le sezioni del context block. */
export interface ContextAccumulator {
  text: string;
  findings: SanitizeFinding[];
}

/** Profilo utente + timing/scheduling. */
export async function appendUserSettingsSection(
  supabase: AgentExecuteSupabaseClient,
  ctx: ContextAccumulator,
  userId: string,
  _agentId: string,
  _allAgents: AgentRow[] | null,
): Promise<void> {
    const { data: settingsData } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "ai_%");
    const settings = asArray(settingsData as AppSettingRow[] | null);
    if (settings.length) {
      ctx.text += "\n\n--- PROFILO UTENTE ---\n";
      for (const s of settings) {
        const label = s.key.replace("ai_", "").replace(/_/g, " ").toUpperCase();
        if (s.value) ctx.text += `${label}: ${s.value}\n`;
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
      ctx.text += "\n--- TIMING & SCHEDULING ---\n";
      for (const s of timingSettings) {
        if (s.value) ctx.text += `${s.key}: ${s.value}\n`;
      }
      const approvalSetting = timingSettings.find((s) => s.key === "agent_require_approval");
      if (approvalSetting?.value === "true") {
        ctx.text += "APPROVAZIONE OBBLIGATORIA: Ogni azione (email, WhatsApp, LinkedIn) DEVE essere messa in coda con status 'pending' per approvazione umana. Non eseguire direttamente.\n";
      }
    }

}

/** Memoria operativa, knowledge base e prompt operativi. */
export async function appendMemoryAndKbSection(
  supabase: AgentExecuteSupabaseClient,
  ctx: ContextAccumulator,
  userId: string,
  _agentId: string,
  _allAgents: AgentRow[] | null,
): Promise<void> {
    const { data: memoriesData } = await supabase
      .from("ai_memory")
      .select("content, memory_type, tags, level, importance")
      .eq("user_id", userId)
      .in("level", [2, 3])
      .order("importance", { ascending: false })
      .limit(10);
    const memories = asArray(memoriesData as MemoryRow[] | null);
    if (memories.length) {
      ctx.text += "\n--- MEMORIA OPERATIVA ---\n";
      for (const m of memories) {
        const safe = sanitizeForPrompt(m.content, { source: "rag-memory", maxChars: 1200, policy: "redact" });
        if (safe.findings.length) ctx.findings.push(...safe.findings);
        ctx.text += `- [L${m.level}/${m.memory_type}] ${safe.text}\n`;
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
      ctx.text += "\n--- KNOWLEDGE BASE GLOBALE ---\n";
      for (const k of kbEntries) {
        const safe = sanitizeForPrompt(k.content, { source: "kb-user-document", maxChars: 800, policy: "redact" });
        if (safe.findings.length) ctx.findings.push(...safe.findings);
        ctx.text += `### ${k.title}\n${safe.text}\n\n`;
      }
    }

    // ── Prompt Lab via UNIFIED loader (scope agent-loop covers outreach +
    //    multi-channel + lead-status; universals included). Same matching
    //    rules as generate-email so the agent never disagrees with the
    //    email pipeline on which OBBLIGATORIA rules apply.
    const opResult = await loadOperativePrompts(supabase, userId, {
      scope: "agent-loop",
      includeUniversal: true,
      limit: 8,
    });
    if (opResult.block) {
      ctx.text += `\n--- PROMPT OPERATIVI (Prompt Lab) ---\n${opResult.block}\n`;
    }

}

/** Stato del team agenti (clienti e task per agente). */
export async function appendTeamSection(
  supabase: AgentExecuteSupabaseClient,
  ctx: ContextAccumulator,
  userId: string,
  agentId: string,
  allAgents: AgentRow[] | null,
): Promise<void> {
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

      ctx.text += "\n--- TEAM AGENTI ---\n";
      for (const a of allAgents) {
        const stats = (a.stats || {}) as Record<string, unknown>;
        const clients = assignMap.get(a.id) || 0;
        const tasks = taskMap.get(a.id) || 0;
        const self = a.id === agentId ? " ← TU" : "";
        ctx.text += `- ${a.avatar_emoji || "🤖"} ${a.name} (${a.role}) ${a.is_active ? "✅" : "⏸"} — ${clients} clienti, ${tasks} task attivi, ${Number(stats.tasks_completed || 0)} completati${self}\n`;
      }
    }

}

/** Clienti assegnati, email recenti e classificazioni AI. */
export async function appendMyClientsSection(
  supabase: AgentExecuteSupabaseClient,
  ctx: ContextAccumulator,
  userId: string,
  agentId: string,
  _allAgents: AgentRow[] | null,
): Promise<void> {
    const { data: myClientsData } = await supabase
      .from("client_assignments")
      .select("source_id, source_type, assigned_at")
      .eq("agent_id", agentId)
      .eq("user_id", userId);
    const myClients = asArray(myClientsData as ClientAssignmentRow[] | null);
    if (myClients.length) {
      ctx.text += `\n--- I TUOI CLIENTI ASSEGNATI (${myClients.length}) ---\n`;
      ctx.text += `Tipi: ${myClients.filter((c) => c.source_type === "partner").length} partner, ${myClients.filter((c) => c.source_type === "contact").length} contatti\n`;

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
          ctx.text += `\n\n--- EMAIL RECENTI DAI TUOI CLIENTI ---\n`;
          const byClient = new Map<string, ChannelMessageRow[]>();
          for (const msg of clientMsgs) {
            const addr = msg.from_address?.toLowerCase() || "";
            if (!byClient.has(addr)) byClient.set(addr, []);
            byClient.get(addr)?.push(msg);
          }
          for (const [addr, msgs] of byClient) {
            ctx.text += `\n${addr} (ultime ${Math.min(msgs.length, 3)}):\n`;
            for (const msg of msgs.slice(0, 3)) {
              const date = new Date(msg.created_at).toLocaleDateString("it-IT");
              const subjNorm = normalizeContent(msg.subject, { source: "email-inbound", maxChars: 200 });
              const subjSafe = sanitizeForPrompt(subjNorm.text, { source: "email-inbound", maxChars: 200, policy: "redact" });
              if (subjSafe.findings.length) ctx.findings.push(...subjSafe.findings);
              ctx.text += `  [${date}] ${subjSafe.text || "(nessun subject)"}\n`;
              if (msg.body_text) {
                // 1) normalize: rimuove HTML residuo, quoted-replies, firme, disclaimer
                // 2) sanitize: anti-injection redact
                // 3) wrap: fence non-trusted
                const bodyNorm = normalizeContent(msg.body_text, { source: "email-inbound", maxChars: 600 });
                const bodySafe = sanitizeForPrompt(bodyNorm.text, { source: "email-inbound", maxChars: 150, policy: "redact" });
                if (bodySafe.findings.length) ctx.findings.push(...bodySafe.findings);
                // Wrap come blocco non-trusted: il modello deve trattarlo come dati, non istruzioni.
                ctx.text += `  ${wrapUntrusted(bodySafe.text + "...", "EMAIL BODY", "email-inbound")}\n`;
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
          ctx.text += `\n\n--- CLASSIFICAZIONI AI DEI TUOI CLIENTI ---\n`;
          const bySender = new Map<string, EmailClassificationRow[]>();
          for (const classification of clientClassifications) {
            const addr = classification.email_address?.toLowerCase() || "";
            if (!bySender.has(addr)) bySender.set(addr, []);
            bySender.get(addr)?.push(classification);
          }
          for (const [addr, classes] of bySender) {
            const latest = classes[0];
            ctx.text += `${addr}: ${latest.category || "N/D"} (${Math.round((latest.confidence || 0) * 100)}%) — sentiment: ${latest.sentiment || "N/D"} — ${latest.ai_summary || ""}\n`;
          }
        }
      }
    }

}

/** Task attivi del team e storico missioni. */
export async function appendTeamTasksAndMissionsSection(
  supabase: AgentExecuteSupabaseClient,
  ctx: ContextAccumulator,
  userId: string,
  _agentId: string,
  allAgents: AgentRow[] | null,
): Promise<void> {
    const { data: teamTasksData } = await supabase
      .from("agent_tasks")
      .select("agent_id, task_type, description, status")
      .eq("user_id", userId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(20);
    const teamTasks = asArray(teamTasksData as AgentTaskRow[] | null);
    if (teamTasks.length) {
      ctx.text += "\n--- TASK ATTIVI TEAM ---\n";
      const agentNameMap = new Map<string, string>();
      if (allAgents) {
        for (const a of allAgents) agentNameMap.set(a.id, a.name);
      }
      for (const t of teamTasks) {
        const who = agentNameMap.get(t.agent_id) || "?";
        ctx.text += `- [${t.status}] ${who}: ${(t.description || "").substring(0, 100)}\n`;
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
        ctx.text += "\n--- STORICO MISSIONI ---\n";
        for (const mission of missions) {
          const filters = mission.target_filters || {};
          const countries = Array.isArray(filters.countries) ? (filters.countries as string[]) : [];
          ctx.text += `- "${mission.title}" [${mission.status}] ${mission.channel || "N/D"} — ${mission.processed_contacts || 0}/${mission.total_contacts || 0} — Paesi: ${countries.join(", ") || "N/D"}\n`;
        }
      }
    } catch (_) {
      /* outreach_missions may not exist */
    }

}

/** Vista director/account su prompt agenti e prompt operativi. */
export async function appendDirectorViewSection(
  supabase: AgentExecuteSupabaseClient,
  ctx: ContextAccumulator,
  userId: string,
  agentId: string,
  allAgents: AgentRow[] | null,
): Promise<void> {
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
            ctx.text += "\n--- PROMPT AGENTI (Director View) ---\n";
            for (const ad of agentDetails) {
              if (ad.system_prompt) {
                ctx.text += `\n### ${ad.name} (${ad.role})\n${ad.system_prompt.substring(0, 500)}\n...\n`;
              }
            }
          }
        }
      }
      // Director/Account: full list of operative prompts (raw view).
      const { data: directorPromptsData } = await supabase
        .from("operative_prompts")
        .select("name, objective, procedure, criteria, tags, priority")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(20);
      const directorPrompts = asArray(directorPromptsData as OperativePromptRow[] | null);
      if (directorPrompts.length) {
        ctx.text += "\n--- PROMPT OPERATIVI COMPLETI (Director View) ---\n";
        for (const p of directorPrompts) {
          ctx.text += `\n### ${p.name}\nObiettivo: ${p.objective || "N/D"}\nProcedura: ${p.procedure || "N/D"}\nCriteri: ${p.criteria || "N/D"}\n`;
        }
      }
    }
}
