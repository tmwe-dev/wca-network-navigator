/**
 * _shared/operativePromptsLoader.ts — UNIFIED loader for the Prompt Lab.
 *
 * Single source of truth for injecting `operative_prompts` into ANY edge
 * function that produces AI output. Replaces the duplicated logic that used
 * to live in `generate-email/operativePromptsLoader.ts` and the simplified
 * loaders in `ai-assistant/contextLoaders.ts` and
 * `agent-execute/contextInjection.ts`.
 *
 * USAGE
 *   const { block } = await loadOperativePrompts(supabase, userId, {
 *     scope: "outreach",          // "email" | "outreach" | "whatsapp" | ...
 *     channel: "whatsapp",        // optional, used for tag matching
 *     includeUniversal: true,     // pulls "post-send" / "universale" prompts
 *     limit: 6,                   // default 6 (was hard-coded 5 in some places)
 *   });
 *
 * MATCHING RULES (deterministic)
 *   1. Mandatory prompts (tag = OBBLIGATORIA) come first, ordered by priority.
 *   2. A prompt matches when EITHER:
 *        - row.context === scope (or one of `extraContexts`)
 *        - row.tags ∩ activeTags ≠ ∅
 *   3. If `includeUniversal`, prompts tagged `universale` or `post-send` are
 *      always merged in.
 *   4. The merged set is clipped to `limit` rows AFTER mandatory prioritisation.
 *
 * The function NEVER throws: on error it returns an empty block so AI calls
 * are never blocked by a Prompt Lab outage.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;

export type PromptScope =
  | "email"
  | "email-quality"
  | "outreach"
  | "whatsapp"
  | "linkedin"
  | "multi-channel"
  | "lead-status"
  | "post-send"
  | "classification"
  | "agent-loop"
  | "general";

/** Canonical mapping scope → contexts/tags accepted from the DB. */
const SCOPE_MAP: Record<PromptScope, { contexts: string[]; tags: string[] }> = {
  "email":          { contexts: ["email"],                         tags: ["email", "outreach"] },
  "email-quality":  { contexts: ["email-quality", "email"],        tags: ["email-quality", "copywriting", "email"] },
  "outreach":       { contexts: ["outreach", "multi-channel"],     tags: ["outreach", "multi-canale", "workflow"] },
  "whatsapp":       { contexts: ["whatsapp", "multi-channel"],     tags: ["whatsapp", "multi-canale", "gate-hard"] },
  "linkedin":       { contexts: ["linkedin", "multi-channel"],     tags: ["linkedin", "multi-canale"] },
  "multi-channel":  { contexts: ["multi-channel"],                 tags: ["multi-canale", "sequenza"] },
  "lead-status":    { contexts: ["lead-status"],                   tags: ["lead-status", "qualification", "9-stati"] },
  "post-send":      { contexts: ["post-send"],                     tags: ["post-send", "checklist"] },
  "classification": { contexts: ["lead-status", "email-quality"],  tags: ["lead-status", "qualification", "classification"] },
  "agent-loop":     { contexts: ["outreach", "multi-channel", "lead-status"], tags: ["workflow", "outreach", "lead-status"] },
  "general":        { contexts: [],                                tags: [] },
};

const UNIVERSAL_TAGS = new Set(["universale", "post-send"]);
const MANDATORY_TAG = "OBBLIGATORIA";
const SECTION_CHAR_LIMIT = 800;
const PROCEDURE_CHAR_LIMIT = 1200;

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

function clip(value: string | null | undefined, limit = SECTION_CHAR_LIMIT): string {
  if (!value) return "";
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}…` : trimmed;
}

function isMandatory(row: OperativePromptRow): boolean {
  return (row.tags ?? []).includes(MANDATORY_TAG);
}

function renderPrompt(row: OperativePromptRow): string {
  const sections: string[] = [`### ${row.name}${isMandatory(row) ? " — OBBLIGATORIA" : ""}`];
  if (row.objective) sections.push(`**Obiettivo:** ${clip(row.objective)}`);
  if (row.context) sections.push(`**Contesto:** ${row.context}`);
  if (row.procedure) sections.push(`**Procedura:**\n${clip(row.procedure, PROCEDURE_CHAR_LIMIT)}`);
  if (row.criteria) sections.push(`**Criteri di successo:** ${clip(row.criteria)}`);
  return sections.join("\n");
}

export interface LoadOperativePromptsOptions {
  scope: PromptScope;
  /** Extra contexts to accept beyond the scope mapping (e.g. ["holding-pattern"]). */
  extraContexts?: string[];
  /** Extra tags to accept beyond the scope mapping. */
  extraTags?: string[];
  /** Channel hint used to widen tag matching (e.g. "whatsapp" → tag "whatsapp"). */
  channel?: "email" | "whatsapp" | "linkedin" | "sms" | string | null;
  /** Pull in prompts tagged `universale` / `post-send`. Default: true. */
  includeUniversal?: boolean;
  /** Hard cap on number of prompts after sorting. Default: 6. */
  limit?: number;
}

export interface OperativePromptsResult {
  /** Markdown block ready to be injected into a system prompt. Empty if no match. */
  block: string;
  appliedNames: string[];
  hasMandatory: boolean;
  /** Per-debug: scope/context/tag set actually used for matching. */
  matched: { contexts: string[]; tags: string[] };
}

function buildMatchSet(opts: LoadOperativePromptsOptions): { contexts: Set<string>; tags: Set<string> } {
  const map = SCOPE_MAP[opts.scope] ?? SCOPE_MAP["general"];
  const contexts = new Set<string>([...map.contexts, ...(opts.extraContexts ?? [])]);
  const tags = new Set<string>([...map.tags, ...(opts.extraTags ?? [])]);
  if (opts.channel && typeof opts.channel === "string") tags.add(opts.channel.toLowerCase());
  if (opts.includeUniversal !== false) {
    for (const t of UNIVERSAL_TAGS) tags.add(t);
  }
  return { contexts, tags };
}

function isRelevant(row: OperativePromptRow, contexts: Set<string>, tags: Set<string>): boolean {
  if (row.context && contexts.has(row.context)) return true;
  const rowTags = row.tags ?? [];
  for (const t of rowTags) if (tags.has(t)) return true;
  return false;
}

/**
 * Load and render the Prompt Lab block for a given AI scope.
 */
export async function loadOperativePrompts(
  supabase: SupabaseClient,
  userId: string,
  options: LoadOperativePromptsOptions,
): Promise<OperativePromptsResult> {
  const matched = buildMatchSet(options);
  const limit = Math.max(1, Math.min(options.limit ?? 6, 20));

  try {
    if (!userId) {
      return { block: "", appliedNames: [], hasMandatory: false, matched: { contexts: [...matched.contexts], tags: [...matched.tags] } };
    }
    const { data, error } = await supabase
      .from("operative_prompts")
      .select("id, name, context, objective, procedure, criteria, examples, tags, priority")
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    if (error || !data || data.length === 0) {
      if (error) console.warn("[operativePromptsLoader] load failed:", error.message);
      return { block: "", appliedNames: [], hasMandatory: false, matched: { contexts: [...matched.contexts], tags: [...matched.tags] } };
    }

    const rows = data as OperativePromptRow[];
    const relevant = rows.filter((r) => isRelevant(r, matched.contexts, matched.tags));
    if (relevant.length === 0) {
      return { block: "", appliedNames: [], hasMandatory: false, matched: { contexts: [...matched.contexts], tags: [...matched.tags] } };
    }

    // Mandatory first, then by priority desc.
    const sorted = [...relevant].sort((a, b) => {
      const am = isMandatory(a) ? 1 : 0;
      const bm = isMandatory(b) ? 1 : 0;
      if (am !== bm) return bm - am;
      return (b.priority ?? 0) - (a.priority ?? 0);
    }).slice(0, limit);

    const rendered = sorted.map(renderPrompt).join("\n\n");
    const appliedNames = sorted.map((r) => r.name);
    const hasMandatory = sorted.some(isMandatory);

    const header = `## 📐 PROMPT OPERATIVI DAL PROMPT LAB (priorità assoluta)
Le regole sotto provengono dal Prompt Lab dell'utente (scope: \`${options.scope}\`${options.channel ? ", canale: `" + options.channel + "`" : ""}).
Hanno **priorità su KB generica e playbook**. Applicale SEMPRE.
In caso di conflitto, vince la regola **OBBLIGATORIA** con priorità più alta.`;

    return {
      block: `${header}\n\n${rendered}`,
      appliedNames,
      hasMandatory,
      matched: { contexts: [...matched.contexts], tags: [...matched.tags] },
    };
  } catch (e) {
    console.warn("[operativePromptsLoader] exception:", (e as Error).message);
    return { block: "", appliedNames: [], hasMandatory: false, matched: { contexts: [...matched.contexts], tags: [...matched.tags] } };
  }
}

/**
 * Backwards-compat shim for the legacy `generate-email` loader.
 * Keeps the email pipeline behaviour identical (scope=email + universal).
 */
export async function loadOperativePromptsBlock(
  supabase: SupabaseClient,
  userId: string,
): Promise<OperativePromptsResult> {
  return loadOperativePrompts(supabase, userId, {
    scope: "email",
    extraContexts: ["holding-pattern"],
    extraTags: ["holding-pattern", "lead-status", "multi-canale"],
    includeUniversal: true,
    limit: 8,
  });
}