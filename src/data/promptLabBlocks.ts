/**
 * DAL — creazione rapida di blocchi dal Prompt Lab.
 *
 * Le tre tabelle coinvolte (`operative_prompts`, `email_prompts`,
 * `commercial_playbooks`) hanno drift rispetto ai tipi generati: l'accesso
 * passa dall'unico confine sanzionato (`tFrom`), confinato al DAL.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type OperativePromptInsert = Database["public"]["Tables"]["operative_prompts"]["Insert"];
type EmailPromptInsert = Database["public"]["Tables"]["email_prompts"]["Insert"];
type PlaybookInsert = Database["public"]["Tables"]["commercial_playbooks"]["Insert"];

export async function insertOperativePromptBlock(input: { name: string; objective: string }): Promise<void> {
  const row: OperativePromptInsert = {
    name: input.name,
    objective: input.objective,
    procedure: "",
    criteria: "",
    is_active: true,
  };
  const { error } = await supabase.from(TABLE).insert(row);
  if (error) throw error;
}

export async function insertEmailPromptBlock(input: { title: string; instructions: string }): Promise<void> {
  const row: EmailPromptInsert = {
    title: input.title,
    instructions: input.instructions,
    is_active: true,
  };
  const { error } = await supabase.from(TABLE).insert(row);
  if (error) throw error;
}

export async function insertPlaybookBlock(input: { name: string; description: string }): Promise<void> {
  const row: PlaybookInsert = {
    name: input.name,
    description: input.description,
    prompt_template: "",
    trigger_conditions: "{}",
    is_active: true,
  };
  const { error } = await supabase.from(TABLE).insert(row);
  if (error) throw error;
}
