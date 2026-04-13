/**
 * ai-assistant/index.ts — Slim orchestrator.
 * Imports logic from: systemPrompt, toolDefinitions, toolExecutors, contextLoader.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { getContextBudget, assembleContext, estimateTokens } from "../_shared/tokenBudget.ts";
import { escapeLike } from "../_shared/sqlEscape.ts";
import { createReadHandlers } from "../_shared/toolHandlersRead.ts";
import { createWriteHandlers } from "../_shared/toolHandlersWrite.ts";
import { createEnterpriseHandlers } from "../_shared/toolHandlersEnterprise.ts";

import { composeSystemPrompt } from "./systemPrompt.ts";
import { TOOL_DEFINITIONS } from "./toolDefinitions.ts";
import { executeTool } from "./toolExecutors.ts";
import type { ToolExecutorDeps } from "./toolExecutors.ts";
import {
  resolveAiProvider,
  consumeCredits,
  loadUserProfile,
  loadMissionHistory,
  loadKBContext,
  loadOperativePrompts,
  loadMemoryContext,
  loadSystemDoctrine,
  loadRecentEmailContext,
  compressMessages,
} from "./contextLoader.ts";
import { extractContextTags } from "../_shared/contextTagExtractor.ts";
import type { ConversationContext } from "../_shared/contextTagExtractor.ts";

// ━━━ Service-level Supabase client ━━━
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const readH = createReadHandlers(supabase);
const writeH = createWriteHandlers(supabase);
const entH = createEnterpriseHandlers(supabase);

const toolDeps: ToolExecutorDeps = { supabase, readH, writeH, entH };

// ── Repetition detection ──
function detectRepetitions(messages: Array<{ role?: string; content?: string }>): string | null {
  const userMessages = messages.filter(m => m.role === "user" && typeof m.content === "string").map(m => (m.content as string).toLowerCase().trim());
  if (userMessages.length < 2) return null;

  const last = userMessages[userMessages.length - 1];
  const previous = userMessages.slice(0, -1);
  const lastWords = new Set(last.split(/\s+/).filter(w => w.length > 3));

  for (let i = previous.length - 1; i >= Math.max(0, previous.length - 4); i--) {
    const prevWords = new Set(previous[i].split(/\s+/).filter(w => w.length > 3));
    const overlap = [...lastWords].filter(w => prevWords.has(w)).length;
    const similarity = overlap / Math.max(lastWords.size, prevWords.size, 1);
    if (similarity > 0.6) {
      return `⚠️ ATTENZIONE: L'utente sta ripetendo una richiesta simile. La risposta precedente probabilmente non era soddisfacente. Rispondi in modo PIÙ CONCRETO e DIRETTO. Se prima hai chiesto chiarimenti, ORA agisci con la migliore interpretazione. Non ripetere la stessa struttura di risposta.`;
    }
  }

  const frustrationPatterns = [
    /no,?\s*(intendo|volevo|dico)/i, /ti ho (già |)detto/i, /come (ti )?ho (già )?detto/i,
    /ripeto/i, /non (hai |)(capito|capisci)/i, /ancora una volta/i, /di nuovo/i,
  ];
  for (const pattern of frustrationPatterns) {
    if (pattern.test(last)) {
      return `⚠️ L'utente mostra frustrazione — la risposta precedente non ha centrato il punto. Rispondi in modo diretto e concreto, senza chiedere chiarimenti.`;
    }
  }
  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const metrics = startMetrics("ai-assistant");
  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return edgeError("AUTH_REQUIRED", "Unauthorized");
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return edgeError("AUTH_INVALID", "Unauthorized");
    }
    const userId: string = claimsData.claims.sub as string;

    // ── Rate limiting ──
    const rl = checkRateLimit(`ai-assistant:${userId}`, { maxTokens: 15, refillRate: 0.25 });
    if (!rl.allowed) {
      return rateLimitResponse(rl, dynCors);
    }

    // ── AI Provider + credit gate ──
    const provider = await resolveAiProvider(supabase, userId);
    if (!provider.isUserKey) {
      const { data: credits } = await supabase.from("user_credits").select("balance").eq("user_id", userId).single();
      if (credits && credits.balance <= 0) {
        return new Response(
          JSON.stringify({ error: "Crediti AI esauriti. Acquista crediti extra o aggiungi le tue chiavi API nelle impostazioni." }),
          { status: 402, headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Parse request ──
    const { messages, context, mode, scope } = await req.json();

    // ── Detect conversational mode ──
    const isConversational: boolean =
      mode === "conversational" ||
      context?.conversational === true ||
      context?.mode === "conversational";

    const lastUserMsg: string | undefined = Array.isArray(messages)
      ? [...messages].reverse().find((m: Record<string, unknown>) => m?.role === "user" && typeof m.content === "string")?.content as string | undefined
      : undefined;

    // ── Operator briefing + active workflow ──
    const operatorBriefing: string | undefined =
      typeof context?.operatorBriefing === "string" ? context.operatorBriefing : undefined;
    let activeWorkflowBlock = "";
    if (!isConversational && context?.partnerId && typeof context.partnerId === "string") {
      try {
        const { data: ws } = await supabase
          .from("partner_workflow_state")
          .select("current_gate, status, started_at, commercial_workflows(name, gates)")
          .eq("partner_id", context.partnerId)
          .eq("status", "active")
          .maybeSingle();
        if (ws) {
          const wf = (ws as Record<string, unknown>).commercial_workflows as Record<string, unknown> | undefined;
          if (wf) {
            const gates = Array.isArray(wf.gates) ? wf.gates : [];
            const cur = (gates[(ws as Record<string, unknown>).current_gate as number] || {}) as Record<string, unknown>;
            activeWorkflowBlock = `Workflow: ${wf.name}\nGate corrente: ${(ws as Record<string, unknown>).current_gate} — ${cur.name || "(senza nome)"}\nObiettivo gate: ${cur.objective || "(non definito)"}\nExit criteria:\n${(Array.isArray(cur.exit_criteria) ? (cur.exit_criteria as string[]).map((c: string) => "  • " + c).join("\n") : "  • (non definiti)")}\nIniziato: ${(ws as Record<string, unknown>).started_at}`;
          }
        }
      } catch (e: unknown) {
        console.warn("Workflow state load failed:", extractErrorMessage(e));
      }
    }

    // ── Build system prompt ──
    let systemPrompt: string;
    if (isConversational) {
      systemPrompt = `Sei LUCA, il Super Consulente Strategico del sistema WCA Network Navigator.

MODALITÀ CONVERSAZIONALE — Stai parlando a voce con l'utente.

IL TUO RUOLO:
Sei un partner strategico che ragiona, pianifica e consiglia
Discuti di strategie commerciali, priorità operative, opportunità di mercato
Proponi soluzioni concrete basate sui dati che conosci
NON leggere testi di email o messaggi — discutine il contenuto e la strategia
NON eseguire azioni operative (download, bulk update, invio email) — suggeriscile soltanto

STILE VOCALE:
Rispondi in italiano, tono professionale ma amichevole
Risposte BREVI: massimo 3-4 frasi per turno (verranno lette ad alta voce dal TTS)
Vai dritto al punto, niente formattazione markdown, niente tabelle, niente emoji
Se serve approfondire, chiedi se l'utente vuole i dettagli
Usa frasi naturali come in una conversazione dal vivo

COSA PUOI FARE:
Analizzare la situazione di un mercato/paese/partner
Proporre strategie di approccio commerciale
Consigliare priorità per la giornata
Discutere il tono e l'approccio di comunicazioni
Suggerire quale agente o funzione attivare per un task
Ragionare su pattern nei dati (paesi caldi, partner dormienti, opportunità)

COSA NON FARE:
Non leggere ad alta voce il corpo di email o messaggi
Non mostrare tabelle o liste lunghe
Non usare formattazione markdown (grassetto, intestazioni, elenchi puntati)
Non emettere blocchi STRUCTURED_DATA, OPERATIONS, UI_ACTIONS
Non eseguire tool di scrittura o modifica`;
    } else {
      systemPrompt = composeSystemPrompt({ operatorBriefing, activeWorkflow: activeWorkflowBlock });
    }

    // ── Extract context tags for KB loading ──
    const conversationContext: ConversationContext = {
      scope: scope || undefined,
      page: context?.currentPage || context?.page || undefined,
      partner_country: context?.partner_country || context?.country || context?.selectedCountry || undefined,
      channel: context?.channel || undefined,
      email_type: context?.email_type || undefined,
      partner_id: context?.partnerId || context?.partner_id || undefined,
      relationship_stage: context?.relationship_stage || undefined,
      last_user_message: lastUserMsg,
    };
    const ctxTags = extractContextTags(conversationContext);

    // ── Load all context in parallel ──
    let memoryContext: string, userProfile: string, kbContext: string, opPrompts: string, missionHistory: string, doctrineContext: string, emailContext: string;
    if (isConversational) {
      // Lightweight context for voice mode
      [memoryContext, userProfile, kbContext, doctrineContext, emailContext] = await Promise.all([
        loadMemoryContext(supabase, userId, lastUserMsg),
        loadUserProfile(supabase, userId),
        loadKBContext(supabase, lastUserMsg, userId, ctxTags),
        loadSystemDoctrine(supabase),
        loadRecentEmailContext(supabase, userId, lastUserMsg),
      ]);
      opPrompts = "";
      missionHistory = "";
    } else {
      [memoryContext, userProfile, kbContext, opPrompts, missionHistory, doctrineContext, emailContext] = await Promise.all([
        loadMemoryContext(supabase, userId, lastUserMsg),
        loadUserProfile(supabase, userId),
        loadKBContext(supabase, lastUserMsg, userId, ctxTags),
        loadOperativePrompts(supabase, userId),
        loadMissionHistory(supabase, userId),
        loadSystemDoctrine(supabase),
        loadRecentEmailContext(supabase, userId, lastUserMsg),
      ]);
    }

    // ── Dynamic token budget: assemble context by priority ──
    const contextBudget = getContextBudget(provider.model);
    const basePromptTokens = estimateTokens(systemPrompt);
    const availableBudget = Math.max(2000, contextBudget - basePromptTokens);

    const contextBlocks = [
      { key: "doctrine", content: doctrineContext, priority: 100, minTokens: 0 },
      { key: "profile", content: userProfile, priority: 90, minTokens: 100 },
      { key: "memory", content: memoryContext, priority: 80, minTokens: 200 },
      { key: "kb", content: kbContext, priority: 70, minTokens: 200 },
      { key: "email_context", content: emailContext, priority: 65, minTokens: 100 },
      { key: "operative_prompts", content: opPrompts, priority: 60, minTokens: 100 },
      { key: "mission_history", content: missionHistory, priority: 50, minTokens: 0 },
    ].filter(b => b.content?.trim());

    const { text: assembledContext, stats: budgetStats } = assembleContext(contextBlocks, availableBudget);
    if (assembledContext) systemPrompt += assembledContext;

    if (budgetStats.dropped.length > 0 || budgetStats.truncated.length > 0) {
      console.log(`[TOKEN-BUDGET] model=${provider.model} budget=${contextBudget} base=${basePromptTokens} available=${availableBudget} used=${budgetStats.totalTokens} included=${budgetStats.included.join(",")} truncated=${budgetStats.truncated.join(",")} dropped=${budgetStats.dropped.join(",")}`);
    }

    // ── Page/selection context injection ──
    if (context) {
      systemPrompt += "\n\nCONTESTO CORRENTE DELL'UTENTE:";
      if (context.currentPage) systemPrompt += `\nPagina attiva: ${context.currentPage}`;
      if (context.source === "partner_hub") {
        systemPrompt += `\nL'utente è nella Rubrica Partner.`;
        if (context.viewLevel) systemPrompt += ` Vista: ${context.viewLevel}.`;
        if (context.selectedCountry) systemPrompt += ` Paese selezionato: ${context.selectedCountry}.`;
        if (context.totalPartners !== undefined) systemPrompt += ` Partner visibili: ${context.totalPartners}.`;
        if (context.selectedCount) systemPrompt += ` Partner selezionati: ${context.selectedCount}.`;
      }
      if (context.selectedCountries?.length) {
        systemPrompt += `\nPaesi selezionati: ${context.selectedCountries.map((c: Record<string, unknown>) => `${c.name} (${c.code})`).join(", ")}.`;
      }
      if (context.filterMode && context.filterMode !== "all" && !context.filterMode.startsWith("/")) {
        const filterLabels: Record<string, string> = { todo: "paesi con dati incompleti", no_profile: "paesi con profili mancanti", missing: "paesi mai esplorati" };
        systemPrompt += `\nFiltro attivo: ${filterLabels[context.filterMode] || context.filterMode}.`;
      }

      if (context.currentPage === "/mission-builder") {
        systemPrompt += `\n\nMODALITÀ MISSION BUILDER — ISTRUZIONI SPECIALI:\nSei in modalità creazione missione. Il tuo ruolo è guidare l'utente passo dopo passo nella configurazione di una campagna di outreach. NON mostrare tutto subito — fai UNA domanda alla volta.\n\nFLUSSO CONVERSAZIONALE:\n1. Chiedi COSA vuole fare (email, WhatsApp, LinkedIn, deep search, contatto ex-clienti, etc.)\n2. Chiedi CHI contattare — usa i dati reali del database. Se l'utente dice un paese/regione, cerca i numeri reali.\n3. Quando devi far selezionare i paesi, includi nel messaggio: [WIDGET:country_select]\n4. Quando devi far scegliere il canale, includi: [WIDGET:channel_select]\n5. Per regolare i batch per paese: [WIDGET:slider_batch]\n6. Per opzioni deep search: [WIDGET:toggle_group]\n7. Per il riepilogo finale con lancio: [WIDGET:confirm_summary]\n\nIMPORTANTE:\n- NON assumere che sia sempre per-paese. Potrebbe essere per tipo azienda, rating, ex-clienti, biglietti da visita.\n- Usa i dati reali: interroga il database per dare numeri precisi.\n- Rispondi in modo SINTETICO — massimo 2-3 frasi + il widget. La voce leggerà solo le prime 2 frasi.\n- Conferma ogni scelta prima di procedere al passo successivo.\n- Se l'utente fornisce più info in una volta, elaborale tutte e proponi il widget appropriato.\n\nDATI DISPONIBILI:`;
        if (context.countryStats?.length) {
          const topCountries = context.countryStats.slice(0, 10).map((c: Record<string, unknown>) => `${c.name} (${c.count})`).join(", ");
          systemPrompt += `\nTop paesi nel DB: ${topCountries}. Totale paesi: ${context.countryStats.length}.`;
        }
        if (context.missionData) {
          const md = context.missionData;
          if (md.targets?.countries?.length) systemPrompt += `\nPaesi già selezionati: ${md.targets.countries.join(", ")}.`;
          if (md.channel) systemPrompt += `\nCanale scelto: ${md.channel}.`;
          if (md.deepSearch?.enabled) systemPrompt += `\nDeep Search attivo.`;
        }
      }
    }

    // ── Detect conversational repetitions ──
    if (Array.isArray(messages) && messages.length >= 2) {
      const repetitionWarning = detectRepetitions(messages);
      if (repetitionWarning) {
        systemPrompt += "\n\n" + repetitionWarning;
        // Fire-and-forget: save repetition as L1 memory
        if (userId) {
          const lastMsg = [...messages].reverse().find((m: Record<string, unknown>) => m.role === "user")?.content;
          supabase.from("ai_memory").insert({
            user_id: userId,
            memory_type: "conversation",
            content: `L'utente ha dovuto ripetere una richiesta. Ultima: "${String(lastMsg || "").substring(0, 200)}". Migliorare comprensione.`,
            tags: ["ripetizione", "feedback_implicito", "da_migliorare"],
            level: 1,
            importance: 3,
            confidence: 0.5,
            decay_rate: 0.02,
            source: "repetition_detection",
          }).then(() => {}).catch(() => {});
        }
      }
    }

    // ── Rolling summary compression ──
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || provider.apiKey;
    const compressedMessages = await compressMessages(supabase, messages, LOVABLE_KEY, userId);
    const allMessages: Record<string, unknown>[] = [{ role: "system", content: systemPrompt }, ...compressedMessages];

    // ── AI call with model fallback ──
    const aiHeaders = { Authorization: `Bearer ${provider.apiKey}`, "Content-Type": "application/json" };
    const activeTools = isConversational ? undefined : TOOL_DEFINITIONS;
    const fallbackModels = provider.isUserKey
      ? [provider.model]
      : isConversational
        ? ["google/gemini-2.5-flash", "openai/gpt-5-mini"]
        : [provider.model, "google/gemini-2.5-flash", "openai/gpt-5-mini"];

    let response: Response | null = null;
    for (const tryModel of fallbackModels) {
      console.log(`[AI] Trying model: ${tryModel}${isConversational ? " (conversational)" : ""}`);
      const fetchBody: Record<string, unknown> = { model: tryModel, messages: allMessages };
      if (activeTools) fetchBody.tools = activeTools;
      response = await fetch(provider.url, {
        method: "POST",
        headers: aiHeaders,
        body: JSON.stringify(fetchBody),
      });
      if (response.ok) {
        if (tryModel !== provider.model) console.log(`[AI] Fallback model ${tryModel} succeeded`);
        break;
      }
      const errStatus = response.status;
      const errText = await response.text();
      console.error(`AI gateway error (${tryModel}):`, errStatus, errText);
      if (errStatus === 429 || errStatus === 402) {
        const errorMsg = errStatus === 429 ? "Troppe richieste, riprova tra poco." : "Crediti AI esauriti.";
        return new Response(JSON.stringify({ error: errorMsg }), { status: errStatus, headers: { ...dynCors, "Content-Type": "application/json" } });
      }
      if (errStatus !== 503 && errStatus !== 500 && errStatus !== 529) {
        return new Response(JSON.stringify({ error: "Errore AI gateway" }), { status: errStatus, headers: { ...dynCors, "Content-Type": "application/json" } });
      }
    }

    if (!response || !response.ok) {
      console.error("[AI] All models failed");
      return new Response(JSON.stringify({ error: "Tutti i modelli AI sono temporaneamente non disponibili. Riprova tra qualche minuto." }), { status: 503, headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    let result = await response.json();
    let assistantMessage = result.choices?.[0]?.message;
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0 };
    if (result.usage) {
      totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += result.usage.completion_tokens || 0;
    }

    // ━━━ Tool calling loop (max 8 iterations) ━━━
    let iterations = 0;
    let lastPartnerResult: Record<string, unknown>[] | null = null;
    let lastJobCreated: Record<string, unknown> | null = null;
    const uiActions: Record<string, unknown>[] = [];

    while (assistantMessage?.tool_calls?.length && iterations < 8) {
      iterations++;
      const toolResults: Record<string, unknown>[] = [];

      for (const tc of assistantMessage.tool_calls) {
        console.log(`Tool: ${tc.function.name}`, tc.function.arguments);
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments || "{}");
        } catch (parseErr: unknown) {
          const errMsg = extractErrorMessage(parseErr);
          console.error(`[ai-assistant] tool args parse failed for ${tc.function.name}:`, errMsg);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({
              success: false,
              error: "INVALID_TOOL_ARGS",
              message: `Tool arguments were not valid JSON: ${errMsg}. Please retry with valid JSON.`,
              raw_arguments_snippet: String(tc.function.arguments || "").substring(0, 200),
            }),
          });
          continue;
        }

        const toolResult = await executeTool(tc.function.name, args, toolDeps, userId, authHeader);
        console.log(`Result ${tc.function.name}:`, JSON.stringify(toolResult).substring(0, 500));
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });

        const tr = toolResult as Record<string, unknown>;

        // Track partner list results
        if (tr?.partners && Array.isArray(tr.partners) && tr.partners.length > 0 && tc.function.name === "search_partners") {
          const partnerIds = (tr.partners as Record<string, unknown>[]).map((p) => p.id);
          const [svcRes, certRes] = await Promise.all([
            supabase.from("partner_services").select("partner_id, service_category").in("partner_id", partnerIds),
            supabase.from("partner_certifications").select("partner_id, certification").in("partner_id", partnerIds),
          ]);
          const svcMap: Record<string, string[]> = {};
          for (const s of (svcRes.data || []) as Record<string, unknown>[]) {
            const pid = s.partner_id as string;
            if (!svcMap[pid]) svcMap[pid] = [];
            svcMap[pid].push(s.service_category as string);
          }
          const certMap: Record<string, string[]> = {};
          for (const c of (certRes.data || []) as Record<string, unknown>[]) {
            const pid = c.partner_id as string;
            if (!certMap[pid]) certMap[pid] = [];
            certMap[pid].push(c.certification as string);
          }
          lastPartnerResult = (tr.partners as Record<string, unknown>[]).map((p) => ({
            ...p,
            country_code: (p.country as string)?.match(/\(([A-Z]{2})\)/)?.[1] || "",
            country_name: (p.country as string)?.replace(/\s*\([A-Z]{2}\)/, "") || "",
            services: svcMap[p.id as string] || [],
            certifications: certMap[p.id as string] || [],
          }));
        }

        // Track job creation
        if ((tc.function.name === "create_download_job" || tc.function.name === "download_single_partner") && tr?.success && tr?.job_id) {
          lastJobCreated = { job_id: tr.job_id, country: tr.country, mode: tr.mode, total_partners: tr.total_partners, estimated_time_minutes: tr.estimated_time_minutes };
        }

        // Track UI actions
        if (tr?.ui_action) uiActions.push(tr.ui_action as Record<string, unknown>);
        if ((tr?.step_result as Record<string, unknown> | undefined)?.ui_action) {
          uiActions.push((tr.step_result as Record<string, unknown>).ui_action as Record<string, unknown>);
        }

        // ── Auto-save L1 memory after significant tool calls ──
        if (userId && tr?.success) {
          const autoSaveTools: Record<string, (a: Record<string, unknown>, r: Record<string, unknown>) => string | null> = {
            send_email: (a) => `Email inviata a ${a.to_email} — oggetto: "${a.subject}"`,
            create_download_job: (_a, r) => `Download avviato per ${r.country}, ${r.total_partners} partner (mode: ${r.mode})`,
            download_single_partner: (a, r) => `Download singolo: "${a.company_name}" (WCA ID: ${r.wca_id})`,
            deep_search_partner: (a) => `Deep search su "${a.company_name || a.partner_id}"`,
            deep_search_contact: (a) => `Deep search contatto: "${a.contact_name || a.contact_id}"`,
            bulk_update_partners: (_a, r) => `Aggiornamento bulk: ${r.updated_count} partner — ${(Array.isArray(r.changes) ? r.changes.join(", ") : "")}`,
            create_reminder: (a, r) => `Reminder creato: "${a.title}" per ${r.company_name} (scadenza: ${a.due_date})`,
            create_activity: (a) => `Attività creata: "${a.title}" (${a.activity_type})`,
          };
          const generator = autoSaveTools[tc.function.name];
          if (generator) {
            const content = generator(args, tr);
            if (content) {
              const { data: existing } = await supabase
                .from("ai_memory")
                .select("id")
                .eq("user_id", userId)
                .eq("source", "auto_tool")
                .ilike("content", `%${escapeLike(content.substring(0, 40))}%`)
                .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
                .limit(1);

              if (!existing?.length) {
                supabase.from("ai_memory").insert({
                  user_id: userId,
                  content,
                  memory_type: "fact",
                  tags: [tc.function.name, new Date().toISOString().split("T")[0]],
                  importance: 2,
                  level: 1,
                  confidence: 0.5,
                  decay_rate: 0.02,
                  source: "auto_tool",
                }).then(() => {}).catch((e: unknown) => console.warn("non-critical failure", extractErrorMessage(e)));
              }
            }
          }
        }
      }

      allMessages.push(assistantMessage);
      allMessages.push(...toolResults);

      // Retry with fallback models on tool-loop calls too
      let toolLoopOk = false;
      for (const tryModel of fallbackModels) {
        const loopBody: Record<string, unknown> = { model: tryModel, messages: allMessages };
        if (activeTools) loopBody.tools = activeTools;
        response = await fetch(provider.url, {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify(loopBody),
        });
        if (response.ok) { toolLoopOk = true; break; }
        const errStatus = response.status;
        const errText = await response.text();
        console.error(`AI tool-loop error (${tryModel}):`, errStatus, errText);
        if (errStatus === 429 || errStatus === 402) {
          if (provider.isUserKey) {
            const errorMsg = errStatus === 429 ? "Troppe richieste al provider AI, riprova tra poco." : "Crediti AI esauriti.";
            return new Response(JSON.stringify({ error: errorMsg }), { status: errStatus, headers: { ...dynCors, "Content-Type": "application/json" } });
          }
          continue;
        }
        if (errStatus !== 503 && errStatus !== 500 && errStatus !== 529) {
          return new Response(JSON.stringify({ error: "Errore AI gateway" }), { status: errStatus, headers: { ...dynCors, "Content-Type": "application/json" } });
        }
      }
      if (!toolLoopOk) {
        console.error("[AI] All models failed in tool loop");
        return new Response(JSON.stringify({ error: "Tutti i modelli AI sono temporaneamente non disponibili. Riprova tra qualche minuto." }), { status: 503, headers: { ...dynCors, "Content-Type": "application/json" } });
      }

      result = await response.json();
      assistantMessage = result.choices?.[0]?.message;
      if (result.usage) {
        totalUsage.prompt_tokens += result.usage.prompt_tokens || 0;
        totalUsage.completion_tokens += result.usage.completion_tokens || 0;
      }
    }

    // ━━━ Response assembly ━━━
    const appendStructured = (text: string): string => {
      let out = text;
      if (lastPartnerResult && lastPartnerResult.length > 0) {
        out += `\n\n---STRUCTURED_DATA---\n${JSON.stringify({ type: "partners", data: lastPartnerResult })}`;
      }
      if (lastJobCreated) {
        out += `\n\n---JOB_CREATED---\n${JSON.stringify(lastJobCreated)}`;
      }
      if (uiActions.length > 0) {
        out += `\n\n---UI_ACTIONS---\n${JSON.stringify(uiActions)}`;
      }
      return out;
    };

    let finalContent = assistantMessage?.content || "";
    if (finalContent) {
      if (!isConversational) finalContent = appendStructured(finalContent);
      if (userId) await consumeCredits(supabase, userId, totalUsage, provider.isUserKey);
      return new Response(JSON.stringify({ content: finalContent }), { headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    // Fallback: one more call without tools
    allMessages.push(assistantMessage);
    const finalResponse = await fetch(provider.url, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({ model: provider.model, messages: allMessages }),
    });
    if (!finalResponse.ok) {
      return new Response(JSON.stringify({ error: "Errore finale" }), { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } });
    }
    const finalResult = await finalResponse.json();
    if (finalResult.usage) {
      totalUsage.prompt_tokens += finalResult.usage.prompt_tokens || 0;
      totalUsage.completion_tokens += finalResult.usage.completion_tokens || 0;
    }

    const finalText = isConversational
      ? (finalResult.choices?.[0]?.message?.content || "Nessuna risposta")
      : appendStructured(finalResult.choices?.[0]?.message?.content || "Nessuna risposta");
    if (userId) await consumeCredits(supabase, userId, totalUsage, provider.isUserKey);
    return new Response(JSON.stringify({ content: finalText }), { headers: { ...dynCors, "Content-Type": "application/json" } });

  } catch (e: unknown) {
    logEdgeError("ai-assistant", e);
    endMetrics(metrics, false, 500);
    console.error("ai-assistant error:", extractErrorMessage(e));
    return edgeError("INTERNAL_ERROR", extractErrorMessage(e));
  }
});
