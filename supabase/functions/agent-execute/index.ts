import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders, supabase } from "./shared.ts";
import { ALL_TOOLS } from "./toolDefs.ts";
import { executeTool } from "./toolHandlers.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    let userId: string;
    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user: tokenUser }, error: tokenError } = await authClient.auth.getUser(token);
      if (tokenError || !tokenUser) {
        return new Response(JSON.stringify({ error: "Non autenticato" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = tokenUser.id;
    } else {
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Non autenticato" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    const body = await req.json();
    const { agent_id, task_id, chat_messages } = body;

    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id richiesto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load agent
    const { data: agent, error: agentErr } = await supabase
      .from("agents").select("*").eq("id", agent_id).eq("user_id", userId).single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agente non trovato" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━ Context Injection (Universal) ━━━
    let contextBlock = "";
    try {
      // 1. Profilo utente
      const { data: settings } = await supabase.from("app_settings").select("key, value").like("key", "ai_%");
      if (settings?.length) {
        contextBlock += "\n\n--- PROFILO UTENTE ---\n";
        for (const s of settings) { const label = s.key.replace("ai_", "").replace(/_/g, " ").toUpperCase(); if (s.value) contextBlock += `${label}: ${s.value}\n`; }
      }

      // 1b. Timing & scheduling config
      const timingKeys = ["email_send_delay","email_batch_size","whatsapp_send_delay","linkedin_send_delay","scraping_base_delay","deep_search_delay","agent_cycle_interval","agent_max_actions_per_cycle","agent_cooldown_after_error","agent_work_start_hour","agent_work_end_hour","agent_work_days","agent_require_approval"];
      const { data: timingSettings } = await supabase.from("app_settings").select("key, value").in("key", timingKeys);
      if (timingSettings?.length) {
        contextBlock += "\n--- TIMING & SCHEDULING ---\n";
        for (const s of timingSettings) { if (s.value) contextBlock += `${s.key}: ${s.value}\n`; }
        contextBlock += "IMPORTANTE: Rispetta SEMPRE questi timing nelle operazioni. Non superare il max azioni per ciclo. Opera solo negli orari di lavoro configurati.\n";
        const approvalSetting = timingSettings.find(s => s.key === "agent_require_approval");
        if (approvalSetting?.value === "true") {
          contextBlock += "APPROVAZIONE OBBLIGATORIA: Ogni azione (email, WhatsApp, LinkedIn) DEVE essere messa in coda con status 'pending' per approvazione umana. Non eseguire direttamente.\n";
        }
      }

      // 2. Memoria operativa L2/L3
      const { data: memories } = await supabase.from("ai_memory").select("content, memory_type, tags, level, importance")
        .eq("user_id", userId).in("level", [2, 3]).order("importance", { ascending: false }).limit(10);
      if (memories?.length) {
        contextBlock += "\n--- MEMORIA OPERATIVA ---\n";
        for (const m of memories) contextBlock += `- [L${m.level}/${m.memory_type}] ${m.content}\n`;
      }

      // 3. KB globale COMPLETA (tutte le entries attive, non solo top 5)
      const { data: kbEntries } = await supabase.from("kb_entries").select("title, content, chapter, category")
        .eq("user_id", userId).eq("is_active", true).order("priority", { ascending: false });
      if (kbEntries?.length) {
        contextBlock += "\n--- KNOWLEDGE BASE GLOBALE ---\n";
        for (const k of kbEntries) contextBlock += `### ${k.title}\n${k.content.substring(0, 800)}\n\n`;
      }

      // 4. Prompt Operativi (tutti, come fa ai-assistant)
      const { data: opPrompts } = await supabase.from("operative_prompts").select("name, objective, procedure, criteria, tags, priority")
        .eq("user_id", userId).eq("is_active", true).order("priority", { ascending: false });
      if (opPrompts?.length) {
        contextBlock += "\n--- PROMPT OPERATIVI ---\n";
        for (const p of opPrompts) {
          contextBlock += `### ${p.name} (priorità: ${p.priority})\n`;
          if (p.objective) contextBlock += `Obiettivo: ${p.objective}\n`;
          if (p.procedure) contextBlock += `Procedura: ${p.procedure.substring(0, 300)}\n`;
          if (p.criteria) contextBlock += `Criteri: ${p.criteria.substring(0, 200)}\n`;
          contextBlock += "\n";
        }
      }

      // 5. Team Roster — tutti gli agenti con stats
      const { data: allAgents } = await supabase.from("agents").select("id, name, role, is_active, stats, avatar_emoji")
        .eq("user_id", userId);
      if (allAgents?.length) {
        // Count client assignments per agent
        const { data: allAssignments } = await supabase.from("client_assignments").select("agent_id, source_id")
          .eq("user_id", userId);
        const assignMap = new Map<string, number>();
        if (allAssignments) {
          for (const a of allAssignments) assignMap.set(a.agent_id, (assignMap.get(a.agent_id) || 0) + 1);
        }
        // Count active tasks per agent
        const { data: activeTasks } = await supabase.from("agent_tasks").select("agent_id, status")
          .eq("user_id", userId).in("status", ["pending", "running"]);
        const taskMap = new Map<string, number>();
        if (activeTasks) {
          for (const t of activeTasks) taskMap.set(t.agent_id, (taskMap.get(t.agent_id) || 0) + 1);
        }

        contextBlock += "\n--- TEAM AGENTI ---\n";
        for (const a of allAgents) {
          const s = a.stats as any || {};
          const clients = assignMap.get(a.id) || 0;
          const tasks = taskMap.get(a.id) || 0;
          const self = a.id === agent_id ? " ← TU" : "";
          contextBlock += `- ${a.avatar_emoji} ${a.name} (${a.role}) ${a.is_active ? "✅" : "⏸"} — ${clients} clienti, ${tasks} task attivi, ${s.tasks_completed || 0} completati${self}\n`;
        }
      }

      // 6. Propri clienti assegnati
      const { data: myClients } = await supabase.from("client_assignments").select("source_id, source_type, assigned_at")
        .eq("agent_id", agent_id).eq("user_id", userId);
      if (myClients?.length) {
        contextBlock += `\n--- I TUOI CLIENTI ASSEGNATI (${myClients.length}) ---\n`;
        contextBlock += `Tipi: ${myClients.filter(c => c.source_type === 'partner').length} partner, ${myClients.filter(c => c.source_type === 'contact').length} contatti\n`;
      }

      // 7. Task attivi di TUTTI i colleghi (visibilità cross-team)
      const { data: teamTasks } = await supabase.from("agent_tasks").select("agent_id, task_type, description, status")
        .eq("user_id", userId).in("status", ["pending", "running"]).order("created_at", { ascending: false }).limit(20);
      if (teamTasks?.length) {
        contextBlock += "\n--- TASK ATTIVI TEAM ---\n";
        const agentNameMap = new Map<string, string>();
        if (allAgents) for (const a of allAgents) agentNameMap.set(a.id, a.name);
        for (const t of teamTasks) {
          const who = agentNameMap.get(t.agent_id) || "?";
          contextBlock += `- [${t.status}] ${who}: ${t.description.substring(0, 100)}\n`;
        }
      }

      // 8. Storico missioni
      try {
        const { data: missions } = await supabase.from("outreach_missions").select("title, status, channel, total_contacts, processed_contacts, target_filters, ai_summary")
          .eq("user_id", userId).order("created_at", { ascending: false }).limit(5);
        if (missions?.length) {
          contextBlock += "\n--- STORICO MISSIONI ---\n";
          for (const m of missions) { const f = m.target_filters as any; contextBlock += `- "${m.title}" [${m.status}] ${m.channel} — ${m.processed_contacts}/${m.total_contacts} — Paesi: ${f?.countries?.join(", ") || "N/D"}\n`; }
        }
      } catch (_) { /* outreach_missions may not exist */ }

      // 9. Director-only: system_prompt di tutti gli agenti + prompt operativi completi
      if (agent.role === "account" || agent.role === "director") {
        if (allAgents?.length) {
          contextBlock += "\n--- PROMPT AGENTI (Director View) ---\n";
          for (const a of allAgents) {
            if (a.id === agent_id) continue;
            const { data: agentDetail } = await supabase.from("agents").select("system_prompt").eq("id", a.id).single();
            if (agentDetail?.system_prompt) {
              contextBlock += `\n### ${a.name} (${a.role})\n${agentDetail.system_prompt.substring(0, 500)}\n...\n`;
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

    } catch (e) { console.error("Context injection error:", e); }

    // Build system prompt
    let systemPrompt = agent.system_prompt || "Sei un agente AI.";
    systemPrompt += contextBlock;
    systemPrompt += `\n\nACCESSO SISTEMA:
- Hai accesso COMPLETO a: tutti i tool operativi, KB globale, prompt operativi, team roster, storico attività dei colleghi, i tuoi clienti assegnati.
- Consulta la KB e i prompt operativi prima di agire.
- Usa search_memory per recuperare decisioni e contesto storico.
- I tuoi clienti assegnati sono nel contesto sopra. Usa list_agent_tasks per i tuoi task.
- Puoi vedere le attività di TUTTI i colleghi per coordinamento.
- Le regole commerciali e di governance sono nella Knowledge Base e nei Prompt Operativi — seguile.

GUARDRAIL OPERATIVI:
- Una comunicazione per sede ogni 7 giorni
- Analizza sempre la storia interazioni prima di agire
- Differenzia l'approccio in base alla tipologia interlocutore (partner vs cliente)
- Ogni azione deve far avanzare il lead nel funnel

Rispondi SEMPRE in italiano. Usa markdown per formattare le risposte. Sei un agente operativo che agisce sul database reale — non simulare, esegui le azioni.`;
    const kb = agent.knowledge_base as Array<{ title: string; content: string }> | null;
    if (kb?.length) {
      systemPrompt += "\n\n--- KNOWLEDGE BASE ---\n";
      for (const entry of kb) systemPrompt += `\n### ${entry.title}\n${entry.content}\n`;
    }

    // Filter tools
    const assignedTools = (agent.assigned_tools as string[]) || [];
    const agentTools = assignedTools.map((name: string) => ALL_TOOLS[name]).filter(Boolean);

    // AI config
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
    const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
    const fallbackModels = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "openai/gpt-5-mini"];

    // ━━━ CHAT MODE ━━━
    if (chat_messages && Array.isArray(chat_messages)) {
      const allMessages = [
        { role: "system", content: systemPrompt },
        ...chat_messages.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      let response: Response | null = null;
      for (const model of fallbackModels) {
        response = await fetch(aiUrl, { method: "POST", headers: aiHeaders, body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }) });
        if (response.ok) break;
        await response.text();
      }

      if (!response || !response.ok) {
        return new Response(JSON.stringify({ error: "Errore AI", response: "Mi dispiace, tutti i modelli sono temporaneamente non disponibili." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let result = await response.json();
      let msg = result.choices?.[0]?.message;

      let iterations = 0;
      while (msg?.tool_calls?.length && iterations < 8) {
        iterations++;
        const toolResults = [];
        for (const tc of msg.tool_calls) {
          console.log(`[Agent ${agent.name}] Tool: ${tc.function.name}`);
          const args = JSON.parse(tc.function.arguments || "{}");
          const toolResult = await executeTool(tc.function.name, args, userId, authHeader, { agent_id });
          console.log(`[Agent ${agent.name}] Result:`, JSON.stringify(toolResult).substring(0, 300));
          toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
        }
        allMessages.push(msg);
        allMessages.push(...toolResults);

        let loopOk = false;
        for (const model of fallbackModels) {
          response = await fetch(aiUrl, { method: "POST", headers: aiHeaders, body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }) });
          if (response!.ok) { loopOk = true; break; }
          await response!.text();
        }
        if (!loopOk) break;
        result = await response!.json();
        msg = result.choices?.[0]?.message;
      }

      return new Response(JSON.stringify({ response: msg?.content || "Nessuna risposta." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ━━━ TASK EXECUTION MODE ━━━
    if (task_id) {
      const { data: task, error: taskErr } = await supabase.from("agent_tasks").select("*").eq("id", task_id).eq("user_id", userId).single();
      if (taskErr || !task) {
        return new Response(JSON.stringify({ error: "Task non trovato" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("agent_tasks").update({ status: "running", started_at: new Date().toISOString() }).eq("id", task_id);

      const taskPrompt = `${systemPrompt}\n\n--- COMPITO ASSEGNATO ---\nTipo: ${task.task_type}\nDescrizione: ${task.description}\nFiltri target: ${JSON.stringify(task.target_filters)}\n\nEsegui il compito usando i tool disponibili. Agisci concretamente sul database. Restituisci un riepilogo delle azioni eseguite e dei risultati.`;
      const allMessages = [{ role: "system", content: taskPrompt }, { role: "user", content: "Esegui il compito assegnato." }];

      let response: Response | null = null;
      for (const model of fallbackModels) {
        response = await fetch(aiUrl, { method: "POST", headers: aiHeaders, body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }) });
        if (response.ok) break;
        await response.text();
      }

      let resultSummary = "Esecuzione completata.";
      let taskStatus = "completed";

      if (response && response.ok) {
        let result = await response.json();
        let msg = result.choices?.[0]?.message;
        let iterations = 0;
        while (msg?.tool_calls?.length && iterations < 10) {
          iterations++;
          const toolResults = [];
          for (const tc of msg.tool_calls) {
            console.log(`[Agent ${agent.name} Task] Tool: ${tc.function.name}`);
            const args = JSON.parse(tc.function.arguments || "{}");
            const toolResult = await executeTool(tc.function.name, args, userId, authHeader, { agent_id });
            toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
          }
          allMessages.push(msg);
          allMessages.push(...toolResults);
          let loopOk = false;
          for (const model of fallbackModels) {
            response = await fetch(aiUrl, { method: "POST", headers: aiHeaders, body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }) });
            if (response!.ok) { loopOk = true; break; }
            await response!.text();
          }
          if (!loopOk) { taskStatus = "failed"; resultSummary = "Errore AI durante l'esecuzione."; break; }
          result = await response!.json();
          msg = result.choices?.[0]?.message;
        }
        if (msg?.content) resultSummary = msg.content;
      } else {
        taskStatus = "failed";
        resultSummary = "Errore durante l'esecuzione del task.";
      }

      const currentLog = (task.execution_log as any[]) || [];
      await supabase.from("agent_tasks").update({
        status: taskStatus, result_summary: resultSummary.slice(0, 5000),
        execution_log: [...currentLog, { ts: new Date().toISOString(), result: resultSummary.slice(0, 2000) }] as any,
        completed_at: new Date().toISOString(),
      }).eq("id", task_id);

      // Update agent stats: only increment the correct counter based on outcome
      const stats = (agent.stats as any) || {};
      const updatedStats = { ...stats };
      if (taskStatus === "completed") {
        updatedStats.tasks_completed = (stats.tasks_completed || 0) + 1;
      } else {
        updatedStats.tasks_failed = (stats.tasks_failed || 0) + 1;
      }
      await supabase.from("agents").update({
        stats: updatedStats as any,
        updated_at: new Date().toISOString(),
      }).eq("id", agent_id);

      return new Response(JSON.stringify({ success: taskStatus === "completed", result: resultSummary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Specificare chat_messages o task_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("agent-execute error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Errore interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
