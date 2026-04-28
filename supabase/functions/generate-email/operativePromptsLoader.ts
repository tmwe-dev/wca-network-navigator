/**
 * operativePromptsLoader.ts — Carica i prompt operativi obbligatori dal Prompt Lab
 * (tabella `operative_prompts`) e li compone in un blocco system ad alta priorità.
 *
 * Filosofia: i prompt taggati "OBBLIGATORIA" rilevanti per il canale email
 * (tag: email | outreach | holding-pattern | post-send | universale)
 * vengono iniettati nel system prompt PRIMA del playbook e dell'arsenal KB,
 * in modo che le regole operative del Prompt Lab abbiano priorità assoluta.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

interface OperativePromptRow {
  id: string;
  name: string;
  context: string | null;
  objective: string | null;
  procedure: string | null;
  criteria: string | null;
  examples: string | null;
  tags: string[] | null;
  priority: number | null;
}

/** Tag che rendono un prompt rilevante per la pipeline email. */
const EMAIL_RELEVANT_TAGS = new Set([
  "email",
  "outreach",
  "holding-pattern",
  "post-send",
  "universale",
  "lead-status",
  "multi-canale",
]);

const MANDATORY_TAG = "OBBLIGATORIA";
const SECTION_CHAR_LIMIT = 800;

function clip(value: string | null | undefined, limit = SECTION_CHAR_LIMIT): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed;
}

function isEmailRelevant(row: OperativePromptRow): boolean {
  const tags = row.tags ?? [];
  if (tags.length === 0) return false;
  return tags.some((t) => EMAIL_RELEVANT_TAGS.has(t));
}

function isMandatory(row: OperativePromptRow): boolean {
  return (row.tags ?? []).includes(MANDATORY_TAG);
}

function renderPrompt(row: OperativePromptRow): string {
  const sections: string[] = [`### ${row.name}${isMandatory(row) ? " — OBBLIGATORIA" : ""}`];
  if (row.objective) sections.push(`**Obiettivo:** ${clip(row.objective)}`);
  if (row.context) sections.push(`**Contesto:** ${clip(row.context)}`);
  if (row.procedure) sections.push(`**Procedura:**\n${clip(row.procedure, 1200)}`);
  if (row.criteria) sections.push(`**Criteri di successo:** ${clip(row.criteria)}`);
  return sections.join("\n");
}

export interface OperativePromptsResult {
  /** Blocco testuale pronto per essere iniettato nel system prompt. Vuoto se nessun prompt. */
  block: string;
  /** Nomi dei prompt iniettati (per debug / blocks). */
  appliedNames: string[];
  /** True se almeno un prompt OBBLIGATORIA è stato iniettato. */
  hasMandatory: boolean;
}

/**
 * Carica i prompt operativi attivi per l'utente e ritorna il blocco da iniettare.
 * Fallisce in modo silenzioso (block="") se la tabella non è raggiungibile,
 * così la generazione email non si blocca mai per questa ragione.
 */
export async function loadOperativePromptsBlock(
  supabase: SupabaseClient,
  userId: string,
): Promise<OperativePromptsResult> {
  try {
    const { data, error } = await supabase
      .from("operative_prompts")
      .select("id, name, context, objective, procedure, criteria, examples, tags, priority")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.warn("[generate-email] operative_prompts load failed:", error.message);
      return { block: "", appliedNames: [], hasMandatory: false };
    }

    const rows = data as OperativePromptRow[];
    const relevant = rows.filter(isEmailRelevant);
    if (relevant.length === 0) {
      return { block: "", appliedNames: [], hasMandatory: false };
    }

    // Mandatory first, then by priority desc (already ordered).
    const sorted = [...relevant].sort((a, b) => {
      const am = isMandatory(a) ? 1 : 0;
      const bm = isMandatory(b) ? 1 : 0;
      if (am !== bm) return bm - am;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });

    const rendered = sorted.map(renderPrompt).join("\n\n");
    const appliedNames = sorted.map((r) => r.name);
    const hasMandatory = sorted.some(isMandatory);

    const header = `## 📐 PROMPT OPERATIVI DAL PROMPT LAB (priorità assoluta)
Le regole sotto provengono dal Prompt Lab dell'utente. Hanno **priorità su KB generica e playbook**.
Applicale SEMPRE. In caso di conflitto, vince la regola OBBLIGATORIA con priorità più alta.`;

    return {
      block: `${header}\n\n${rendered}`,
      appliedNames,
      hasMandatory,
    };
  } catch (e) {
    console.warn("[generate-email] operative_prompts loader exception:", (e as Error).message);
    return { block: "", appliedNames: [], hasMandatory: false };
  }
}