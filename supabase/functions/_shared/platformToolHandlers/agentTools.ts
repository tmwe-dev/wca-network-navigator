/**
 * agentTools.ts — Agent management, work plans, aliases, and delete operations.
 */
import { escapeLike } from "../sqlEscape.ts";
import { supabase, type AgentRow, type AgentTaskRow, type WorkPlanStep } from "../platformToolHelpers.ts";

export async function executeAgentToolHandler(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  switch (name) {
    case "create_agent_task": {
      let agentQuery = supabase.from("agents").select("id, name").eq("user_id", userId);
      if (args.agent_name)
        agentQuery = agentQuery.ilike("name", `%${escapeLike(String(args.agent_name))}%`);
      else if (args.agent_role) agentQuery = agentQuery.eq("role", args.agent_role);
      const { data: agents } = await agentQuery.limit(1);
      if (!agents || agents.length === 0) return { error: `Agente non trovato.` };
      const targetAgent = agents[0];
      const { data, error } = await supabase
        .from("agent_tasks")
        .insert({
          agent_id: targetAgent.id,
          user_id: userId,
          task_type: String(args.task_type || "research"),
          description: String(args.description),
          target_filters: (args.target_filters || {}) as Record<string, unknown>,
        })
        .select("id")
        .single();
      if (error) return { error: error.message };
      return { success: true, task_id: data.id, agent_name: targetAgent.name, message: `Task creato per ${targetAgent.name}.` };
    }

    case "list_agent_tasks": {
      let query = supabase
        .from("agent_tasks")
        .select("id, agent_id, task_type, description, status, result_summary, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Number(args.limit) || 30);
      if (args.status) query = query.eq("status", args.status);
      const { data: tasks, error } = await query;
      if (error) return { error: error.message };
      const agentIds = [...new Set((tasks || []).map((t: AgentTaskRow) => t.agent_id))];
      const { data: agentsData } = await supabase.from("agents").select("id, name").in("id", agentIds);
      const nameMap: Record<string, string> = {};
      for (const a of (agentsData || []) as { id: string; name: string }[]) nameMap[a.id] = a.name;
      let results = (tasks || []).map((t: AgentTaskRow) => ({
        ...t,
        agent_name: nameMap[t.agent_id] || "?",
      }));
      if (args.agent_name)
        results = results.filter((t) =>
          t.agent_name.toLowerCase().includes(String(args.agent_name).toLowerCase()),
        );
      return { count: results.length, tasks: results };
    }

    case "get_team_status": {
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name, role, is_active, stats, avatar_emoji, updated_at")
        .eq("user_id", userId)
        .order("name");
      if (!agents) return { error: "Nessun agente trovato" };
      const agentIds = agents.map((a: AgentRow) => a.id);
      const { data: tasks } = await supabase.from("agent_tasks").select("agent_id, status").in("agent_id", agentIds);
      const taskStats: Record<string, { pending: number; running: number; completed: number; failed: number }> = {};
      for (const t of (tasks || []) as { agent_id: string; status: string }[]) {
        if (!taskStats[t.agent_id])
          taskStats[t.agent_id] = { pending: 0, running: 0, completed: 0, failed: 0 };
        if (taskStats[t.agent_id][t.status as keyof typeof taskStats[string]] !== undefined)
          taskStats[t.agent_id][t.status as keyof typeof taskStats[string]]++;
      }
      return {
        team_size: agents.length,
        active_agents: agents.filter((a: AgentRow) => a.is_active).length,
        agents: agents.map((a: AgentRow) => ({
          name: a.name,
          role: a.role,
          emoji: a.avatar_emoji,
          is_active: a.is_active,
          stats: a.stats,
          tasks: taskStats[a.id] || { pending: 0, running: 0, completed: 0, failed: 0 },
          last_activity: a.updated_at,
        })),
      };
    }

    case "create_work_plan": {
      const rawSteps = ((args.steps as WorkPlanStep[]) || []).map((s: WorkPlanStep, i: number) => ({
        index: i,
        title: s.title || `Step ${i + 1}`,
        description: s.description || "",
        status: "pending",
      }));
      const { data, error } = await supabase
        .from("ai_work_plans")
        .insert({
          user_id: userId,
          title: String(args.title),
          description: String(args.description || ""),
          steps: rawSteps as unknown as Record<string, unknown>[],
          status: "active",
          tags: (args.tags || []) as string[],
        })
        .select("id, title")
        .single();
      if (error) return { error: error.message };
      return {
        success: true,
        plan_id: data.id,
        title: data.title,
        total_steps: rawSteps.length,
      };
    }

    case "list_work_plans": {
      let query = supabase
        .from("ai_work_plans")
        .select("id, title, description, status, current_step, steps, tags, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(Number(args.limit) || 20);
      if (args.status) query = query.eq("status", args.status);
      const { data, error } = await query;
      if (error) return { error: error.message };
      const plans = (data || []).map(
        (p: {
          id: string;
          title: string;
          description: string | null;
          status: string;
          current_step: number;
          steps: unknown;
          tags: string[];
          created_at: string;
        }) => ({
          ...p,
          total_steps: Array.isArray(p.steps) ? p.steps.length : 0,
          completed_steps: Array.isArray(p.steps)
            ? (p.steps as WorkPlanStep[]).filter((s) => s.status === "completed").length
            : 0,
        }),
      );
      return { count: plans.length, plans };
    }

    case "generate_aliases": {
      const body: Record<string, unknown> = {
        type: args.type || "company",
        limit: Number(args.limit) || 20,
      };
      if (args.partner_ids) body.partner_ids = args.partner_ids;
      if (args.country_code) body.country_code = String(args.country_code).toUpperCase();
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-aliases`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
    }

    case "delete_records": {
      const table = String(args.table);
      const ids = args.ids as string[];
      const valid = ["partners", "prospects", "activities", "reminders"];
      if (!valid.includes(table)) return { error: `Tabella non valida: ${table}` };
      const { error } = await supabase.from(table as "partners").delete().eq("user_id", userId).in("id", ids);
      return error ? { error: error.message } : { success: true, deleted: ids.length };
    }

    default:
      return { error: `Unknown agent tool: ${name}` };
  }
}
