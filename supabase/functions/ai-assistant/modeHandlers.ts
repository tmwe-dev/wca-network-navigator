/**
 * modeHandlers.ts
 * Handles special operation modes: tool-decision and plan-execution.
 * Each mode takes user prompts and returns structured decisions without full conversation.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { consumeCredits } from "./contextLoader.ts";

/**
 * Headers per le response JSON delle mode handlers.
 * IMPORTANTE: deve includere `Access-Control-Allow-Origin` (dai shared cors)
 * altrimenti il browser scarta la risposta e l'SDK supabase-js lancia
 * "Failed to send a request to the Edge Function" → tradotto lato client
 * come "Sessione scaduta" generando falsi positivi (vedi LOVABLE 2026-04-29).
 */
function jsonHeaders(corsHeaders: Record<string, string>): Record<string, string> {
  return { ...corsHeaders, "Content-Type": "application/json" };
}

export interface AiProvider {
  url: string;
  apiKey: string;
  model: string;
  isUserKey: boolean;
}

/**
 * Tool-decision mode: AI picks the best tool from a list, returns JSON {toolId, toolParams, reasoning}
 */
export async function handleToolDecisionMode(
  provider: AiProvider,
  toolList: Record<string, unknown>[] | undefined,
  userPrompt: string,
  userId: string | null,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
  commandPromptBlock = "",
  activeContext: Record<string, unknown> | null = null,
): Promise<Response> {
  if (!Array.isArray(toolList) || toolList.length === 0 || !userPrompt) {
    return new Response(
      JSON.stringify({ toolId: "none", reasoning: "Missing tools or prompt" }),
      { status: 200, headers: jsonHeaders(corsHeaders) }
    );
  }

  const toolDescriptions = toolList
    .map(
      (t: Record<string, unknown>) =>
        `- id: "${t.id}" | label: "${t.label}" | description: "${t.description}"`
    )
    .join("\n");

  const activeContextBlock = activeContext
    ? `\n\nCONTESTO VIVO IN UI (TTL ~${activeContext.ttlSecondsLeft ?? "?"}s):
${activeContext.description ?? ""}

Principio: se la richiesta dell'utente è una continuazione naturale di questo contesto (modifica, rivisitazione, conferma, follow-up coreferenziale), resta sul tool del contesto. Solo se introduce una nuova entità o cambia argomento, cambia tool.`
    : "";

  const decisionSystemPrompt = `Sei un router di tool. Interpreta semanticamente la richiesta dell'utente nel suo contesto conversazionale e scegli il tool più adatto. NON cercare parole chiave: ragiona sull'intento.
Rispondi SOLO con JSON: {"toolId": "<id>", "reasoning": "<breve>"}
Se nessun tool è adatto: {"toolId": "none", "reasoning": "<motivo>"}

Tool disponibili:
${toolDescriptions}
${activeContextBlock}
${commandPromptBlock ? `\n\n${commandPromptBlock}` : ""}`;

  const decisionResponse = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [
        { role: "system", content: decisionSystemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.1,
      max_tokens: 200,
      response_format: { type: "json_object" },
    }),
  });

  if (!decisionResponse.ok) {
    return new Response(
      JSON.stringify({ toolId: "none", reasoning: "AI call failed" }),
      { status: 200, headers: jsonHeaders(corsHeaders) }
    );
  }

  const decisionData = await decisionResponse.json();
  const rawContent =
    decisionData?.choices?.[0]?.message?.content ?? '{"toolId":"none"}';

  try {
    const parsed = JSON.parse(rawContent);
    if (userId) {
      await consumeCredits(
        supabase,
        userId,
        { prompt_tokens: 200, completion_tokens: 50 },
        provider.isUserKey
      );
    }
    return new Response(
      JSON.stringify({
        toolId: parsed.toolId ?? "none",
        toolParams: parsed.toolParams ?? {},
        reasoning: parsed.reasoning ?? "",
      }),
      { status: 200, headers: jsonHeaders(corsHeaders) }
    );
  } catch {
    return new Response(
      JSON.stringify({ toolId: "none", reasoning: "Failed to parse AI response" }),
      { status: 200, headers: jsonHeaders(corsHeaders) }
    );
  }
}

/**
 * Plan-execution mode: Decomposes a complex prompt into a sequence of tool steps
 */
export async function handlePlanExecutionMode(
  provider: AiProvider,
  toolList: Record<string, unknown>[],
  userPrompt: string,
  history: Record<string, unknown>[],
  userId: string | null,
  supabase: SupabaseClient,
  corsHeaders: Record<string, string>,
  commandPromptBlock = "",
  activeContext: Record<string, unknown> | null = null,
): Promise<Response> {
  if (!userPrompt || !Array.isArray(toolList) || toolList.length === 0) {
    return new Response(
      JSON.stringify({ steps: [], summary: "Missing prompt or tools" }),
      { status: 200, headers: jsonHeaders(corsHeaders) }
    );
  }

  const toolDescriptions = toolList
    .map(
      (t: Record<string, unknown>) =>
        `- id: "${t.id}" | label: "${t.label}" | description: "${t.description}" | requiresApproval: ${t.requiresApproval ?? false}`
    )
    .join("\n");

  const activeContextBlock = activeContext
    ? `\n\nCONTESTO VIVO IN UI (TTL ~${activeContext.ttlSecondsLeft ?? "?"}s):
${activeContext.description ?? ""}

Principio: se la richiesta è una continuazione naturale di questo contesto (modifica, rivisitazione, conferma, follow-up coreferenziale), produci UN SOLO STEP con toolId="${activeContext.toolId}" e passa il prompt utente integrale + un flag context_followup:true nei params. Solo se cambia argomento, cambia tool.`
    : "";

  const planSystemPrompt = `Sei un orchestratore. Interpreta semanticamente la richiesta dell'utente e decomponila in una sequenza ordinata di tool.

PRINCIPI (no keyword matching, ragiona sull'intento):
1. Preferisci UN SOLO STEP. Multi-step SOLO se uno step richiede davvero l'id puntuale di un risultato precedente.
2. Per ogni tool, passa SEMPRE \`params.prompt\` = prompt utente integrale. I tool single-step sanno auto-risolvere il contesto.
3. Se l'utente fa riferimento (anche implicito) a risultati appena mostrati nella conversazione (es. "scrivi a tutti loro", "mandala anche a quelli", "compattale") usa UN SOLO STEP del tool che produce l'azione richiesta e aggiungi \`params.context_followup\` = true: il tool erediterà il target dal contesto vivo, non serve duplicarlo nei params.
4. Per richieste di scrittura/composizione/invio messaggi → tool di composizione (es. compose-email per email). NON spezzare prima in ricerca + composizione: il tool di composizione fa il fan-out internamente.
5. Per richieste di ricerca/lettura/conteggio → tool di query (es. ai-query).
6. Se non hai un tool adatto, ritorna { "steps": [], "summary": "Nessun piano possibile" }.

Output JSON: { "steps": [{"stepNumber": N, "toolId": "...", "reasoning": "...", "params": {...}}], "summary": "..." }
Placeholder per dipendenze tra step: {{step1.result.partnerId}}.

Tool disponibili:
${toolDescriptions}
${activeContextBlock}
${commandPromptBlock ? `\n\n${commandPromptBlock}` : ""}`;

  const planMessages: Record<string, unknown>[] = [
    { role: "system", content: planSystemPrompt },
    ...history.slice(-10).map((m: Record<string, unknown>) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user", content: userPrompt },
  ];

  const planResponse = await fetch(provider.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: provider.model,
      messages: planMessages,
      temperature: 0.1,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  });

  if (!planResponse.ok) {
    console.error(
      "[plan-execution] AI call failed:",
      planResponse.status
    );
    return new Response(
      JSON.stringify({ steps: [], summary: "AI call failed" }),
      { status: 200, headers: jsonHeaders(corsHeaders) }
    );
  }

  const planData = await planResponse.json();
  const rawPlan =
    planData?.choices?.[0]?.message?.content ??
    '{"steps":[],"summary":"No response"}';

  try {
    const parsed = JSON.parse(rawPlan);
    if (userId) {
      await consumeCredits(
        supabase,
        userId,
        { prompt_tokens: 600, completion_tokens: 400 },
        provider.isUserKey
      );
    }
    
    return new Response(
      JSON.stringify({
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
        summary: parsed.summary ?? "",
      }),
      { status: 200, headers: jsonHeaders(corsHeaders) }
    );
  } catch {
    return new Response(
      JSON.stringify({ steps: [], summary: "Failed to parse plan" }),
      { status: 200, headers: jsonHeaders(corsHeaders) }
    );
  }
}
