/**
 * DAL — Prompt Catalog
 *
 * Aggrega per ogni `operative_prompts` le informazioni utili a una vista catalogo:
 *  - identità (id, nome, contesto, tag, priorità, attivo)
 *  - autore (operator_id, profilo se disponibile, user_id owner)
 *  - versionamento (numero ultima versione, totale snapshot, ultimo cambio)
 *  - orchestratori che consumano il prompt (derivati da `context`/`tags`)
 *  - input sorgenti (campi del prompt: objective/procedure/criteria/examples)
 *
 * NB: nessuna logica UI qui. Hooks/UI restano in src/v2/.
 */
import { supabase } from "@/integrations/supabase/client";

/** Mapping context → edge functions (orchestratori) che assemblano questo prompt. */
export const CONTEXT_TO_ORCHESTRATORS: Record<string, string[]> = {
  email: ["generate-email", "improve-email", "ai-assistant", "agent-execute"],
  "email-quality": ["improve-email"],
  outreach: ["generate-outreach", "agent-execute"],
  "lead-status": ["classify-email-response", "agent-execute"],
  "post-send": ["agent-execute"],
  "multi-channel": ["agent-execute", "agent-loop"],
  whatsapp: ["whatsapp-ai-extract", "agent-execute"],
  inbound: ["classify-inbound-message", "classify-email-response"],
  audit: ["agent-audit", "agent-simulate"],
};

export const ALL_KNOWN_CONTEXTS = Object.keys(CONTEXT_TO_ORCHESTRATORS);

export function orchestratorsForContext(context: string | null | undefined): string[] {
  if (!context) return [];
  return CONTEXT_TO_ORCHESTRATORS[context] ?? [];
}

export interface PromptCatalogItem {
  id: string;
  name: string;
  context: string | null;
  tags: string[];
  priority: number;
  is_active: boolean;
  user_id: string;
  operator_id: string | null;
  operator_name: string | null;
  /** Lunghezza in chars dei singoli campi (per sapere quali "input" sono valorizzati). */
  fields_filled: {
    objective: number;
    procedure: number;
    criteria: number;
    examples: number;
  };
  latest_version: number | null;
  versions_count: number;
  last_change_at: string | null;
  /** Edge functions che consumano questo prompt (derivati da context). */
  orchestrators: string[];
}

/**
 * Catalog completo per l'utente: 1 query per i prompt + 1 query aggregata per le versioni
 * + 1 query per i nomi operatore.
 */
export async function listPromptCatalog(userId: string): Promise<PromptCatalogItem[]> {
  const { data: prompts, error } = await supabase
    .from("operative_prompts")
    .select("id, name, context, tags, priority, is_active, user_id, operator_id, objective, procedure, criteria, examples")
    .eq("user_id", userId)
    .order("priority", { ascending: false });
  if (error) throw error;

  const rows = (prompts ?? []) as Array<{
    id: string;
    name: string;
    context: string | null;
    tags: string[] | null;
    priority: number | null;
    is_active: boolean | null;
    user_id: string;
    operator_id: string | null;
    objective: string | null;
    procedure: string | null;
    criteria: string | null;
    examples: string | null;
  }>;

  if (rows.length === 0) return [];

  const promptIds = rows.map((r) => r.id);
  const operatorIds = Array.from(
    new Set(rows.map((r) => r.operator_id).filter((v): v is string => Boolean(v))),
  );

  // Versioni — fetch in batch e aggregato lato client (più semplice e sicuro di una RPC).
  const { data: versionsData, error: vErr } = await supabase
    .from("prompt_versions")
    .select("prompt_id, version_number, created_at")
    .in("prompt_id", promptIds);
  if (vErr) throw vErr;

  const versionsByPrompt = new Map<string, { latest: number; count: number; last: string | null }>();
  for (const v of (versionsData ?? []) as Array<{ prompt_id: string; version_number: number; created_at: string }>) {
    const cur = versionsByPrompt.get(v.prompt_id) ?? { latest: 0, count: 0, last: null };
    cur.count += 1;
    if (v.version_number > cur.latest) cur.latest = v.version_number;
    if (!cur.last || v.created_at > cur.last) cur.last = v.created_at;
    versionsByPrompt.set(v.prompt_id, cur);
  }

  // Profili operatori (display_name) — best effort.
  const operatorNameById = new Map<string, string>();
  if (operatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, full_name")
      .in("id", operatorIds);
    for (const p of (profiles ?? []) as Array<{ id: string; display_name: string | null; full_name: string | null }>) {
      operatorNameById.set(p.id, p.display_name || p.full_name || "");
    }
  }

  return rows.map((r) => {
    const v = versionsByPrompt.get(r.id);
    return {
      id: r.id,
      name: r.name,
      context: r.context,
      tags: r.tags ?? [],
      priority: r.priority ?? 0,
      is_active: Boolean(r.is_active),
      user_id: r.user_id,
      operator_id: r.operator_id,
      operator_name: r.operator_id ? operatorNameById.get(r.operator_id) ?? null : null,
      fields_filled: {
        objective: (r.objective ?? "").length,
        procedure: (r.procedure ?? "").length,
        criteria: (r.criteria ?? "").length,
        examples: (r.examples ?? "").length,
      },
      latest_version: v ? v.latest : null,
      versions_count: v ? v.count : 0,
      last_change_at: v ? v.last : null,
      orchestrators: orchestratorsForContext(r.context),
    };
  });
}