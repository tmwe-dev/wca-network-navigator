/**
 * playbookLoader.ts — Active commercial workflow playbook loader.
 * Fix 3.2: Loads playbook from partner_workflow_state → commercial_workflows → commercial_playbooks.
 */

type SupabaseClient = ReturnType<typeof (await import("https://esm.sh/@supabase/supabase-js@2.39.3")).createClient>;

export async function loadActivePlaybook(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string | null,
): Promise<{ block: string; active: boolean }> {
  if (!partnerId) return { block: "", active: false };

  const { data: state } = await supabase
    .from("partner_workflow_state")
    .select("workflow_id, status, current_step")
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .eq("status", "active")
    .maybeSingle();

  if (!state?.workflow_id) return { block: "", active: false };

  const { data: workflow } = await supabase
    .from("commercial_workflows")
    .select("code, name")
    .eq("id", state.workflow_id)
    .maybeSingle();

  if (!workflow?.code) return { block: "", active: false };

  const { data: playbooks } = await supabase
    .from("commercial_playbooks")
    .select("name, description, prompt_template, suggested_actions, kb_tags, code")
    .eq("workflow_code", workflow.code)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(1);

  const playbook = playbooks?.[0];
  if (!playbook) return { block: "", active: false };

  const lines: string[] = [
    `# PLAYBOOK ATTIVO — ${playbook.name} (workflow: ${workflow.code}, step: ${state.current_step ?? 0})`,
  ];
  if (playbook.description) lines.push(`Obiettivo: ${playbook.description}`);
  if (playbook.prompt_template) lines.push(`\nIstruzioni operative:\n${playbook.prompt_template}`);
  if (playbook.suggested_actions) {
    const actions = typeof playbook.suggested_actions === "string"
      ? playbook.suggested_actions
      : JSON.stringify(playbook.suggested_actions);
    lines.push(`\nAzioni suggerite: ${actions}`);
  }
  lines.push(`\nQuesto playbook GUIDA tono, contenuto e CTA. Rispetta le istruzioni prima di applicare la KB generica.`);

  return { block: lines.join("\n") + "\n", active: true };
}
