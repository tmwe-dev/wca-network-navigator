/**
 * toolLoopHandler.ts
 * Executes tool calls in a loop (max 8 iterations).
 * Handles tool result processing, memory tracking, and UI action collection.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "../_shared/sqlEscape.ts";
import { extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { executeTool } from "./toolExecutors.ts";
import type { ToolExecutorDeps } from "./toolExecutors.ts";

export interface ToolLoopState {
  assistantMessage?: Record<string, unknown>;
  allMessages: Record<string, unknown>[];
  lastPartnerResult?: Record<string, unknown>[];
  uiActions: Record<string, unknown>[];
  totalUsage: { prompt_tokens: number; completion_tokens: number };
}

export interface ToolLoopResult {
  state: ToolLoopState;
  iterations: number;
  error?: string;
}

/**
 * Detect if the AI is stuck calling the same tool with same arguments
 */
function detectStuckToolLoop(
  currentSignature: string,
  lastSignature: string,
  repeatedCount: number
): boolean {
  if (currentSignature !== lastSignature) return false;
  return repeatedCount >= 2;
}

/**
 * Auto-save significant tool actions to memory
 */
async function autoSaveToolMemory(
  supabase: SupabaseClient,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
  result: Record<string, unknown>
): Promise<void> {
  const autoSaveTools: Record<
    string,
    (a: Record<string, unknown>, r: Record<string, unknown>) => string | null
  > = {
    send_email: (a) => `Email inviata a ${a.to_email} — oggetto: "${a.subject}"`,
    deep_search_partner: (a) =>
      `Deep search su "${a.company_name || a.partner_id}"`,
    deep_search_contact: (a) => `Deep search contatto: "${a.contact_name || a.contact_id}"`,
    bulk_update_partners: (_a, r) =>
      `Aggiornamento bulk: ${r.updated_count} partner — ${Array.isArray(r.changes) ? (r.changes as string[]).join(", ") : ""}`,
    create_reminder: (a, r) =>
      `Reminder creato: "${a.title}" per ${(r as Record<string, unknown>).company_name} (scadenza: ${a.due_date})`,
    create_activity: (a) => `Attività creata: "${a.title}" (${a.activity_type})`,
  };

  const generator = autoSaveTools[toolName];
  if (!generator) return;

  const content = generator(args, result);
  if (!content) return;

  try {
    const { data: existing } = await supabase
      .from("ai_memory")
      .select("id")
      .eq("user_id", userId)
      .eq("source", "auto_tool")
      .ilike("content", `%${escapeLike(content.substring(0, 40))}%`)
      .gte(
        "created_at",
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      )
      .limit(1);

    if (!existing?.length) {
      supabase
        .from("ai_memory")
        .insert({
          user_id: userId,
          content,
          memory_type: "fact",
          tags: [toolName, new Date().toISOString().split("T")[0]],
          importance: 2,
          level: 1,
          confidence: 0.5,
          decay_rate: 0.02,
          source: "auto_tool",
        })
        .then(() => {})
        .catch((_e: unknown) => {
          /* swallow auto-memory write errors */
        });
    }
  } catch (e) {
  }
}

/**
 * Enrich partner results with services and certifications
 */
async function enrichPartnerResults(
  supabase: SupabaseClient,
  partners: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  const partnerIds = partners.map((p) => p.id as string);
  const [svcRes, certRes] = await Promise.all([
    supabase
      .from("partner_services")
      .select("partner_id, service_category")
      .in("partner_id", partnerIds),
    supabase
      .from("partner_certifications")
      .select("partner_id, certification")
      .in("partner_id", partnerIds),
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

  return partners.map((p) => ({
    ...p,
    country_code:
      (p.country as string)?.match(/\(([A-Z]{2})\)/)?.[1] || "",
    country_name:
      (p.country as string)?.replace(/\s*\([A-Z]{2}\)/, "") || "",
    services: svcMap[p.id as string] || [],
    certifications: certMap[p.id as string] || [],
  }));
}

/**
 * Execute the tool calling loop (max 8 iterations)
 */
export async function executeToolLoop(
  supabase: SupabaseClient,
  toolDeps: ToolExecutorDeps,
  userId: string,
  authHeader: string,
  callAiForLoop: (
    messages: Record<string, unknown>[]
  ) => Promise<{ ok: boolean; data?: Record<string, unknown> }>,
  initialState: ToolLoopState
): Promise<ToolLoopResult> {
  const MAX_ITERATIONS = 8;
  let state = initialState;
  let iterations = 0;
  let lastToolSignature = "";
  let repeatedToolCount = 0;

  while (state.assistantMessage?.tool_calls?.length && iterations < MAX_ITERATIONS) {
    iterations++;

    // Detect repeated tool calls (stuck loop)
    const currentSignature = (
      state.assistantMessage.tool_calls as Array<{
        function: { name: string; arguments: string };
      }>
    )
      .map(
        (tc) =>
          `${tc.function.name}:${tc.function.arguments}`
      )
      .join("|");

    if (currentSignature === lastToolSignature) {
      repeatedToolCount++;
      if (detectStuckToolLoop(currentSignature, lastToolSignature, repeatedToolCount)) {
        break;
      }
    } else {
      repeatedToolCount = 0;
    }
    lastToolSignature = currentSignature;

    const toolResults: Record<string, unknown>[] = [];

    // Execute each tool call
    for (const tc of state.assistantMessage.tool_calls as Array<{
      id: string;
      function: { name: string; arguments: string };
    }>) {
      let args: Record<string, unknown>;
      try {
        args = JSON.parse(tc.function.arguments || "{}");
      } catch (parseErr: unknown) {
        const errMsg = extractErrorMessage(parseErr);
        toolResults.push({
          role: "tool",
          tool_call_id: tc.id,
          content: JSON.stringify({
            success: false,
            error: "INVALID_TOOL_ARGS",
            message: `Tool arguments were not valid JSON: ${errMsg}. Please retry with valid JSON.`,
            raw_arguments_snippet: String(
              tc.function.arguments || ""
            ).substring(0, 200),
          }),
        });
        continue;
      }

      const toolResult = await executeTool(
        tc.function.name,
        args,
        toolDeps,
        userId,
        authHeader
      );
      );
      toolResults.push({
        role: "tool",
        tool_call_id: tc.id,
        content: JSON.stringify(toolResult),
      });

      const tr = toolResult as Record<string, unknown>;

      // Track partner list results
      if (
        tr?.partners &&
        Array.isArray(tr.partners) &&
        tr.partners.length > 0 &&
        tc.function.name === "search_partners"
      ) {
        state.lastPartnerResult = await enrichPartnerResults(
          supabase,
          tr.partners as Record<string, unknown>[]
        );
      }

      // Track UI actions
      if (tr?.ui_action) state.uiActions.push(tr.ui_action as Record<string, unknown>);
      if ((tr?.step_result as Record<string, unknown> | undefined)?.ui_action) {
        state.uiActions.push(
          (tr.step_result as Record<string, unknown>).ui_action as Record<string, unknown>
        );
      }

      // Auto-save significant tool calls
      if (userId && tr?.success) {
        await autoSaveToolMemory(supabase, userId, tc.function.name, args, tr);
      }
    }

    // Update messages and call AI again
    state.allMessages.push(state.assistantMessage);
    state.allMessages.push(...toolResults);

    const loopResponse = await callAiForLoop(state.allMessages);
    if (!loopResponse.ok) {
      return {
        state,
        iterations,
        error: "AI tool-loop failed",
      };
    }

    const result = loopResponse.data as Record<string, unknown>;
    state.assistantMessage = result.choices?.[0]?.message;
    if (result.usage) {
      state.totalUsage.prompt_tokens +=
        (result.usage as Record<string, unknown>)?.prompt_tokens as number || 0;
      state.totalUsage.completion_tokens +=
        (result.usage as Record<string, unknown>)?.completion_tokens as number || 0;
    }
  }

  return {
    state,
    iterations,
  };
}
