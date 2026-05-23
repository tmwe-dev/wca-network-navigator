/**
 * _shared/playbookLoader.ts — UNIFIED loader for the active commercial playbook.
 *
 * Single source of truth for `partner_workflow_state → commercial_workflows →
 * commercial_playbooks`. Replaces the two near-identical copies that used to
 * live in `generate-email/playbookLoader.ts` and `generate-outreach/playbookLoader.ts`
 * (drift garantito: l'ultima frase divergeva di 5 caratteri).
 *
 * USAGE
 *   const { block, active } = await loadActivePlaybook(supabase, userId, partnerId);
 *
 * BEHAVIOUR
 *   - Restituisce { block: "", active: false } se: partnerId nullo, nessun
 *     workflow attivo, nessun playbook configurato.
 *   - Tono unico: "prima di applicare la KB generica" (versione canonica).
 *   - Mai throw: errori DB → block vuoto, log warn.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export interface ActivePlaybookResult {
  block: string;
  active: boolean;
}

export async function loadActivePlaybook(
  supabase: SupabaseClient,
  userId: string,
  partnerId: string | null,
): Promise<ActivePlaybookResult> {
  if (!partnerId) return { block: "", active: false };

  try {
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
    lines.push(
      `\nQuesto playbook GUIDA tono, contenuto e CTA. Rispetta le istruzioni prima di applicare la KB generica.`,
    );

    return { block: lines.join("\n") + "\n", active: true };
  } catch (e) {
    console.warn("[playbookLoader] exception:", (e as Error).message);
    return { block: "", active: false };
  }
}