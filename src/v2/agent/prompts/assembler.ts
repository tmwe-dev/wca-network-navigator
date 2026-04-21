/**
 * Prompt Assembler (client side)
 *
 * Compone: prompt core leggero + variabili runtime + indice KB + estratti KB selettivi.
 * Filosofia: livello 1 + livello 2 + livello 3 della doctrine prompt.
 */
import { supabase } from "@/integrations/supabase/client";

import lucaPrompt from "./core/luca";
import superAssistantPrompt from "./core/super-assistant";
import contactsAssistantPrompt from "./core/contacts-assistant";
import cockpitAssistantPrompt from "./core/cockpit-assistant";
import emailImproverPrompt from "./core/email-improver";
import dailyBriefingPrompt from "./core/daily-briefing";
import emailClassifierPrompt from "./core/email-classifier";
import queryPlannerPrompt from "./core/query-planner";

const CORE_PROMPTS: Record<string, string> = {
  "luca": lucaPrompt,
  "super-assistant": superAssistantPrompt,
  "contacts-assistant": contactsAssistantPrompt,
  "cockpit-assistant": cockpitAssistantPrompt,
  "email-improver": emailImproverPrompt,
  "daily-briefing": dailyBriefingPrompt,
  "email-classifier": emailClassifierPrompt,
  "query-planner": queryPlannerPrompt,
};

export interface AssembleArgs {
  agentId: string;
  variables?: Record<string, string | number | undefined | null>;
  kbCategories?: string[];
  injectExcerpts?: string[]; // titoli kb_entries da includere inline (estratti)
  excerptCharLimit?: number; // default 800
}

const EXCERPT_DEFAULT = 800;

// LOVABLE-93: KB per domini email (operative/admin/support)
/** Single source of truth: tutte le doctrine + procedure indicizzate di default */
export const DEFAULT_KB_CATEGORIES = ["doctrine", "system_doctrine", "sales_doctrine", "procedures"];

/** KB categories per domain-specific classification (email routing) */
export const DOMAIN_KB_CATEGORIES = {
  operative: ["operative_procedures", "procedures"],
  administrative: ["administrative_procedures", "procedures"],
  support: ["support_procedures", "procedures"],
  domain_routing: ["domain_routing"],
};

export async function assemblePrompt(args: AssembleArgs): Promise<string> {
  const core = CORE_PROMPTS[args.agentId];
  if (!core) throw new Error(`Unknown agentId: ${args.agentId}`);

  const variables = { ...args.variables };

  // Carica indice KB (titoli + categoria) — fallback silenzioso se KB irraggiungibile
  let kbIndex = "(KB non disponibile)";
  let kbExcerpts = "";
  try {
    const cats = args.kbCategories ?? DEFAULT_KB_CATEGORIES;
    const { data: indexRows } = await supabase
      .from("kb_entries")
      .select("title, category, chapter")
      .in("category", cats)
      .eq("is_active", true)
      .order("category")
      .order("priority", { ascending: false });
    if (indexRows && indexRows.length > 0) {
      kbIndex = indexRows.map((r) => `- [${r.category}] ${r.title}`).join("\n");
    }

    if (args.injectExcerpts && args.injectExcerpts.length > 0) {
      const { data: excerptRows } = await supabase
        .from("kb_entries")
        .select("title, content")
        .in("title", args.injectExcerpts)
        .eq("is_active", true);
      if (excerptRows && excerptRows.length > 0) {
        const limit = args.excerptCharLimit ?? EXCERPT_DEFAULT;
        kbExcerpts = excerptRows
          .map((r) => `### ${r.title}\n${(r.content || "").slice(0, limit)}`)
          .join("\n\n");
      }
    }
  } catch {
    // Fallback graceful: l'agente prosegue con guardrail base.
  }

  variables.kb_index = kbIndex;
  variables.kb_excerpts = kbExcerpts;
  if (!variables.current_date) variables.current_date = new Date().toISOString().slice(0, 10);

  const resolved = resolveVariables(core, variables);
  return kbExcerpts ? `${resolved}\n\n## Estratti procedure rilevanti\n${kbExcerpts}` : resolved;
}

function resolveVariables(template: string, vars: Record<string, string | number | undefined | null>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? "" : String(v);
  });
}
