/**
 * agents.ts — Agent configuration and knowledge base management.
 * Handles update_agent_prompt, add_agent_kb_entry tools.
 */

import { escapeLike } from "../../_shared/sqlEscape.ts";

type SupabaseClient = ReturnType<
  typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient
>;

export async function executeUpdateAgentPrompt(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  let agentId = args.agent_id ? String(args.agent_id) : null;
  if (!agentId && args.agent_name) {
    const { data: found } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", `%${escapeLike(String(args.agent_name))}%`)
      .limit(1)
      .single();
    if (found) agentId = (found as Record<string, unknown>).id as string;
  }
  if (!agentId) return { error: "Agente non trovato" };

  let newPrompt: string;
  if (args.replace_prompt) {
    newPrompt = String(args.replace_prompt);
  } else if (args.prompt_addition) {
    const { data: current } = await supabase
      .from("agents")
      .select("system_prompt")
      .eq("id", agentId)
      .single();
    newPrompt =
      ((current as Record<string, unknown>)?.system_prompt || "") +
      "\n\n" +
      String(args.prompt_addition);
  } else {
    return { error: "Specifica replace_prompt o prompt_addition" };
  }

  const { error } = await supabase
    .from("agents")
    .update({
      system_prompt: newPrompt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId);
  if (error) return { error: error.message };
  return {
    success: true,
    agent_id: agentId,
    prompt_length: newPrompt.length,
    message: "Prompt agente aggiornato.",
  };
}

export async function executeAddAgentKbEntry(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  let agentId = args.agent_id ? String(args.agent_id) : null;
  if (!agentId && args.agent_name) {
    const { data: found } = await supabase
      .from("agents")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", `%${escapeLike(String(args.agent_name))}%`)
      .limit(1)
      .single();
    if (found) agentId = (found as Record<string, unknown>).id as string;
  }
  if (!agentId) return { error: "Agente non trovato" };

  const category = String(args.category || "agent_custom");
  const tags = Array.isArray(args.tags)
    ? args.tags.map(String)
    : ["agent"];

  const { data: kbEntry, error: kbErr } = await supabase
    .from("kb_entries")
    .insert({
      user_id: userId,
      title: String(args.title),
      content: String(args.content),
      category,
      chapter: "agent",
      tags,
      priority: 5,
      sort_order: 0,
      is_active: true,
    })
    .select("id, title")
    .single();
  if (kbErr) return { error: kbErr.message };

  const { error: linkErr } = await supabase
    .from("agent_knowledge_links")
    .insert({
      agent_id: agentId,
      kb_entry_id: (kbEntry as Record<string, unknown>).id,
      user_id: userId,
      priority: 5,
    });
  if (linkErr) return { error: linkErr.message };
  return {
    success: true,
    kb_entry: kbEntry,
    agent_id: agentId,
    message: `KB entry "${args.title}" aggiunta all'agente.`,
  };
}
