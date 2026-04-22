import { escapeLike } from "../shared.ts";

interface KbEntry {
  title: string;
  content: string;
  added_at: string;
}

interface AgentRow {
  id: string;
  name: string;
  role: string;
  is_active: boolean;
  stats: Record<string, unknown>;
  avatar_emoji: string;
  updated_at: string;
  system_prompt: string;
  knowledge_base: unknown;
}

export async function handleCreateAgentTask(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let agentQuery = supabase
    .from("agents")
    .select("id, name")
    .eq("user_id", userId);

  if (args.agent_name) {
    agentQuery = agentQuery.ilike(
      "name",
      `%${escapeLike(args.agent_name as string)}%`
    );
  } else if (args.agent_role) {
    agentQuery = agentQuery.eq("role", args.agent_role);
  }

  const { data: agents } = await agentQuery.limit(1);

  if (!agents || agents.length === 0) {
    return {
      error: `Agente "${args.agent_name || args.agent_role}" non trovato.`,
    };
  }

  const targetAgent = agents[0];

  const { data, error } = await supabase
    .from("agent_tasks")
    .insert({
      agent_id: targetAgent.id,
      user_id: userId,
      task_type: String(args.task_type || "research"),
      description: String(args.description),
      target_filters:
        (args.target_filters || {}) as Record<string, unknown>,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    task_id: data.id,
    agent_name: targetAgent.name,
    message: `Task creato per ${targetAgent.name}: "${args.description}"`,
  };
}

export async function handleListAgentTasks(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  let query = supabase
    .from("agent_tasks")
    .select(
      "id, agent_id, task_type, description, status, result_summary, created_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Number(args.limit) || 30);

  if (args.status) {
    query = query.eq("status", args.status);
  }

  const { data: tasks, error } = await query;

  if (error) {
    return { error: error.message };
  }

  const agentIds = [...new Set((tasks || []).map((t: any) => t.agent_id))];
  const { data: agentsData } = await supabase
    .from("agents")
    .select("id, name")
    .in("id", agentIds);

  const nameMap: Record<string, string> = {};
  for (const a of (agentsData || []) as Array<{ id: string; name: string }>) {
    nameMap[a.id] = a.name;
  }

  let results = (tasks || []).map((t: any) => ({
    ...t,
    agent_name: nameMap[t.agent_id] || "?",
  }));

  if (args.agent_name) {
    results = results.filter((t: any) =>
      (t.agent_name as string)
        .toLowerCase()
        .includes(String(args.agent_name).toLowerCase())
    );
  }

  return { count: results.length, tasks: results };
}

export async function handleGetTeamStatus(
  supabase: any,
  userId: string
): Promise<unknown> {
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, role, is_active, stats, avatar_emoji, updated_at")
    .eq("user_id", userId)
    .order("name");

  if (!agents) {
    return { error: "Nessun agente trovato" };
  }

  const agentIds = agents.map((a: any) => a.id);
  const { data: tasks } = await supabase
    .from("agent_tasks")
    .select("agent_id, status")
    .in("agent_id", agentIds);

  const taskStats: Record<
    string,
    { pending: number; running: number; completed: number; failed: number }
  > = {};

  for (const t of (tasks || []) as Array<{ agent_id: string; status: string }>) {
    if (!taskStats[t.agent_id]) {
      taskStats[t.agent_id] = {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
      };
    }

    if (
      taskStats[t.agent_id][
        t.status as keyof typeof taskStats[string]
      ] !== undefined
    ) {
      taskStats[t.agent_id][
        t.status as keyof typeof taskStats[string]
      ]++;
    }
  }

  return {
    team_size: agents.length,
    active_agents: agents.filter((a: any) => a.is_active).length,
    agents: agents.map((a: AgentRow) => ({
      name: a.name,
      role: a.role,
      emoji: a.avatar_emoji,
      is_active: a.is_active,
      stats: a.stats,
      tasks: taskStats[a.id] || {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
      },
      last_activity: a.updated_at,
    })),
  };
}

export async function handleUpdateAgentPrompt(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, system_prompt")
    .eq("user_id", userId)
    .ilike("name", `%${escapeLike(args.agent_name as string)}%`)
    .limit(1);

  if (!agents || agents.length === 0) {
    return { error: `Agente "${args.agent_name}" non trovato.` };
  }

  const agent = agents[0];
  let newPrompt = agent.system_prompt;

  if (args.replace_prompt) {
    newPrompt = String(args.replace_prompt);
  } else if (args.prompt_addition) {
    newPrompt += "\n\n" + String(args.prompt_addition);
  }

  const { error } = await supabase
    .from("agents")
    .update({
      system_prompt: newPrompt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent.id);

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    agent_name: agent.name,
    prompt_length: newPrompt.length,
    message: `Prompt di ${agent.name} aggiornato.`,
  };
}

export async function handleAddAgentKbEntry(
  supabase: any,
  userId: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, knowledge_base")
    .eq("user_id", userId)
    .ilike("name", `%${escapeLike(args.agent_name as string)}%`)
    .limit(1);

  if (!agents || agents.length === 0) {
    return { error: `Agente "${args.agent_name}" non trovato.` };
  }

  const agent = agents[0];
  const kb = (agent.knowledge_base as KbEntry[]) || [];

  kb.push({
    title: String(args.title),
    content: String(args.content),
    added_at: new Date().toISOString(),
  });

  const { error } = await supabase
    .from("agents")
    .update({
      knowledge_base: kb as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agent.id);

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    agent_name: agent.name,
    kb_entries: kb.length,
    message: `KB entry "${args.title}" aggiunta a ${agent.name}.`,
  };
}
