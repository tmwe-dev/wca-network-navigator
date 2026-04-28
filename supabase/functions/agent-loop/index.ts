import "../_shared/llmFetchInterceptor.ts";
/**
 * agent-loop edge function — One iteration of the agent loop.
 * Receives goal + history, returns AI decision with tool_calls.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { checkDailyBudget, recordUsage, budgetExceededResponse } from "../_shared/costGuardrail.ts";
import { estimateTokens } from "../_shared/tokenBudget.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import {
  loadAgentCapabilities,
  filterToolsByCapabilities,
  DEFAULT_CAPABILITIES,
} from "../_shared/agentCapabilitiesLoader.ts";
import { loadAgentPersona, renderPersonaBlock } from "../_shared/agentPersonaLoader.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigate to a route within the app.",
      parameters: { type: "object", properties: { path: { type: "string", description: "Route path" } }, required: ["path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "read_page",
      description: "Read current page structure (buttons, inputs, text).",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "click",
      description: "Click an element by CSS selector.",
      parameters: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] },
    },
  },
  {
    type: "function",
    function: {
      name: "type_text",
      description: "Type text into an input/textarea.",
      parameters: {
        type: "object",
        properties: { selector: { type: "string" }, text: { type: "string" } },
        required: ["selector", "text"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_dom",
      description: "Read outerHTML of a DOM element.",
      parameters: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_kb",
      description: "List KB entries with categories and titles.",
      parameters: { type: "object", properties: { category: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "read_kb",
      description: "Read full content of a KB entry by source_path.",
      parameters: { type: "object", properties: { source_path: { type: "string" } }, required: ["source_path"] },
    },
  },
  {
    type: "function",
    function: {
      name: "scrape_url",
      description: "Scrape a website URL.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" }, mode: { type: "string", enum: ["static", "render"] } },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_user",
      description: "Ask the user a clarification question.",
      parameters: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "Complete the mission with a final answer.",
      parameters: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
    },
  },
];

// Safety: i blocchi distruttivi reali stanno in src/v2/agent/policy/hardGuards.ts
// (FORBIDDEN_TABLES, assertNotDestructive, assertBulkCap, requiresApproval).
// Qui non duplichiamo controlli "teatrali" sulle keyword: l'AI è libera di
// ragionare, l'esecuzione passa comunque dal preflight in hardGuards.

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let userId = "anonymous";
    if (token) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      );
      const { data: { user } } = await sb.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Rate limit: 60 req/min
    const rl = checkRateLimit(`agent-loop:${userId}`, { maxTokens: 60, refillRate: 1 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    // Cost guardrail
    const budget = await checkDailyBudget(userId, "ai", 500); // estimate ~500 tokens per step
    if (!budget.allowed) return budgetExceededResponse(budget, corsHeaders);

    const { goal, history, sessionContext, agentId } = await req.json();

    if (!goal || typeof goal !== "string") {
      return new Response(JSON.stringify({ error: "goal è obbligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY non configurata" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Prompt Lab injection (UNIFIED loader): LUCA inherits the user's
    //    operative prompts so it follows the same OBBLIGATORIA rules as
    //    generate-email / generate-outreach. Soft-fail: empty if user is
    //    anonymous, has no prompts, or the table is unreachable.
    let promptLabBlock = "";
    if (userId && userId !== "anonymous") {
      try {
        const supabaseSrv = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const lab = await loadOperativePrompts(supabaseSrv, userId, {
          scope: "agent-loop",
          includeUniversal: true,
          limit: 5,
        });
        promptLabBlock = lab.block ? `\n\n${lab.block}` : "";
      } catch (e) {
        console.warn("[agent-loop] prompt-lab load skipped:", (e as Error).message);
      }
    }

    // ── Agent capabilities (DB-backed, soft-fail to defaults).
    let capabilities = { ...DEFAULT_CAPABILITIES };
    let personaBlock = "";
    if (agentId) {
      try {
        const supabaseSrv = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        capabilities = await loadAgentCapabilities(supabaseSrv, String(agentId));
        const persona = await loadAgentPersona(supabaseSrv, String(agentId), userId !== "anonymous" ? userId : undefined);
        const rendered = renderPersonaBlock(persona);
        if (rendered) personaBlock = `\n\n${rendered}`;
      } catch (e) {
        console.warn("[agent-loop] capabilities/persona load skipped:", (e as Error).message);
      }
    }

    const effectiveTools = filterToolsByCapabilities(TOOL_DEFINITIONS, capabilities);
    const effectiveModel = capabilities.preferredModel ?? "google/gemini-2.5-flash";
    const effectiveMaxTokens = capabilities.maxTokensPerCall ?? 500;
    const effectiveTemperature = typeof capabilities.temperature === "number"
      ? capabilities.temperature
      : 0.2;

    const systemPrompt = `Sei LUCA, direttore del CRM WCA Network Navigator. Italiano, asciutto, operativo.

OBIETTIVO ATTUALE: ${goal}
${sessionContext ? `CONTESTO PAGINA: ${JSON.stringify(sessionContext).slice(0, 1000)}` : ""}${personaBlock}${promptLabBlock}

Hai a disposizione i tool elencati. Sceglili tu in base al bisogno: leggi la pagina se ti serve capire dove sei, esplora la KB se ti serve contesto, chiedi all'utente se sei bloccato, chiama \`finish\` quando hai concluso. Se una ricerca torna vuota, prova varianti prima di rinunciare. Le regole inviolabili sono nei PROMPT OPERATIVI sopra; i blocchi tecnici (azioni distruttive, bulk, tabelle vietate) sono già imposti dal sistema.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...(Array.isArray(history) ? history.slice(-30) : []),
    ];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: effectiveModel,
        messages,
        tools: effectiveTools,
        temperature: effectiveTemperature,
        max_tokens: effectiveMaxTokens,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit superato, riprova tra poco." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.error("AI gateway error:", status, errText);
      return new Response(JSON.stringify({ error: "Errore AI gateway" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) {
      return new Response(JSON.stringify({ message: "", toolCalls: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse tool calls
    const toolCalls = (msg.tool_calls ?? []).map((tc: Record<string, unknown>) => {
      const fn = tc.function as Record<string, unknown>;
      let args: Record<string, unknown> = {};
      try {
        args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : (fn.arguments as Record<string, unknown>) ?? {};
      } catch {
        args = {};
      }
      return { name: fn.name as string, arguments: args, id: tc.id as string };
    }).filter(Boolean);

    // Record usage
    const responseTokens = estimateTokens(msg.content ?? "") + toolCalls.length * 50;
    await recordUsage(userId, "ai", responseTokens).catch(() => {});

    return new Response(
      JSON.stringify({
        message: msg.content ?? "",
        toolCalls,
        capabilities: {
          executionMode: capabilities.executionMode,
          maxConcurrentTools: capabilities.maxConcurrentTools,
          stepTimeoutMs: capabilities.stepTimeoutMs,
          maxIterations: capabilities.maxIterations,
          approvalRequiredTools: capabilities.approvalRequiredTools,
          loaded: capabilities.loaded,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("agent-loop error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
