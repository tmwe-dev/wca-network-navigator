// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTEXT INJECTION - User Settings, Memory, KB, Team Data
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

type SupabaseClient = ReturnType<typeof createClient>;

/**
 * Build comprehensive context block with user profile, memory, KB, team status
 */
export async function buildContextBlock(
  supabase: SupabaseClient,
  userId: string,
  agentId: string,
  allAgents: Array<Record<string, unknown>> | null
): Promise<string> {
  let contextBlock = "";

  try {
    // 1. User profile settings
    const { data: settings } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "ai_%");
    if (settings?.length) {
      contextBlock += "\n\n--- PROFILO UTENTE ---\n";
      for (const s of settings) {
        const label = (s.key as string).replace("ai_", "").replace(/_/g, " ").toUpperCase();
        if (s.value) contextBlock += `${label}: ${s.value}\n`;
      }
    }

    // 1b. Timing & scheduling config
    const { data: timingSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "agent_%")
      .or("key.like.email_%,key.like.whatsapp_%,key.like.linkedin_%,key.like.scraping_%,key.like.deep_search_%");
    if (timingSettings?.length) {
      contextBlock += "\n--- TIMING & SCHEDULING ---\n";
      for (const s of timingSettings) {
        if (s.value) contextBlock += `${s.key}: ${s.value}\n`;
      }
      const approvalSetting = timingSettings.find((s: Record<string, unknown>) => s.key === "agent_require_approval");
      if ((approvalSetting?.value as string) === "true") {
        contextBlock += "APPROVAZIONE OBBLIGATORIA: Ogni azione (email, WhatsApp, LinkedIn) DEVE essere messa in coda con status 'pending' per approvazione umana. Non eseguire direttamente.\n";
      }
    }

    // 2. Operational memory L2/L3
    const { data: memories } = await supabase
      .from("ai_memory")
      .select("content, memory_type, tags, level, importance")
      .eq("user_id", userId)
      .in("level", [2, 3])
      .order("importance", { ascending: false })
      .limit(10);
    if (memories?.length) {
      contextBlock += "\n--- MEMORIA OPERATIVA ---\n";
      for (const m of memories) {
        contextBlock += `- [L${m.level}/${m.memory_type}] ${m.content}\n`;
      }
    }

    // 3. Global KB (top 50 by priority, truncated content)
    const { data: kbEntries } = await supabase
      .from("kb_entries")
      .select("title, content, chapter, category")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(50);
    if (kbEntries?.length) {
      contextBlock += "\n--- KNOWLEDGE BASE GLOBALE ---\n";
      for (const k of kbEntries) {
        contextBlock += `### ${k.title}\n${(k.content as string).substring(0, 800)}\n\n`;
      }
    }

    // 4. Operative prompts
    const { data: opPrompts } = await supabase
      .from("operative_prompts")
      .select("name, objective, procedure, criteria, tags, priority")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false });
    if (opPrompts?.length) {
      contextBlock += "\n--- PROMPT OPERATIVI ---\n";
      for (const p of opPrompts) {
        contextBlock += `### ${p.name} (priorità: ${p.priority})\n`;
        if (p.objective) contextBlock += `Obiettivo: ${p.objective}\n`;
        if (p.procedure) contextBlock += `Procedura: ${(p.procedure as string).substring(0, 300)}\n`;
        if (p.criteria) contextBlock += `Criteri: ${(p.criteria as string).substring(0, 200)}\n`;
        contextBlock += "\n";
      }
    }

    // 5. Team roster with stats
    if (allAgents?.length) {
      const { data: allAssignments } = await supabase
        .from("client_assignments")
        .select("agent_id, source_id")
        .eq("user_id", userId);
      const assignMap = new Map<string, number>();
      if (allAssignments) {
        for (const a of allAssignments) {
          assignMap.set(a.agent_id as string, (assignMap.get(a.agent_id as string) || 0) + 1);
        }
      }

      const { data: activeTasks } = await supabase
        .from("agent_tasks")
        .select("agent_id, status")
        .eq("user_id", userId)
        .in("status", ["pending", "running"]);
      const taskMap = new Map<string, number>();
      if (activeTasks) {
        for (const t of activeTasks) {
          taskMap.set(t.agent_id as string, (taskMap.get(t.agent_id as string) || 0) + 1);
        }
      }

      contextBlock += "\n--- TEAM AGENTI ---\n";
      for (const a of allAgents) {
        const s = (a.stats || {}) as Record<string, unknown>;
        const clients = assignMap.get(a.id as string) || 0;
        const tasks = taskMap.get(a.id as string) || 0;
        const self = a.id === agentId ? " ← TU" : "";
        contextBlock += `- ${a.avatar_emoji} ${a.name} (${a.role}) ${a.is_active ? "✅" : "⏸"} — ${clients} clienti, ${tasks} task attivi, ${s.tasks_completed || 0} completati${self}\n`;
      }
    }

    // 6. Assigned clients
    const { data: myClients } = await supabase
      .from("client_assignments")
      .select("source_id, source_type, assigned_at")
      .eq("agent_id", agentId)
      .eq("user_id", userId);
    if (myClients?.length) {
      contextBlock += `\n--- I TUOI CLIENTI ASSEGNATI (${myClients.length}) ---\n`;
      contextBlock += `Tipi: ${myClients.filter((c: Record<string, unknown>) => c.source_type === "partner").length} partner, ${myClients.filter((c: Record<string, unknown>) => c.source_type === "contact").length} contatti\n`;

      // Recent emails from assigned clients
      const clientEmails: string[] = [];
      for (const client of myClients.slice(0, 10)) {
        let email: string | null = null;
        if (client.source_type === "partner") {
          const { data } = await supabase
            .from("partners")
            .select("email")
            .eq("id", client.source_id as string)
            .single();
          email = (data?.email as string) || null;
        } else if (client.source_type === "contact" || client.source_type === "imported_contact") {
          const { data } = await supabase
            .from("imported_contacts")
            .select("email")
            .eq("id", client.source_id as string)
            .single();
          email = (data?.email as string) || null;
        }
        if (email) clientEmails.push(email.toLowerCase());
      }

      if (clientEmails.length > 0) {
        const { data: clientMsgs } = await supabase
          .from("channel_messages")
          .select("from_address, to_address, direction, subject, body_text, created_at, category")
          .eq("user_id", userId)
          .in("from_address", clientEmails)
          .eq("direction", "inbound")
          .order("created_at", { ascending: false })
          .limit(30);

        if (clientMsgs?.length) {
          contextBlock += `\n\n--- EMAIL RECENTI DAI TUOI CLIENTI ---\n`;
          const byClient = new Map<string, typeof clientMsgs>();
          for (const msg of clientMsgs) {
            const addr = (msg.from_address as string)?.toLowerCase() || "";
            if (!byClient.has(addr)) byClient.set(addr, []);
            byClient.get(addr)!.push(msg);
          }
          for (const [addr, msgs] of byClient) {
            contextBlock += `\n${addr} (ultime ${Math.min(msgs.length, 3)}):\n`;
            for (const msg of msgs.slice(0, 3)) {
              const date = new Date(msg.created_at as string).toLocaleDateString("it-IT");
              contextBlock += `  [${date}] ${msg.subject || "(nessun subject)"}\n`;
              if (msg.body_text) {
                contextBlock += `  ${(msg.body_text as string).slice(0, 150)}...\n`;
              }
            }
          }
        }

        const { data: clientClassifications } = await supabase
          .from("email_classifications")
          .select("email_address, category, sentiment, confidence, ai_summary, classified_at")
          .eq("user_id", userId)
          .in("email_address", clientEmails)
          .order("classified_at", { ascending: false })
          .limit(20);

        if (clientClassifications?.length) {
          contextBlock += `\n\n--- CLASSIFICAZIONI AI DEI TUOI CLIENTI ---\n`;
          const bySender = new Map<string, typeof clientClassifications>();
          for (const c of clientClassifications) {
            const addr = (c.email_address as string)?.toLowerCase() || "";
            if (!bySender.has(addr)) bySender.set(addr, []);
            bySender.get(addr)!.push(c);
          }
          for (const [addr, classes] of bySender) {
            const latest = classes[0];
            contextBlock += `${addr}: ${latest.category} (${Math.round(((latest.confidence as number) || 0) * 100)}%) — sentiment: ${latest.sentiment} — ${latest.ai_summary || ""}\n`;
          }
        }
      }
    }

    // 7. Active team tasks
    const { data: teamTasks } = await supabase
      .from("agent_tasks")
      .select("agent_id, task_type, description, status")
      .eq("user_id", userId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(20);
    if (teamTasks?.length) {
      contextBlock += "\n--- TASK ATTIVI TEAM ---\n";
      const agentNameMap = new Map<string, string>();
      if (allAgents) {
        for (const a of allAgents) agentNameMap.set(a.id as string, a.name as string);
      }
      for (const t of teamTasks) {
        const who = agentNameMap.get(t.agent_id as string) || "?";
        contextBlock += `- [${t.status}] ${who}: ${(t.description as string).substring(0, 100)}\n`;
      }
    }

    // 8. Mission history
    try {
      const { data: missions } = await supabase
        .from("outreach_missions")
        .select("title, status, channel, total_contacts, processed_contacts, target_filters, ai_summary")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5);
      if (missions?.length) {
        contextBlock += "\n--- STORICO MISSIONI ---\n";
        for (const m of missions) {
          const f = m.target_filters as Record<string, unknown>;
          contextBlock += `- "${m.title}" [${m.status}] ${m.channel} — ${m.processed_contacts}/${m.total_contacts} — Paesi: ${(f?.countries as unknown as string[])?.join(", ") || "N/D"}\n`;
        }
      }
    } catch (_) {
      /* outreach_missions may not exist */
    }

    // 9. Director-only views
    if ((allAgents?.find((a: Record<string, unknown>) => a.id === agentId)?.role as string) === "director" ||
        (allAgents?.find((a: Record<string, unknown>) => a.id === agentId)?.role as string) === "account") {
      if (allAgents?.length) {
        const otherAgentIds = allAgents
          .filter((a: Record<string, unknown>) => a.id !== agentId)
          .map((a: Record<string, unknown>) => a.id as string);
        if (otherAgentIds.length > 0) {
          const { data: agentDetails } = await supabase
            .from("agents")
            .select("id, name, role, system_prompt")
            .in("id", otherAgentIds);
          if (agentDetails?.length) {
            contextBlock += "\n--- PROMPT AGENTI (Director View) ---\n";
            for (const ad of agentDetails) {
              if (ad.system_prompt) {
                contextBlock += `\n### ${ad.name} (${ad.role})\n${(ad.system_prompt as string).substring(0, 500)}\n...\n`;
              }
            }
          }
        }
      }
      if (opPrompts?.length) {
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
  supabase: SupabaseClient,
  agentId: string
): Promise<string> {
  let learningBlock = "";
  try {
    const { data: decisions } = await supabase
      .from("ai_decision_log")
      .select("decision_type, context, outcome, user_correction, created_at")
      .eq("agent_id", agentId)
      .order("created_at", { ascending: false })
      .limit(10);
    if (decisions?.length) {
      learningBlock += "\n\n--- APPRENDIMENTO DA DECISIONI PASSATE ---\n";
      for (const d of decisions) {
        const date = new Date(d.created_at as string).toLocaleDateString("it-IT");
        learningBlock += `[${date}] ${d.decision_type}: `;
        if (d.user_correction) {
          learningBlock += `⚠️ CORRETTO: "${d.user_correction}" (originale: ${JSON.stringify(d.context).substring(0, 150)})\n`;
        } else if (d.outcome) {
          learningBlock += `✅ ${d.outcome}\n`;
        } else {
          learningBlock += `${JSON.stringify(d.context).substring(0, 200)}\n`;
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
  supabase: SupabaseClient,
  missionId: string | undefined
): Promise<string> {
  let missionBlock = "";
  try {
    if (missionId) {
      const { data: mission } = await supabase
        .from("agent_missions")
        .select("title, goal_description, goal_type, kpi_target, kpi_current, budget, budget_consumed, approval_only_for")
        .eq("id", missionId)
        .maybeSingle();
      if (mission) {
        const kpiTarget = mission.kpi_target as Record<string, number>;
        const kpiCurrent = mission.kpi_current as Record<string, number>;
        const approvalFor = (mission.approval_only_for || []) as string[];
        missionBlock += `\n\n--- MISSIONE ATTIVA ---\n`;
        missionBlock += `Titolo: ${mission.title}\n`;
        missionBlock += `Obiettivo: ${mission.goal_description}\n`;
        missionBlock += `KPI Target: ${JSON.stringify(kpiTarget)}\n`;
        missionBlock += `KPI Attuale: ${JSON.stringify(kpiCurrent)}\n`;
        missionBlock += `Budget: ${mission.budget_consumed}/${mission.budget} azioni\n`;
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
