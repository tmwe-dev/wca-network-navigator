/**
 * promptLabGlobalRuns.ts — DAL per persistenza analisi globale Prompt Lab.
 *
 * Ogni "Avvia analisi globale" crea un run. Le proposte vengono aggiornate
 * incrementalmente così il run sopravvive a refresh, crash, errori di rete.
 */
import { supabase } from "@/integrations/supabase/client";

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
    .from("prompt_lab_global_runs" as never)
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
    } as never)
    .select("*")
    .single();

  if (error) throw new Error(`createRun failed: ${error.message}`);
  const row = data as unknown as Record<string, unknown>;
  return parseRun(row);
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
  const payload: Record<string, unknown> = {};
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.progress_current !== undefined) payload.progress_current = updates.progress_current;
  if (updates.proposals !== undefined) payload.proposals = JSON.stringify(updates.proposals);
  if (updates.completed_at !== undefined) payload.completed_at = updates.completed_at;

  const { error } = await supabase
    .from("prompt_lab_global_runs" as never)
    .update(payload as never)
    .eq("id" as never, runId as never);

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
    .from("prompt_lab_global_runs" as never)
    .select("proposals" as never)
    .eq("id" as never, runId as never)
    .single();

  if (readErr || !data) throw new Error(`appendProposal read failed: ${readErr?.message}`);

  const row = data as unknown as Record<string, unknown>;
  let proposals: GlobalRunProposal[];
  try {
    proposals = typeof row.proposals === "string" ? JSON.parse(row.proposals as string) : (row.proposals as GlobalRunProposal[]);
  } catch {
    proposals = [];
  }

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
    .from("prompt_lab_global_runs" as never)
    .select("proposals" as never)
    .eq("id" as never, runId as never)
    .single();

  if (readErr || !data) return;

  const row = data as unknown as Record<string, unknown>;
  let proposals: GlobalRunProposal[];
  try {
    proposals = typeof row.proposals === "string" ? JSON.parse(row.proposals as string) : (row.proposals as GlobalRunProposal[]);
  } catch {
    return;
  }

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
    .from("prompt_lab_global_runs" as never)
    .select("*" as never)
    .eq("user_id" as never, userId as never)
    .is("deleted_at" as never, null as never)
    .in("status" as never, ["improving", "review"] as never)
    .order("updated_at" as never, { ascending: false } as never)
    .limit(1);

  if (error || !data || (data as unknown[]).length === 0) return null;
  const row = (data as unknown[])[0] as Record<string, unknown>;
  return parseRun(row);
}

/**
 * Trova l'ultimo run completato (per storico).
 */
export async function findLastRuns(userId: string, limit = 5): Promise<GlobalRun[]> {
  const { data, error } = await supabase
    .from("prompt_lab_global_runs" as never)
    .select("*" as never)
    .eq("user_id" as never, userId as never)
    .is("deleted_at" as never, null as never)
    .order("updated_at" as never, { ascending: false } as never)
    .limit(limit);

  if (error || !data) return [];
  return (data as unknown[]).map((row) => parseRun(row as Record<string, unknown>));
}

/**
 * Cancella un run (soft delete).
 */
export async function cancelRun(runId: string): Promise<void> {
  const { error } = await supabase
    .from("prompt_lab_global_runs" as never)
    .update({ status: "cancelled", deleted_at: new Date().toISOString() } as never)
    .eq("id" as never, runId as never);

  if (error) throw new Error(`cancelRun failed: ${error.message}`);
}

/**
 * Rollback: ripristina i blocchi salvati da un run al loro valore "before".
 * Ritorna il numero di blocchi ripristinati con successo.
 */
export async function rollbackSavedProposals(runId: string): Promise<number> {
  // Carica il run
  const { data, error } = await supabase
    .from("prompt_lab_global_runs" as never)
    .select("proposals" as never)
    .eq("id" as never, runId as never)
    .single();

  if (error || !data) throw new Error(`rollbackSavedProposals: run non trovato`);

  const row = data as unknown as Record<string, unknown>;
  let proposals: GlobalRunProposal[];
  try {
    proposals = typeof row.proposals === "string"
      ? JSON.parse(row.proposals as string)
      : (row.proposals as GlobalRunProposal[]) ?? [];
  } catch {
    throw new Error("rollbackSavedProposals: proposals corrotte");
  }

  const saved = proposals.filter((p) => p.status === "saved" && p.before);
  let restored = 0;

  for (const p of saved) {
    const src = p.source as Record<string, unknown>;
    const kind = src.kind as string;
    try {
      if (kind === "app_setting") {
        await (supabase as any).from("app_settings").update({ value: p.before }).eq("key", src.key);
        restored++;
      } else if (kind === "kb_entry") {
        await (supabase as any).from("kb_entries").update({ content: p.before }).eq("id", src.id);
        restored++;
      } else if (kind === "operative_prompt") {
        await (supabase as any).from("operative_prompts").update({ [src.field as string]: p.before }).eq("id", src.id);
        restored++;
      } else if (kind === "email_prompt") {
        await (supabase as any).from("email_prompts").update({ [src.field as string]: p.before }).eq("id", src.id);
        restored++;
      } else if (kind === "playbook") {
        await (supabase as any).from("commercial_playbooks").update({ [src.field as string]: p.before }).eq("id", src.id);
        restored++;
      } else if (kind === "agent_persona") {
        await (supabase as any).from("agent_personas").update({ [src.field as string]: p.before }).eq("id", src.id);
        restored++;
      }
    } catch {
      // Skip singolo blocco se fallisce
    }
  }

  // Aggiorna status run a "rolled_back"
  await supabase
    .from("prompt_lab_global_runs" as never)
    .update({ status: "rolled_back" } as never)
    .eq("id" as never, runId as never);

  return restored;
}

function parseRun(row: Record<string, unknown>): GlobalRun {
  let proposals: GlobalRunProposal[];
  try {
    proposals = typeof row.proposals === "string"
      ? JSON.parse(row.proposals as string)
      : (row.proposals as GlobalRunProposal[]) ?? [];
  } catch {
    proposals = [];
  }

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    goal: (row.goal as string) ?? "",
    status: row.status as GlobalRun["status"],
    progress_current: (row.progress_current as number) ?? 0,
    progress_total: (row.progress_total as number) ?? 0,
    proposals,
    system_map: (row.system_map as string) ?? "",
    doctrine_full: (row.doctrine_full as string) ?? "",
    system_mission: (row.system_mission as string) ?? "",
    started_at: row.started_at as string,
    updated_at: row.updated_at as string,
    completed_at: (row.completed_at as string) ?? null,
  };
}
