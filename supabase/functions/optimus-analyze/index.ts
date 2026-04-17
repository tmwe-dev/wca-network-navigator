/**
 * optimus-analyze — Optimus Scraper Agent
 * Analizza il DOM di pagine WhatsApp/LinkedIn e genera un piano di estrazione
 * dinamico, con cache per (operator_id, channel, page_type, dom_hash).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";

interface AnalyzeInput {
  channel: "whatsapp" | "linkedin";
  page_type: "sidebar" | "thread" | "inbox" | "messaging";
  dom_snapshot: string;
  dom_hash: string;
  screenshot_base64?: string;
  previous_plan_failed?: boolean;
  failure_context?: string;
}

interface MemoryRow {
  id: string;
  operator_id: string;
  channel: string;
  page_type: string;
  extraction_plan: Record<string, unknown>;
  plan_version: number;
  dom_structure_hash: string | null;
  total_invocations: number;
  total_ai_calls: number;
  consecutive_successes: number;
  consecutive_failures: number;
}

const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const AI_MODEL = "google/gemini-3-flash-preview";
const AI_TIMEOUT_MS = 15000;

function channelGuidance(channel: string, pageType: string): string[] {
  // Guida specifica per canale + page_type. I nomi dei campi DEVONO matchare
  // esattamente quelli letti da OptimusClient.executePlan() / _pageExecutePlan().
  if (channel === "whatsapp" && pageType === "sidebar") {
    return [
      "",
      "GUIDA WHATSAPP SIDEBAR:",
      "Il DOM di WhatsApp Web usa classi CSS offuscate (es. x1n2onr6, _ak72) che cambiano frequentemente. NON usarle come selettori primari.",
      "Selettori STABILI da preferire:",
      "- container: [role=\"grid\"] (fallback: #pane-side)",
      "- thread_item: [role=\"row\"] (singola conversazione nella lista)",
      "- contact_name: span[title] dentro [role=\"gridcell\"][aria-colindex=\"2\"]",
      "- last_message: secondo span dentro la riga sotto il nome (preview testo)",
      "- timestamp: span con testo che matcha HH:MM, \"ieri\", o nome del giorno",
      "- unread_indicator: span con aria-label che contiene \"non lett\" / \"unread\", o badge numerico",
      "I nomi dei campi nell'output DEVONO essere ESATTAMENTE: contact_name, last_message, timestamp, unread_indicator.",
    ];
  }
  if (channel === "whatsapp" && pageType === "thread") {
    return [
      "",
      "GUIDA WHATSAPP THREAD:",
      "- container: [role=\"application\"] o div[data-tab=\"8\"] (area messaggi)",
      "- message_bubble: div[role=\"row\"] dentro la chat area",
      "- message_text: span.selectable-text (innerText del messaggio)",
      "- message_sender: data-pre-plain-text del padre, o span del mittente",
      "- message_time: span con formato HH:MM all'interno del bubble",
      "I nomi dei campi nell'output DEVONO essere ESATTAMENTE: message_text, message_sender, message_time.",
    ];
  }
  if (channel === "linkedin" && (pageType === "messaging" || pageType === "inbox")) {
    return [
      "",
      "GUIDA LINKEDIN MESSAGING:",
      "- container: sezione con la lista conversazioni (ul.msg-conversations-container__conversations-list o aside lista)",
      "- thread_item: li o div che contiene avatar + nome + preview di un thread",
      "- participant_name: testo nel link/heading della riga (nome contatto)",
      "- last_message: preview testo sotto il nome",
      "- timestamp: testo con formato temporale (es. \"2h\", \"ieri\", \"15 apr\")",
      "- thread_url: href del link nella riga (contiene /messaging/thread/)",
      "I nomi dei campi nell'output DEVONO essere ESATTAMENTE: participant_name, last_message, timestamp, thread_url.",
    ];
  }
  return [];
}

function buildSystemPrompt(input: AnalyzeInput, previousPlan: Record<string, unknown> | null): string {
  const lines: string[] = [
    "Sei Optimus, un agente specializzato nell'analisi di pagine web per estrarre dati strutturati. Analizza il DOM fornito e genera un piano di estrazione.",
    "",
    `CANALE: ${input.channel}`,
    `TIPO PAGINA: ${input.page_type}`,
  ];
  if (input.previous_plan_failed) {
    lines.push("", `ATTENZIONE: il piano precedente ha fallito. Errore: ${input.failure_context ?? "(nessun dettaglio)"}. Genera un piano alternativo.`);
  }
  if (previousPlan && Object.keys(previousPlan).length > 0) {
    lines.push("", "Piano precedente (potrebbe essere obsoleto):", JSON.stringify(previousPlan));
  }
  lines.push(
    "",
    "REGOLE GENERALI:",
    "- Usa SOLO selettori CSS standard (no XPath)",
    "- Preferisci selettori stabili: role, aria-label, data-*, tag semantici",
    "- Evita classi generate/offuscate (es. x1n2onr6, _ak72) come selettore primario",
    "- Per ogni selettore fornisci un'alternativa di fallback",
    "- Indica il livello di confidenza (0-1) per ogni selettore",
    "- I NOMI DEI CAMPI nell'output sono FISSI: usa esattamente quelli indicati nella guida del canale; nomi diversi (es. \"name\" invece di \"contact_name\") sono ERRORE.",
  );
  lines.push(...channelGuidance(input.channel, input.page_type));
  lines.push(
    "",
    "FORMATO OUTPUT (JSON strict, nessun testo extra):",
    `{
  "plan_type": "sidebar_scan" | "thread_read" | "inbox_scan",
  "selectors": {
    "container": { "primary": "...", "fallback": "...", "confidence": 0.9 },
    "thread_item": { "primary": "...", "fallback": "...", "confidence": 0.9 },
    "contact_name": { "primary": "...", "fallback": "...", "confidence": 0.9 },
    "last_message": { "primary": "...", "fallback": "...", "confidence": 0.85 },
    "timestamp": { "primary": "...", "fallback": "...", "confidence": 0.8 },
    "unread_indicator": { "primary": "...", "fallback": "...", "confidence": 0.85 }
  },
  "extraction_logic": "step-by-step",
  "confidence": 0.9,
  "dom_version_hint": "..."
}`,
    "Per WhatsApp thread_read aggiungere: message_bubble, message_text, message_sender, message_time (sostituendo i campi sidebar).",
    "Per LinkedIn messaging aggiungere/usare: participant_name, last_message, timestamp, thread_url (al posto di contact_name/unread_indicator).",
  );
  return lines.join("\n");
}

interface AIResult {
  plan: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
}

async function callAI(systemPrompt: string, input: AnalyzeInput, apiKey: string): Promise<AIResult> {
  const userContent: Array<Record<string, unknown>> = [
    { type: "text", text: `DOM SNAPSHOT (truncato a 30k char):\n${input.dom_snapshot.slice(0, 30000)}` },
  ];
  if (input.screenshot_base64) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/png;base64,${input.screenshot_base64}` },
    });
  }

  const start = Date.now();
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), AI_TIMEOUT_MS);

  let resp: Response;
  try {
    resp = await fetch(AI_GATEWAY_URL, {
      method: "POST",
      signal: ac.signal,
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        response_format: { type: "json_object" },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Date.now() - start;
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`AI gateway ${resp.status}: ${txt.slice(0, 300)}`);
  }
  const data = await resp.json() as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = data.choices?.[0]?.message?.content ?? "{}";
  let plan: Record<string, unknown>;
  try {
    plan = JSON.parse(content);
  } catch {
    throw new Error(`AI returned non-JSON: ${content.slice(0, 200)}`);
  }
  return {
    plan,
    tokensIn: data.usage?.prompt_tokens ?? 0,
    tokensOut: data.usage?.completion_tokens ?? 0,
    latencyMs,
  };
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = { ...corsH, "Content-Type": "application/json" };

  try {
    const auth = await requireAuth(req, corsH);
    if (isAuthError(auth)) return auth;

    const body = await req.json() as AnalyzeInput;
    if (!body?.channel || !body?.page_type || typeof body.dom_snapshot !== "string" || !body.dom_hash) {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: "channel, page_type, dom_snapshot, dom_hash required" }), { status: 400, headers });
    }
    if (!["whatsapp", "linkedin"].includes(body.channel)) {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: "invalid channel" }), { status: 400, headers });
    }
    if (!["sidebar", "thread", "inbox", "messaging"].includes(body.page_type)) {
      return new Response(JSON.stringify({ error: "VALIDATION_ERROR", message: "invalid page_type" }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve operator_id for this user
    const { data: opRow, error: opErr } = await supabase
      .from("operators")
      .select("id")
      .eq("user_id", auth.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (opErr || !opRow) {
      return new Response(JSON.stringify({ error: "NOT_FOUND", message: "No active operator for user" }), { status: 404, headers });
    }
    const operatorId = opRow.id as string;

    // Lookup memory
    const { data: memRow } = await supabase
      .from("scraper_agent_memory")
      .select("*")
      .eq("operator_id", operatorId)
      .eq("channel", body.channel)
      .eq("page_type", body.page_type)
      .maybeSingle();
    const memory = memRow as MemoryRow | null;

    const previousFailed = body.previous_plan_failed === true;
    const cacheHit = memory
      && memory.dom_structure_hash === body.dom_hash
      && !previousFailed
      && memory.extraction_plan
      && Object.keys(memory.extraction_plan).length > 0;

    const domSize = body.dom_snapshot.length;

    if (cacheHit && memory) {
      // Increment counters
      await supabase
        .from("scraper_agent_memory")
        .update({ total_invocations: memory.total_invocations + 1 })
        .eq("id", memory.id);
      await supabase.from("scraper_agent_log").insert({
        memory_id: memory.id,
        operator_id: operatorId,
        channel: body.channel,
        page_type: body.page_type,
        dom_snapshot_hash: body.dom_hash,
        dom_snapshot_size: domSize,
        screenshot_included: !!body.screenshot_base64,
        used_cached_plan: true,
        extraction_plan: memory.extraction_plan,
      });
      return new Response(JSON.stringify({
        plan: memory.extraction_plan,
        cached: true,
        plan_version: memory.plan_version,
        confidence: (memory.extraction_plan as { confidence?: number }).confidence ?? null,
        ai_latency_ms: null,
      }), { status: 200, headers });
    }

    // Need to call AI
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message: "LOVABLE_API_KEY not configured" }), { status: 500, headers });
    }

    const sysPrompt = buildSystemPrompt(body, memory?.extraction_plan ?? null);

    let aiResult: AIResult | null = null;
    let aiError: string | null = null;
    try {
      aiResult = await callAI(sysPrompt, body, apiKey);
    } catch (e) {
      aiError = e instanceof Error ? e.message : String(e);
    }

    // AI failure handling
    if (!aiResult) {
      if (memory && Object.keys(memory.extraction_plan).length > 0) {
        // Stale fallback
        await supabase.from("scraper_agent_log").insert({
          memory_id: memory.id,
          operator_id: operatorId,
          channel: body.channel,
          page_type: body.page_type,
          dom_snapshot_hash: body.dom_hash,
          dom_snapshot_size: domSize,
          screenshot_included: !!body.screenshot_base64,
          used_cached_plan: true,
          extraction_plan: memory.extraction_plan,
          execution_result: "failure",
          error_message: `AI failed, returning stale plan: ${aiError}`,
        });
        return new Response(JSON.stringify({
          plan: memory.extraction_plan,
          cached: true,
          stale: true,
          plan_version: memory.plan_version,
          confidence: (memory.extraction_plan as { confidence?: number }).confidence ?? null,
          ai_latency_ms: null,
          ai_error: aiError,
        }), { status: 200, headers });
      }
      return new Response(JSON.stringify({
        error: "UPSTREAM_ERROR",
        message: `AI unavailable and no cached plan: ${aiError}`,
      }), { status: 503, headers });
    }

    // Upsert memory with new plan
    const newVersion = (memory?.plan_version ?? 0) + 1;
    const { data: upserted, error: upErr } = await supabase
      .from("scraper_agent_memory")
      .upsert({
        ...(memory?.id ? { id: memory.id } : {}),
        operator_id: operatorId,
        channel: body.channel,
        page_type: body.page_type,
        extraction_plan: aiResult.plan,
        plan_version: newVersion,
        dom_structure_hash: body.dom_hash,
        total_invocations: (memory?.total_invocations ?? 0) + 1,
        total_ai_calls: (memory?.total_ai_calls ?? 0) + 1,
        consecutive_failures: previousFailed ? (memory?.consecutive_failures ?? 0) + 1 : 0,
      }, { onConflict: "operator_id,channel,page_type" })
      .select()
      .maybeSingle();

    if (upErr) {
      console.error("[optimus-analyze] upsert error", upErr);
    }

    await supabase.from("scraper_agent_log").insert({
      memory_id: (upserted as { id?: string } | null)?.id ?? memory?.id ?? null,
      operator_id: operatorId,
      channel: body.channel,
      page_type: body.page_type,
      dom_snapshot_hash: body.dom_hash,
      dom_snapshot_size: domSize,
      screenshot_included: !!body.screenshot_base64,
      used_cached_plan: false,
      extraction_plan: aiResult.plan,
      ai_model: AI_MODEL,
      ai_tokens_in: aiResult.tokensIn,
      ai_tokens_out: aiResult.tokensOut,
      ai_latency_ms: aiResult.latencyMs,
    });

    return new Response(JSON.stringify({
      plan: aiResult.plan,
      cached: false,
      plan_version: newVersion,
      confidence: (aiResult.plan as { confidence?: number }).confidence ?? null,
      ai_latency_ms: aiResult.latencyMs,
    }), { status: 200, headers });
  } catch (e) {
    console.error("[optimus-analyze] fatal", e);
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "INTERNAL_ERROR", message }), { status: 500, headers });
  }
});
