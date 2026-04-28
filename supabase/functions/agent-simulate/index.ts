/**
 * agent-simulate — Prompt Lab simulator.
 *
 * Given { agentId, userMessage, sessionContext?, dryRunAI? } returns the
 * EXACT prompt assembly that agent-loop would build for that agent, plus
 * the tool whitelist after capabilities filtering, persona block, prompt
 * lab block, hard-guards summary. Optionally fires a single AI call
 * (NO tool execution) so you can see what the model would propose.
 *
 * READ-ONLY: this function never executes tools, never persists.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders } from "../_shared/cors.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import {
  loadAgentCapabilities,
  filterToolsByCapabilities,
  toolRequiresApproval,
  DEFAULT_CAPABILITIES,
} from "../_shared/agentCapabilitiesLoader.ts";
import { loadAgentPersona, renderPersonaBlock } from "../_shared/agentPersonaLoader.ts";

// Mirror of agent-loop tool registry. Kept here so the simulator stays
// in sync without importing the live function (each edge fn is isolated).
const TOOL_DEFINITIONS = [
  { type: "function", function: { name: "navigate", description: "Navigate to a route within the app." } },
  { type: "function", function: { name: "read_page", description: "Read current page structure." } },
  { type: "function", function: { name: "click", description: "Click an element by CSS selector." } },
  { type: "function", function: { name: "type_text", description: "Type text into an input/textarea." } },
  { type: "function", function: { name: "read_dom", description: "Read outerHTML of a DOM element." } },
  { type: "function", function: { name: "list_kb", description: "List KB entries." } },
  { type: "function", function: { name: "read_kb", description: "Read full content of a KB entry." } },
  { type: "function", function: { name: "scrape_url", description: "Scrape a website URL." } },
  { type: "function", function: { name: "ask_user", description: "Ask the user a clarification question." } },
  { type: "function", function: { name: "finish", description: "Complete the mission with a final answer." } },
] as const;

// Hard guards summary — informational, sourced from src/v2/agent/policy/hardGuards.ts.
// Kept short on purpose: this is what the UI surfaces, not the enforcement itself.
const HARD_GUARDS_SUMMARY = {
  forbidden_tables: [
    "auth.*", "storage.*", "realtime.*", "supabase_functions.*", "vault.*",
  ],
  destructive_ops_blocked: ["DELETE physical (auto-converted to soft-delete)", "DROP", "TRUNCATE"],
  bulk_caps: { default: 50, outreach_send: 25 },
  approval_required_always: ["execute_bulk_outreach", "send_email (bulk)", "update_*_status_bulk"],
  notes: "Hard guards are enforced server-side and CANNOT be bypassed by capabilities or prompts.",
};

function jsonResp(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // ── Auth (required: simulator reads user-scoped Prompt Lab) ──
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let userId: string | null = null;
    if (token) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      );
      const { data: { user } } = await sb.auth.getUser(token);
      if (user) userId = user.id;
    }
    if (!userId) return jsonResp({ error: "Auth richiesta" }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const agentId = typeof body.agentId === "string" ? body.agentId : null;
    const userMessage = typeof body.userMessage === "string" ? body.userMessage : "";
    const sessionContext = body.sessionContext ?? null;
    const dryRunAI = body.dryRunAI === true;

    if (!userMessage.trim()) {
      return jsonResp({ error: "userMessage obbligatorio" }, 400, cors);
    }

    const supabaseSrv = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 1. Persona ──
    const persona = agentId ? await loadAgentPersona(supabaseSrv, agentId, userId) : null;
    const personaBlock = renderPersonaBlock(persona);

    // ── 2. Capabilities ──
    const capabilities = agentId
      ? await loadAgentCapabilities(supabaseSrv, agentId)
      : { ...DEFAULT_CAPABILITIES };

    // ── 3. Operative prompts (Prompt Lab) ──
    const lab = await loadOperativePrompts(supabaseSrv, userId, {
      scope: "agent-loop",
      includeUniversal: true,
      limit: 5,
    });

    // ── 4. Tool whitelist after filtering ──
    const effectiveTools = filterToolsByCapabilities(TOOL_DEFINITIONS as unknown as Array<{ function: { name: string } }>, capabilities);
    const allToolNames = TOOL_DEFINITIONS.map((t) => t.function.name);
    const effectiveToolNames = effectiveTools.map((t) => (t as { function: { name: string } }).function.name);
    const filteredOut = allToolNames.filter((n) => !effectiveToolNames.includes(n));
    const toolsApproval = effectiveToolNames.map((name) => ({
      name,
      requires_approval: toolRequiresApproval(name, capabilities),
    }));

    // ── 5. Assemble system prompt EXACTLY like agent-loop ──
    const promptLabBlock = lab.block ? `\n\n${lab.block}` : "";
    const personaBlockStr = personaBlock ? `\n\n${personaBlock}` : "";
    const sessionCtxStr = sessionContext
      ? `CONTESTO PAGINA: ${JSON.stringify(sessionContext).slice(0, 1000)}`
      : "";
    const systemPrompt = `Sei LUCA, direttore del CRM WCA Network Navigator. Italiano, asciutto, operativo.

OBIETTIVO ATTUALE: ${userMessage}
${sessionCtxStr}${personaBlockStr}${promptLabBlock}

Hai a disposizione i tool elencati. Sceglili tu in base al bisogno: leggi la pagina se ti serve capire dove sei, esplora la KB se ti serve contesto, chiedi all'utente se sei bloccato, chiama \`finish\` quando hai concluso. Se una ricerca torna vuota, prova varianti prima di rinunciare. Le regole inviolabili sono nei PROMPT OPERATIVI sopra; i blocchi tecnici (azioni distruttive, bulk, tabelle vietate) sono già imposti dal sistema.`;

    // ── 6. Optional dry-run AI call (single iteration, NO execution) ──
    let dryRun: Record<string, unknown> | null = null;
    if (dryRunAI) {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) {
        dryRun = { error: "LOVABLE_API_KEY non configurata" };
      } else {
        const model = capabilities.preferredModel ?? "google/gemini-2.5-flash";
        const start = Date.now();
        const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userMessage },
            ],
            tools: effectiveTools,
            temperature: capabilities.temperature ?? 0.2,
            max_tokens: capabilities.maxTokensPerCall ?? 500,
          }),
        });
        const elapsed = Date.now() - start;
        if (!resp.ok) {
          const txt = await resp.text();
          dryRun = { error: `AI gateway ${resp.status}`, detail: txt.slice(0, 400), elapsed_ms: elapsed };
        } else {
          const data = await resp.json();
          const msg = data.choices?.[0]?.message;
          const proposedToolCalls = (msg?.tool_calls ?? []).map((tc: Record<string, unknown>) => {
            const fn = tc.function as Record<string, unknown>;
            let args: unknown = {};
            try {
              args = typeof fn.arguments === "string" ? JSON.parse(fn.arguments) : fn.arguments;
            } catch { /* leave as raw */ }
            const name = fn.name as string;
            return {
              name,
              arguments: args,
              would_be_blocked: !effectiveToolNames.includes(name),
              would_require_approval: toolRequiresApproval(name, capabilities),
            };
          });
          dryRun = {
            model,
            elapsed_ms: elapsed,
            message: msg?.content ?? "",
            proposed_tool_calls: proposedToolCalls,
            usage: data.usage ?? null,
          };
        }
      }
    }

    return jsonResp({
      assembled: {
        system_prompt: systemPrompt,
        char_count: systemPrompt.length,
      },
      persona: persona
        ? { loaded: true, tone: persona.tone, language: persona.language, block_preview: personaBlock }
        : { loaded: false, note: "Nessuna persona DB; verrà usata solo l'identità di base dell'agente." },
      capabilities: {
        loaded: capabilities.loaded,
        execution_mode: capabilities.executionMode,
        preferred_model: capabilities.preferredModel,
        temperature: capabilities.temperature,
        max_tokens_per_call: capabilities.maxTokensPerCall,
        max_iterations: capabilities.maxIterations,
        max_concurrent_tools: capabilities.maxConcurrentTools,
        step_timeout_ms: capabilities.stepTimeoutMs,
      },
      operative_prompts: {
        applied: lab.appliedNames,
        has_mandatory: lab.hasMandatory,
        matched: lab.matched,
        block_preview: lab.block ?? "",
      },
      tools: {
        all_registered: allToolNames,
        effective: effectiveToolNames,
        filtered_out: filteredOut,
        approval_map: toolsApproval,
      },
      hard_guards: HARD_GUARDS_SUMMARY,
      dry_run: dryRun,
    }, 200, cors);
  } catch (e) {
    return jsonResp(
      { error: e instanceof Error ? e.message : "Errore sconosciuto" },
      500,
      cors,
    );
  }
});