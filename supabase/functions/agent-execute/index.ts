import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight, supabase } from "./shared.ts";
import { ALL_TOOLS } from "./toolDefs.ts";
import { executeTool } from "./toolHandlers.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  const metrics = startMetrics("agent-execute");

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
          status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }
      userId = tokenUser.id;
    } else {
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Non autenticato" }), {
          status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
    }

    // Rate limiting
    const rl = checkRateLimit(`agent-execute:${userId}`, { maxTokens: 15, refillRate: 0.25 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    const body = await req.json();
    const { agent_id, task_id, chat_messages } = body;

    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id richiesto" }), {
        status: 400, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Load agent
    const { data: agent, error: agentErr } = await supabase
      .from("agents").select("*").eq("id", agent_id).eq("user_id", userId).single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agente non trovato" }), {
        status: 404, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // ━━━ Context Injection (Universal) ━━━
    let contextBlock = "";
    try {
      // 1. Profilo utente
      const { data: settings } = await supabase.from("app_settings").select("key, value").eq("user_id", userId).like("key", "ai_%");
      if (settings?.length) {
        contextBlock += "\n\n--- PROFILO UTENTE ---\n";
        for (const s of settings) { const label = s.key.replace("ai_", "").replace(/_/g, " ").toUpperCase(); if (s.value) contextBlock += `${label}: ${s.value}\n`; }
      }

      // 1b. Timing & scheduling config
      const { data: timingSettings } = await supabase.from("app_settings").select("key, value").eq("user_id", userId).like("key", "agent_%").or("key.like.email_%,key.like.whatsapp_%,key.like.linkedin_%,key.like.scraping_%,key.like.deep_search_%");
      if (timingSettings?.length) {
        contextBlock += "\n--- TIMING & SCHEDULING ---\n";
        for (const s of timingSettings) { if (s.value) contextBlock += `${s.key}: ${s.value}\n`; }
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

      // 3. KB globale (top 50 per priority, con contenuto troncato)
      const { data: kbEntries } = await supabase.from("kb_entries").select("title, content, chapter, category")
        .eq("user_id", userId).eq("is_active", true).order("priority", { ascending: false }).limit(50);
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

        // ═══ GAP 4: Carica email recenti dei clienti assegnati ═══
        const clientEmails: string[] = [];
        for (const client of myClients.slice(0, 10)) {
          let email: string | null = null;
          if (client.source_type === "partner") {
            const { data } = await supabase.from("partners").select("email").eq("id", client.source_id).single();
            email = data?.email || null;
          } else if (client.source_type === "contact" || client.source_type === "imported_contact") {
            const { data } = await supabase.from("imported_contacts").select("email").eq("id", client.source_id).single();
            email = data?.email || null;
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
              const addr = msg.from_address?.toLowerCase() || "";
              if (!byClient.has(addr)) byClient.set(addr, []);
              byClient.get(addr)!.push(msg);
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
              const addr = c.email_address?.toLowerCase() || "";
              if (!bySender.has(addr)) bySender.set(addr, []);
              bySender.get(addr)!.push(c);
            }
            for (const [addr, classes] of bySender) {
              const latest = classes[0];
              contextBlock += `${addr}: ${latest.category} (${Math.round((latest.confidence || 0) * 100)}%) — sentiment: ${latest.sentiment} — ${latest.ai_summary || ""}\n`;
            }
          }
        }
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
          const otherAgentIds = allAgents.filter((a: any) => a.id !== agent_id).map((a: any) => a.id);
          if (otherAgentIds.length > 0) {
            const { data: agentDetails } = await supabase.from("agents").select("id, name, role, system_prompt").in("id", otherAgentIds);
            if (agentDetails?.length) {
              contextBlock += "\n--- PROMPT AGENTI (Director View) ---\n";
              for (const ad of agentDetails) {
                if (ad.system_prompt) {
                  contextBlock += `\n### ${ad.name} (${ad.role})\n${ad.system_prompt.substring(0, 500)}\n...\n`;
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

Rispondi nella lingua configurata dall'utente. Usa markdown per formattare le risposte. Sei un agente operativo che agisce sul database reale — non simulare, esegui le azioni.`;
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45_000);
        try {
          response = await fetch(aiUrl, { method: "POST", headers: aiHeaders, body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }), signal: controller.signal });
          if (response.ok) { clearTimeout(timeoutId); break; }
          await response.text();
        } catch (e: any) {
          if (e.name === "AbortError") console.warn(`[agent-execute] Timeout on model ${model}`);
          else throw e;
        } finally { clearTimeout(timeoutId); }
      }

      if (!response || !response.ok) {
        return new Response(JSON.stringify({ error: "Errore AI", response: "Mi dispiace, tutti i modelli sono temporaneamente non disponibili." }), {
          status: 200, headers: { ...dynCors, "Content-Type": "application/json" },
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
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // ━━━ TASK EXECUTION MODE ━━━
    if (task_id) {
      const { data: task, error: taskErr } = await supabase.from("agent_tasks").select("*").eq("id", task_id).eq("user_id", userId).single();
      if (taskErr || !task) {
        return new Response(JSON.stringify({ error: "Task non trovato" }), { status: 404, headers: { ...dynCors, "Content-Type": "application/json" } });
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

      // Update agent stats atomically via RPC
      await supabase.rpc("increment_agent_stat", {
        p_agent_id: agent_id,
        p_stat_key: taskStatus === "completed" ? "tasks_completed" : "tasks_failed",
      });

      return new Response(JSON.stringify({ success: taskStatus === "completed", result: resultSummary }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Specificare chat_messages o task_id" }), {
      status: 400, headers: { ...dynCors, "Content-Type": "application/json" },
    });

  } catch (err) {
    logEdgeError("agent-execute", err);
    endMetrics(metrics, false, 500);
    console.error("agent-execute error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Errore interno" }), {
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
