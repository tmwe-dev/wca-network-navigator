// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AGENT EXECUTE - Main Edge Function Entry Point
// Orchestrates auth, context, prompt assembly, execution modes
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight, supabase } from "./shared.ts";
import { ALL_TOOLS } from "./toolDefs.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";

type AgentRow = {
  id: string;
  name: string;
  role: string;
  is_active?: boolean | null;
  stats?: Record<string, unknown> | null;
  avatar_emoji?: string | null;
};
type ToolDefinition = Record<string, unknown>;

// Modular imports
import { authenticateRequest, validateAgent, validateRequestBody } from "./auth.ts";
import { buildContextBlock, buildLearningBlock, buildMissionBlock } from "./contextInjection.ts";
import { loadAgentPersona, assembleSystemPrompt } from "./systemPrompt.ts";
import { executeChatMode } from "./chatMode.ts";
import { handleStateTransition, handleGeneralTask } from "./taskMode.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  const metrics = startMetrics("agent-execute");

  try {
    // ━━━ AUTHENTICATION ━━━
    const authResult = await authenticateRequest(req, dynCors);
    if (authResult.error) return authResult.error;
    const { userId, authHeader, authClient } = authResult.auth;

    // Rate limiting
    const rl = checkRateLimit(`agent-execute:${userId}`, { maxTokens: 15, refillRate: 0.25 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    // ━━━ REQUEST PARSING ━━━
    const body = await req.json();
    const { agent_id, task_id, chat_messages } = body;

    // Validate required agent_id
    const agentIdErr = validateRequestBody({ agent_id }, ["agent_id"], dynCors);
    if (agentIdErr) return agentIdErr;

    // ━━━ LOAD AGENT ━━━
    const agentResult = await validateAgent(supabase, agent_id, userId, dynCors);
    if (agentResult.error) return agentResult.error;
    const agent = agentResult.agent as Record<string, unknown>;

    // ━━━ CONTEXT ASSEMBLY ━━━
    // Load all agents for team context
    const { data: allAgentsData } = await supabase
      .from("agents")
      .select("id, name, role, is_active, stats, avatar_emoji")
      .eq("user_id", userId);
    const allAgents = (allAgentsData ?? []) as AgentRow[];

    // Build context blocks
    const contextBlock = await buildContextBlock(supabase, userId, agent_id, allAgents);
    const learningBlock = await buildLearningBlock(supabase, agent_id);
    const missionBlock = await buildMissionBlock(supabase, body.mission_id);

    // ━━━ SYSTEM PROMPT ASSEMBLY ━━━
    const { persona, kbEntries: personaKbEntries } = await loadAgentPersona(supabase, agent_id, userId);
    const agentKb = agent.knowledge_base as Array<{ title: string; content: string }> | null;

    const systemPrompt = await assembleSystemPrompt(
      supabase,
      agent.system_prompt as string,
      persona,
      personaKbEntries,
      agentKb,
      contextBlock,
      learningBlock,
      missionBlock,
      userId
    );

    // ━━━ TOOL FILTERING ━━━
    const assignedTools = (agent.assigned_tools as string[]) || [];
    const agentTools = assignedTools
      .map((name: string) => ALL_TOOLS[name] as ToolDefinition | undefined)
      .filter((tool): tool is ToolDefinition => Boolean(tool));

    // ━━━ EXECUTION DISPATCH ━━━

    // CHAT MODE: Conversational interaction with tool support
    if (chat_messages && Array.isArray(chat_messages)) {
      const response = await executeChatMode(
        supabase,
        systemPrompt,
        chat_messages,
        agentTools,
        agent_id,
        agent.name as string,
        userId,
        authHeader,
        Deno.env.get("LOVABLE_API_KEY") || ""
      );
      endMetrics(metrics, true, 200);
      return new Response(response.body, {
        status: response.status,
        headers: { ...dynCors, ...Object.fromEntries(response.headers.entries()) },
      });
    }

    // TASK MODE: Execute specific task types
    if (task_id) {
      const { data: task, error: taskErr } = await supabase
        .from("agent_tasks")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", userId)
        .single();

      if (taskErr || !task) {
        endMetrics(metrics, false, 404);
        return new Response(JSON.stringify({ error: "Task non trovato" }), {
          status: 404,
          headers: { ...dynCors, "Content-Type": "application/json" },
        });
      }

      await supabase
        .from("agent_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task_id);

      try {
        // Handle special task types
        if (task.task_type === "state_transition") {
           const result = await handleStateTransition(supabase, task, task_id, agent_id, agent.name as string, userId);
           endMetrics(metrics, true, 200);
          return new Response(JSON.stringify(result), {
            headers: { ...dynCors, "Content-Type": "application/json" },
          });
        }

        // Handle general task execution
        const result = await handleGeneralTask(
          supabase,
          task,
          task_id,
          systemPrompt,
          agentTools,
          agent_id,
          agent.name as string,
          userId,
          authHeader,
          Deno.env.get("LOVABLE_API_KEY") || ""
        );

        endMetrics(metrics, true, 200);
        return new Response(JSON.stringify({ success: result.success, result: result.result }), {
          headers: { ...dynCors, "Content-Type": "application/json" },
        });
      } catch (taskErr) {
        console.error("Task execution error:", taskErr);
        endMetrics(metrics, false, 500);
        return new Response(
          JSON.stringify({ error: taskErr instanceof Error ? taskErr.message : "Errore durante l'esecuzione del task" }),
          {
            status: 500,
            headers: { ...dynCors, "Content-Type": "application/json" },
          }
        );
      }
    }

    // No execution mode specified
    endMetrics(metrics, false, 400);
    return new Response(JSON.stringify({ error: "Specificare chat_messages o task_id" }), {
      status: 400,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (err) {
    logEdgeError("agent-execute", err);
    endMetrics(metrics, false, 500);
    console.error("agent-execute error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Errore interno" }), {
      status: 500,
      headers: {
        ...getCorsHeaders(req.headers.get("origin")),
        "Content-Type": "application/json",
      },
    });
  }
});
