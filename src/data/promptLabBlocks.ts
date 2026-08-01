/**
 * DAL — creazione rapida di blocchi dal Prompt Lab.
 *
 * Le tre tabelle coinvolte (`operative_prompts`, `email_prompts`,
 * `commercial_playbooks`) sono presenti nei tipi generati: l'insert usa il
 * client tipizzato, nessun boundary untyped.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

/** `user_id` è NOT NULL su tutte e tre le tabelle: risolto dalla sessione. */
async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) throw new Error("Sessione non disponibile: impossibile creare il blocco.");
  return id;
}

type OperativePromptInsert = Database["public"]["Tables"]["operative_prompts"]["Insert"];
type EmailPromptInsert = Database["public"]["Tables"]["email_prompts"]["Insert"];
type PlaybookInsert = Database["public"]["Tables"]["commercial_playbooks"]["Insert"];

export async function insertOperativePromptBlock(input: { name: string; objective: string }): Promise<void> {
  const row: OperativePromptInsert = {
    user_id: await currentUserId(),
    name: input.name,
    objective: input.objective,
    procedure: "",
    criteria: "",
    is_active: true,
  };
  const { error } = await supabase.from("operative_prompts").insert(row);
  if (error) throw error;
}

export async function insertEmailPromptBlock(input: { title: string; instructions: string }): Promise<void> {
  const row: EmailPromptInsert = {
    user_id: await currentUserId(),
    title: input.title,
    instructions: input.instructions,
    is_active: true,
  };
  const { error } = await supabase.from("email_prompts").insert(row);
  if (error) throw error;
}

export async function insertPlaybookBlock(input: { name: string; description: string }): Promise<void> {
  const row: PlaybookInsert = {
    user_id: await currentUserId(),
    code: input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 60) || "playbook",
    name: input.name,
    description: input.description,
    prompt_template: "",
    trigger_conditions: "{}",
    is_active: true,
  };
  const { error } = await supabase.from("commercial_playbooks").insert(row);
  if (error) throw error;
}
