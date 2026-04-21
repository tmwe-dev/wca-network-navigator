import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight, supabase } from "./shared.ts";
import { ALL_TOOLS } from "./toolDefs.ts";
import { executeTool } from "./toolHandlers.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { assembleContext, getContextBudget } from "../_shared/tokenBudget.ts";
import { compressMessages } from "../_shared/messageCompression.ts";
import { loadCommercialDoctrine } from "../_shared/commercialDoctrine.ts";

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

      // ── LOVABLE-66: Doctrine moved from hardcoded blocks to KB loader ──
      // The 3 inline blocks (commercial doctrine, whatsapp gate, cadence)
      // are now sourced from kb_entries (categories: system_doctrine,
      // system_core, commercial_rules) with a minimal hardcoded fallback.
      // See `_shared/commercialDoctrine.ts`.

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
          const s = (a.stats || {}) as Record<string, unknown>;
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
          for (const m of missions) { const f = m.target_filters as Record<string, unknown>; contextBlock += `- "${m.title}" [${m.status}] ${m.channel} — ${m.processed_contacts}/${m.total_contacts} — Paesi: ${f?.countries?.join(", ") || "N/D"}\n`; }
        }
      } catch (_) { /* outreach_missions may not exist */ }

      // 9. Director-only: system_prompt di tutti gli agenti + prompt operativi completi
      if (agent.role === "account" || agent.role === "director") {
        if (allAgents?.length) {
          const otherAgentIds = allAgents.filter((a: Record<string, unknown>) => a.id !== agent_id).map((a: { id: string }) => a.id);
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

    // ━━━ Learning Loop: inject past decisions + corrections ━━━
    let learningBlock = "";
    try {
      const { data: decisions } = await supabase
        .from("ai_decision_log")
        .select("decision_type, context, outcome, user_correction, created_at")
        .eq("agent_id", agent_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (decisions?.length) {
        learningBlock += "\n\n--- APPRENDIMENTO DA DECISIONI PASSATE ---\n";
        for (const d of decisions) {
          const date = new Date(d.created_at).toLocaleDateString("it-IT");
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
    } catch (_) { /* ai_decision_log may not exist */ }

    // ━━━ Mission Context (if running within autopilot) ━━━
    let missionBlock = "";
    try {
      const missionId = body.mission_id;
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
    } catch (_) { /* mission may not exist */ }

    // ━━━ Load Agent Persona ━━━
    let persona: Record<string, unknown> | null = null;
    try {
      const { data: p } = await supabase
        .from("agent_personas")
        .select("*")
        .eq("agent_id", agent_id)
        .eq("user_id", userId)
        .maybeSingle();
      persona = p;
    } catch (_) { /* table may not exist yet */ }

    // ━━━ Load persona-filtered KB ━━━
    let personaKbEntries: Array<{ title: string; content: string; chapter?: string; category?: string }> = [];
    if (persona) {
      try {
        const { data: kbLinks } = await supabase
          .from("agent_knowledge_links")
          .select("kb_entry_id, priority")
          .eq("agent_id", agent_id)
          .eq("user_id", userId)
          .order("priority", { ascending: false });
        if (kbLinks?.length) {
          const kbIds = kbLinks.map((l: { kb_entry_id: string }) => l.kb_entry_id);
          const { data: entries } = await supabase
            .from("kb_entries")
            .select("title, content, chapter, category")
            .in("id", kbIds)
            .eq("is_active", true);
          if (entries) personaKbEntries = entries;
        }
      } catch (_) { /* table may not exist yet */ }
    }

    // ━━━ Build system prompt with persona ━━━
    let systemPrompt = agent.system_prompt || "Sei un agente AI.";

    if (persona) {
      const tone = persona.tone as string || "professional";
      const lang = persona.language as string || "it";
      const styleRules = persona.style_rules as string[] || [];
      const vocDo = persona.vocabulary_do as string[] || [];
      const vocDont = persona.vocabulary_dont as string[] || [];
      const examples = persona.example_messages as Array<{ role: string; content: string }> || [];
      const signature = persona.signature_template as string || "";

      systemPrompt += `\n\n--- PERSONA ---`;
      systemPrompt += `\nTONO: ${tone}`;
      systemPrompt += `\nLINGUA: ${lang}`;
      if (styleRules.length) systemPrompt += `\nSTILE:\n${styleRules.map(r => `- ${r}`).join("\n")}`;
      if (vocDo.length) systemPrompt += `\nUSA SEMPRE: ${vocDo.join(", ")}`;
      if (vocDont.length) systemPrompt += `\nEVITA SEMPRE: ${vocDont.join(", ")}`;
      if (examples.length) {
        systemPrompt += `\nESEMPI MESSAGGI:`;
        for (const ex of examples.slice(0, 5)) {
          systemPrompt += `\n[${ex.role}]: ${ex.content}`;
        }
      }
      if (signature) systemPrompt += `\nFIRMA: ${signature}`;
    }

    // ━━━ LOVABLE-66: DOTTRINA COMMERCIALE — KB-driven con fallback ━━━
    const doctrineLoaded = await loadCommercialDoctrine(supabase, userId);
    const commercialDoctrineBlock = doctrineLoaded.text;
    console.log(`[agent-execute] Doctrine source=${doctrineLoaded.source} entries=${doctrineLoaded.entriesLoaded}`);

    // ━━━ Token-budget aware context assembly (parità con ai-assistant) ━━━
    const baseDoctrine = systemPrompt + `\n\nACCESSO SISTEMA:
- Hai accesso COMPLETO a: tutti i tool operativi, KB globale, prompt operativi, team roster, storico attività dei colleghi, i tuoi clienti assegnati.
- Consulta la KB e i prompt operativi prima di agire.
- Usa search_memory per recuperare decisioni e contesto storico.
- I tuoi clienti assegnati sono nel contesto sopra. Usa list_agent_tasks per i tuoi task.
- Puoi vedere le attività di TUTTI i colleghi per coordinamento.
- Le regole commerciali e di governance sono nella Knowledge Base e nei Prompt Operativi — seguile.

Rispondi nella lingua configurata dall'utente. Usa markdown per formattare le risposte. Sei un agente operativo che agisce sul database reale — non simulare, esegui le azioni.`;

    const personaKbBlock = personaKbEntries.length
      ? "\n\n--- KNOWLEDGE BASE (AGENTE) ---\n" + personaKbEntries.map(k => `### ${k.title}\n${k.content.substring(0, 800)}\n`).join("\n")
      : "";
    const agentKb = agent.knowledge_base as Array<{ title: string; content: string }> | null;
    const agentKbBlock = agentKb?.length
      ? "\n\n--- KNOWLEDGE BASE ---\n" + agentKb.map(e => `### ${e.title}\n${e.content}`).join("\n")
      : "";

    const contextBudget = getContextBudget("google/gemini-3-flash-preview");
    const assembled = assembleContext([
      { key: "doctrine", content: baseDoctrine, priority: 100, minTokens: 500 },
      { key: "commercial_doctrine", content: commercialDoctrineBlock, priority: 98, minTokens: 800 },
      { key: "mission", content: missionBlock, priority: 95, minTokens: 200 },
      { key: "persona_kb", content: personaKbBlock, priority: 90, minTokens: 300 },
      { key: "context", content: contextBlock, priority: 80, minTokens: 500 },
      { key: "learning", content: learningBlock, priority: 70, minTokens: 200 },
      { key: "agent_kb", content: agentKbBlock, priority: 60, minTokens: 300 },
    ], contextBudget);
    console.log(`[agent-execute] Context: ${assembled.stats.totalTokens}/${contextBudget} tokens, included=${assembled.stats.included.join(",")}, truncated=${assembled.stats.truncated.join(",") || "none"}, dropped=${assembled.stats.dropped.join(",") || "none"}`);
    systemPrompt = assembled.text;

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
      // Compress long histories (parità con ai-assistant: soglia 8 messaggi)
      let processedMessages = chat_messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })) as Record<string, unknown>[];
      if (processedMessages.length > 8) {
        try {
          const apiKey = Deno.env.get("LOVABLE_API_KEY") || "";
          const compressed = await compressMessages(supabase as Parameters<typeof compressMessages>[0], processedMessages, apiKey, userId);
          console.log(`[agent-execute] Compressed ${processedMessages.length} → ${compressed.length} messages`);
          processedMessages = compressed;
        } catch (compressErr) {
          console.warn("[agent-execute] Compression failed, using original:", compressErr);
        }
      }
      const allMessages = [
        { role: "system", content: systemPrompt },
        ...processedMessages,
      ];

      let response: Response | null = null;
      for (const model of fallbackModels) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45_000);
        try {
          response = await fetch(aiUrl, { method: "POST", headers: aiHeaders, body: JSON.stringify({ model, messages: allMessages, ...(agentTools.length > 0 ? { tools: agentTools } : {}), max_tokens: 4000 }), signal: controller.signal });
          if (response.ok) { clearTimeout(timeoutId); break; }
          await response.text();
        } catch (e: unknown) {
          if ((e as { name?: string }).name === "AbortError") console.warn(`[agent-execute] Timeout on model ${model}`);
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

      // ━━━ K6: Handle special task_types (state_transition, sequence_step) ━━━
      if (task.task_type === "state_transition") {
        const filters = (task.target_filters || {}) as Record<string, unknown>;
        const partnerId = filters.partner_id as string | undefined;
        const toState = filters.to_state as string | undefined;
        const fromState = (filters.from_state as string) || "unknown";
        const trigger = (filters.trigger as string) || "Transizione manuale approvata";

        if (!partnerId || !toState) {
          await supabase.from("agent_tasks").update({
            status: "failed",
            completed_at: new Date().toISOString(),
            result_summary: "target_filters incompleti (partner_id/to_state mancanti)",
          }).eq("id", task_id);
          return new Response(JSON.stringify({ error: "task_invalid", message: "partner_id/to_state mancanti" }), {
            status: 400, headers: { ...dynCors, "Content-Type": "application/json" },
          });
        }

        const { applyTransition } = await import("../_shared/stateTransitions.ts");
        const applied = await applyTransition(supabase, partnerId, userId, {
          shouldTransition: true,
          from: fromState,
          to: toState,
          trigger,
          autoApply: true,
        });

        await supabase.from("agent_tasks").update({
          status: applied ? "completed" : "failed",
          completed_at: new Date().toISOString(),
          result_summary: applied
            ? `Stato partner ${partnerId}: ${fromState} → ${toState}. Trigger: ${trigger}`
            : `Transizione fallita per partner ${partnerId}`,
        }).eq("id", task_id);

        endMetrics(metrics, applied ? 200 : 500);
        return new Response(JSON.stringify({
          success: applied,
          action: "state_transition",
          partner_id: partnerId,
          from_state: fromState,
          new_state: toState,
        }), { headers: { ...dynCors, "Content-Type": "application/json" } });
      }

      // sequence_step → arricchisce il prompt con istruzioni specifiche, poi delega all'AI
      let sequenceInstructions = "";
      if (task.task_type === "sequence_step") {
        const filters = (task.target_filters || {}) as Record<string, unknown>;
        const seqChannel = filters.channel as string | undefined;
        const seqAction = filters.action as string | undefined;
        const seqDay = filters.sequence_day as number | undefined;
        const seqPartner = filters.partner_id as string | undefined;
        sequenceInstructions = `\n\n--- SEQUENCE STEP ---\nGiorno ${seqDay} della sequenza di engagement.\nCanale: ${seqChannel}.\nAzione: ${seqAction}.\nPartner: ${seqPartner}.\nGenera e registra il messaggio appropriato per questo step usando i tool send_email/send_whatsapp/send_linkedin_message. Rispetta TONO e LUNGHEZZA del canale.`;
      }

      const taskPrompt = `${systemPrompt}\n\n--- COMPITO ASSEGNATO ---\nTipo: ${task.task_type}\nDescrizione: ${task.description}\nFiltri target: ${JSON.stringify(task.target_filters)}${sequenceInstructions}\n\nEsegui il compito usando i tool disponibili. Agisci concretamente sul database. Restituisci un riepilogo delle azioni eseguite e dei risultati.`;
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

      const currentLog = (task.execution_log as Array<Record<string, unknown>>) || [];
      await supabase.from("agent_tasks").update({
        status: taskStatus, result_summary: resultSummary.slice(0, 5000),
        execution_log: [...currentLog, { ts: new Date().toISOString(), result: resultSummary.slice(0, 2000) }] as unknown as Record<string, unknown>,
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
