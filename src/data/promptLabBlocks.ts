/**
 * DAL — creazione rapida di blocchi dal Prompt Lab.
 *
 * Le tre tabelle coinvolte (`operative_prompts`, `email_prompts`,
 * `commercial_playbooks`) hanno drift rispetto ai tipi generati: l'accesso
 * passa dall'unico confine sanzionato (`tFrom`), confinato al DAL.
 */
import { tFrom } from "@/lib/typedSupabase";

async function insertRow(table: string, row: Record<string, unknown>): Promise<void> {
  const { error } = await tFrom(table).insert(row);
  if (error) throw error;
}

export async function insertOperativePromptBlock(input: { name: string; objective: string }): Promise<void> {
  await insertRow("operative_prompts", {
    name: input.name,
    objective: input.objective,
    procedure: "",
    criteria: "",
    is_active: true,
  });
}

export async function insertEmailPromptBlock(input: { title: string; instructions: string }): Promise<void> {
  await insertRow("email_prompts", {
    title: input.title,
    instructions: input.instructions,
    is_active: true,
  });
}

export async function insertPlaybookBlock(input: { name: string; description: string }): Promise<void> {
  await insertRow("commercial_playbooks", {
    name: input.name,
    description: input.description,
    prompt_template: "",
    trigger_conditions: "{}",
    is_active: true,
  });
}
