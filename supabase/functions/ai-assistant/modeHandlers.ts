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
  corsHeaders: Record<string, string>
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

  const decisionSystemPrompt = `Sei un router di tool. Dato il prompt utente e la lista di tool disponibili, scegli il tool più appropriato.
Rispondi SOLO con un JSON valido: {"toolId": "<id>", "reasoning": "<spiegazione breve>"}
Se nessun tool è adatto, rispondi: {"toolId": "none", "reasoning": "<motivo>"}

Tool disponibili:
${toolDescriptions}`;

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
  corsHeaders: Record<string, string>
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

  const planSystemPrompt = `Sei un orchestratore. Dato il prompt utente, decomponi il task in una sequenza ordinata di tool da eseguire. Ogni step deve avere: stepNumber, toolId, reasoning, params (oggetto JSON con i parametri estratti dal prompt e dal contesto degli step precedenti). Se uno step dipende dall'output di uno precedente (es: "usa l'id del partner trovato al passo 1"), usa segnaposto {{step1.result.partnerId}}. Ritorna SOLO JSON valido nella forma: { "steps": [{"stepNumber": N, "toolId": "...", "reasoning": "...", "params": {...}}], "summary": "descrizione del piano in 1 frase" }. Se il task è eseguibile con UN solo tool, ritorna 1 step. Se il task non è eseguibile coi tool disponibili, ritorna { "steps": [], "summary": "Nessun piano possibile" }.

Tool disponibili:
${toolDescriptions}`;

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
