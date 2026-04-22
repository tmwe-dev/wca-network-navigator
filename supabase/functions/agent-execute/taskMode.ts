// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TASK EXECUTION MODE - Agent Task Processing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { executeTool } from "./toolHandlers.ts";
import { logSupervisorAudit } from "../_shared/supervisorAudit.ts";

type SupabaseClient = ReturnType<typeof createClient>;

interface AgentTask {
  id: string;
  task_type: string;
  description: string;
  target_filters?: Record<string, unknown>;
  execution_log?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

/**
 * Execute state_transition task type
 */
export async function handleStateTransition(
  supabase: SupabaseClient,
  task: AgentTask,
  taskId: string,
  agentId: string,
  agentName: string,
  userId: string
): Promise<{ success: boolean; action: string; partner_id: string; from_state: string; new_state: string }> {
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
    }).eq("id", taskId);
    throw new Error("task_invalid: partner_id/to_state mancanti");
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
  }).eq("id", taskId);

  await logSupervisorAudit(supabase, {
    user_id: userId,
    actor_type: "ai_agent",
    actor_id: agentId,
    actor_name: agentName,
    action_category: applied ? "state_transition_applied" : "state_transition_failed",
    action_detail: `Partner ${partnerId}: ${fromState} → ${toState} (trigger: ${trigger})`,
    target_type: "partner",
    target_id: partnerId,
    decision_origin: "ai_auto",
    metadata: { task_id: taskId, from_state: fromState, to_state: toState },
  });

  return {
    success: applied,
    action: "state_transition",
    partner_id: partnerId,
    from_state: fromState,
    new_state: toState,
  };
}

/**
 * Execute general task type with AI
 */
export async function handleGeneralTask(
  supabase: SupabaseClient,
  task: AgentTask,
  taskId: string,
  systemPrompt: string,
  agentTools: Record<string, unknown>[],
  agentId: string,
  agentName: string,
  userId: string,
  authHeader: string,
  apiKey: string
): Promise<{ success: boolean; result: string }> {
  const LOVABLE_API_KEY = apiKey || Deno.env.get("LOVABLE_API_KEY");
  const aiUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
  const aiHeaders = { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" };
  const fallbackModels = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "openai/gpt-5-mini"];

  // Build sequence instructions for sequence_step tasks
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
  const allMessages = [
    { role: "system", content: taskPrompt },
    { role: "user", content: "Esegui il compito assegnato." },
  ];

  let response: Response | null = null;
  for (const model of fallbackModels) {
    response = await fetch(aiUrl, {
      method: "POST",
      headers: aiHeaders,
      body: JSON.stringify({
        model,
        messages: allMessages,
        ...(agentTools.length > 0 ? { tools: agentTools } : {}),
        max_tokens: 4000,
      }),
    });
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
        console.log(`[Agent ${agentName} Task] Tool: ${tc.function.name}`);
        const args = JSON.parse(tc.function.arguments || "{}");
        const toolResult = await executeTool(tc.function.name, args, userId, authHeader, { agent_id: agentId });
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(toolResult) });
      }
      allMessages.push(msg);
      allMessages.push(...toolResults);
      let loopOk = false;
      for (const model of fallbackModels) {
        response = await fetch(aiUrl, {
          method: "POST",
          headers: aiHeaders,
          body: JSON.stringify({
            model,
            messages: allMessages,
            ...(agentTools.length > 0 ? { tools: agentTools } : {}),
            max_tokens: 4000,
          }),
        });
        if (response!.ok) {
          loopOk = true;
          break;
        }
        await response!.text();
      }
      if (!loopOk) {
        taskStatus = "failed";
        resultSummary = "Errore AI durante l'esecuzione.";
        break;
      }
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
    status: taskStatus,
    result_summary: resultSummary.slice(0, 5000),
    execution_log: [
      ...currentLog,
      { ts: new Date().toISOString(), result: resultSummary.slice(0, 2000) },
    ] as unknown as Record<string, unknown>,
    completed_at: new Date().toISOString(),
  }).eq("id", taskId);

  await logSupervisorAudit(supabase, {
    user_id: userId,
    actor_type: "ai_agent",
    actor_id: agentId,
    actor_name: agentName,
    action_category: taskStatus === "completed" ? "task_executed" : "task_failed",
    action_detail: `${task.task_type}: ${resultSummary.slice(0, 300)}`,
    target_type: "agent_task",
    target_id: taskId,
    decision_origin: "ai_auto",
    metadata: { task_type: task.task_type, result: resultSummary.slice(0, 500) },
  });

  // Update agent stats
  await supabase.rpc("increment_agent_stat", {
    p_agent_id: agentId,
    p_stat_key: taskStatus === "completed" ? "tasks_completed" : "tasks_failed",
  });

  return {
    success: taskStatus === "completed",
    result: resultSummary,
  };
}
