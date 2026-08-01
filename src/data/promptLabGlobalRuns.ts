/**
 * promptLabGlobalRuns.ts — DAL per persistenza analisi globale Prompt Lab.
 *
 * Ogni "Avvia analisi globale" crea un run. Le proposte vengono aggiornate
 * incrementalmente così il run sopravvive a refresh, crash, errori di rete.
 */
import { toJsonValue, asJsonArray } from "@/lib/typedJson";
import { toRecord, toRecordOrNull } from "@/lib/records";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { updateValidatedColumn } from "@/data/validatedQuery";

export interface GlobalRunProposal {
  block_id: string;
  tab_label: string;
  tab_activation?: string;
  source: Record<string, unknown>;
  label: string;
  before: string;
  after?: string;
  status: "pending" | "improving" | "ready" | "skipped" | "error" | "saved";
  error?: string;
}

const PROPOSAL_STATUSES: ReadonlySet<string> = new Set([
  "pending", "improving", "ready", "skipped", "error", "saved",
]);

/**
 * Validatore runtime delle proposte salvate su colonna Json.
 * Le righe che non rispettano il contratto minimo vengono scartate (fail closed).
 */
export function parseProposals(value: unknown): GlobalRunProposal[] {
  const raw = typeof value === "string" ? safeJsonParse(value) : value;
  const out: GlobalRunProposal[] = [];
  for (const item of asJsonArray<unknown>(raw)) {
    const r = toRecordOrNull(item);
    if (!r) continue;
    if (typeof r.block_id !== "string" || typeof r.label !== "string") continue;
    if (typeof r.before !== "string") continue;
    const status = typeof r.status === "string" && PROPOSAL_STATUSES.has(r.status)
      ? (r.status as GlobalRunProposal["status"])
      : "pending";
    out.push({
      block_id: r.block_id,
      tab_label: typeof r.tab_label === "string" ? r.tab_label : "",
      tab_activation: typeof r.tab_activation === "string" ? r.tab_activation : undefined,
      source: toRecord(r.source),
      label: r.label,
      before: r.before,
      after: typeof r.after === "string" ? r.after : undefined,
      status,
      error: typeof r.error === "string" ? r.error : undefined,
    });
  }
  return out;
}

function safeJsonParse(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

export interface GlobalRun {
  id: string;
  user_id: string;
  goal: string;
  status: "collecting" | "improving" | "review" | "saving" | "done" | "failed" | "cancelled";
  progress_current: number;
  progress_total: number;
  proposals: GlobalRunProposal[];
  system_map: string;
  doctrine_full: string;
  system_mission: string;
  started_at: string;
  updated_at: string;
  completed_at: string | null;
}

/**
 * Crea un nuovo run.
 */
export async function createRun(
  userId: string,
  goal: string,
  proposals: GlobalRunProposal[],
  systemMap: string,
  doctrineFull: string,
  systemMission: string,
): Promise<GlobalRun> {
  const { data, error } = await supabase
    .from("prompt_lab_global_runs")
    .insert({
      user_id: userId,
      goal,
      status: "improving",
      progress_current: 0,
      progress_total: proposals.length,
      proposals: JSON.stringify(proposals),
      system_map: systemMap,
      doctrine_full: doctrineFull,
      system_mission: systemMission,
    })
    .select("*")
    .single();

  if (error) throw new Error(`createRun failed: ${error.message}`);
  return parseRun(data);
}

/**
 * Aggiorna progress e proposals di un run.
 */
export async function updateRun(
  runId: string,
  updates: {
    status?: GlobalRun["status"];
    progress_current?: number;
    proposals?: GlobalRunProposal[];
    completed_at?: string;
  },
): Promise<void> {
  const payload: Database["public"]["Tables"]["prompt_lab_global_runs"]["Update"] = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.progress_current !== undefined) payload.progress_current = updates.progress_current;
  if (updates.proposals !== undefined) payload.proposals = JSON.stringify(updates.proposals);
  if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;

  const { error } = await supabase
    .from("prompt_lab_global_runs")
    .update(payload)
    .eq("id", runId);

  if (error) throw new Error(`updateRun failed: ${error.message}`);
}

/**
 * Aggiorna una singola proposta nel run (merge nel JSONB).
 */
export async function appendProposal(
  runId: string,
  index: number,
  proposal: Partial<GlobalRunProposal>,
  progressCurrent: number,
): Promise<void> {
  // Leggi proposte correnti
  const { data, error: readErr } = await supabase
    .from("prompt_lab_global_runs")
    .select("proposals")
    .eq("id", runId)
    .single();

  if (readErr || !data) throw new Error(`appendProposal read failed: ${readErr?.message}`);

  const row = data;
  const proposals: GlobalRunProposal[] = parseProposals(row.proposals);

  if (index < proposals.length) {
    proposals[index] = { ...proposals[index], ...proposal };
  }

  await updateRun(runId, { proposals, progress_current: progressCurrent });
}

/**
 * Marca una proposta come "saved".
 */
export async function markProposalSaved(runId: string, blockId: string): Promise<void> {
  const { data, error: readErr } = await supabase
    .from("prompt_lab_global_runs")
    .select("proposals")
    .eq("id", runId)
    .single();

  if (readErr || !data) return;

  const row = data;
  const proposals: GlobalRunProposal[] = parseProposals(row.proposals);

  const idx = proposals.findIndex((p) => p.block_id === blockId);
  if (idx >= 0) {
    proposals[idx].status = "saved";
    await updateRun(runId, { proposals });
  }
}

/**
 * Trova il run attivo più recente (improving o review) per l'utente.
 */
export async function findActiveRun(userId: string): Promise<GlobalRun | null> {
  const { data, error } = await supabase
    .from("prompt_lab_global_runs")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["improving", "review"])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return null;
  return parseRun(data[0]);
}

/**
 * Trova l'ultimo run completato (per storico).
 */
export async function findLastRuns(userId: string, limit = 5): Promise<GlobalRun[]> {
  const { data, error } = await supabase
    .from("prompt_lab_global_runs")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => parseRun(row));
}

/**
 * Cancella un run (soft delete).
 */
export async function cancelRun(runId: string): Promise<void> {
  const { error } = await supabase
    .from("prompt_lab_global_runs")
    .update({ status: "cancelled", deleted_at: new Date().toISOString() })
    .eq("id", runId);

  if (error) throw new Error(`cancelRun failed: ${error.message}`);
}

/**
 * Rollback: ripristina i blocchi salvati da un run al loro valore "before".
 * Ritorna il numero di blocchi ripristinati con successo.
 */
/**
 * Whitelist dei target di rollback: per ogni `kind` di proposta, la tabella e
 * le sole colonne testuali ripristinabili. Il nome colonna arriva dal payload
 * del run, quindi tutto ciò che non è in whitelist viene scartato (fail closed).
 */
const ROLLBACK_TARGETS: Readonly<Record<string, { table: string; fields: ReadonlySet<string> }>> = {
  operative_prompt: {
    table: "operative_prompts",
    fields: new Set(["name", "objective", "context", "criteria", "procedure", "examples"]),
  },
  email_prompt: {
    table: "email_prompts",
    fields: new Set(["title", "instructions", "scope", "scope_value"]),
  },
  playbook: {
    table: "commercial_playbooks",
    fields: new Set(["name", "description", "prompt_template", "category"]),
  },
  agent_persona: {
    table: "agent_personas",
    fields: new Set(["tone", "custom_tone_prompt", "signature_template", "language"]),
  },
};

export async function rollbackSavedProposals(runId: string): Promise<number> {
  // Carica il run
  const { data, error } = await supabase
    .from("prompt_lab_global_runs")
    .select("proposals")
    .eq("id", runId)
    .single();

  if (error || !data) throw new Error(`rollbackSavedProposals: run non trovato`);

  const proposals: GlobalRunProposal[] = parseProposals(data.proposals);

  const saved = proposals.filter((p) => p.status === "saved" && p.before);
  let restored = 0;

  for (const p of saved) {
    const src = p.source as Record<string, unknown>;
    const kind = src.kind as string;
    try {
      if (kind === "app_setting") {
        await supabase
          .from("app_settings")
          .update({ value: typeof p.before === "string" ? p.before : JSON.stringify(p.before ?? null) })
          .eq("key", String(src.key));
        restored++;
      } else if (kind === "kb_entry") {
        await supabase.from("kb_entries").update({ content: p.before as string }).eq("id", src.id as string);
        restored++;
      } else {
        const target = ROLLBACK_TARGETS[kind];
        const field = String(src.field ?? "");
        if (!target || !target.fields.has(field)) continue;
        await updateValidatedColumn(target.table, field, p.before, {
          column: "id",
          value: src.id,
        });
        restored++;
      }
    } catch {
      // Skip singolo blocco se fallisce
    }
  }

  // Aggiorna status run a "rolled_back"
  await supabase
    .from("prompt_lab_global_runs")
    .update({ status: "rolled_back" })
    .eq("id", runId);

  return restored;
}

function parseRun(row: Database["public"]["Tables"]["prompt_lab_global_runs"]["Row"]): GlobalRun {
  const proposals: GlobalRunProposal[] = parseProposals(row.proposals);

  return {
    id: row.id,
    user_id: row.user_id,
    goal: row.goal ?? "",
    status: row.status as GlobalRun["status"],
    progress_current: row.progress_current ?? 0,
    progress_total: row.progress_total ?? 0,
    proposals,
    system_map: row.system_map ?? "",
    doctrine_full: row.doctrine_full ?? "",
    system_mission: row.system_mission ?? "",
    started_at: row.started_at,
    updated_at: row.updated_at,
    completed_at: row.completed_at ?? null,
  };
}
