/**
 * harmonizerSessions — DAL per le sessioni di ingestione documenti grandi
 * (LOVABLE-Harmonizer Library Pipeline).
 *
 * Una sessione = un documento sorgente lungo (es. libreria TMWE 5.708 righe)
 * processato in N chunk sequenziali. Lo stato accumulato (facts, conflicts,
 * cross-references, entities create) è trasportato fra un chunk e l'altro
 * per garantire coerenza inter-chunk.
 *
 * Tabella: public.harmonizer_sessions (migration 20260424123735).
 */
import { supabase } from "@/integrations/supabase/client";

export type HarmonizerSessionStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "error"
  | "cancelled";

export type HarmonizerSourceKind =
  | "library"
  | "mission_output"
  | "email_attachment";

/** Singolo fatto canonico estratto dal documento (numerico o dichiarativo). */
export interface FactEntry {
  key: string;
  value: string;
  source_chunk: number;
  evidence?: string;
}

/** Conflitto rilevato tra due fonti (libreria vs DB, o intra-libreria). */
export interface ConflictEntry {
  id: string;
  topic: string;
  source_a: { ref: string; value: string };
  source_b: { ref: string; value: string };
  status: "pending" | "resolved" | "ignored";
  detected_in_chunk: number;
  notes?: string;
}

/** Riferimento incrociato registrato fra entità (es. agente → playbook). */
export interface CrossRefEntry {
  from: { table: string; id: string; label: string };
  to: { table: string; id: string; label: string };
  relation: string;
  detected_in_chunk: number;
}

/** Entità appena creata da un chunk (per evitare re-INSERT nei chunk successivi). */
export interface EntityCreatedEntry {
  table: string;
  id?: string;
  title: string;
  created_in_chunk: number;
  proposal_id?: string;
}

/** Errore durante un chunk. */
export interface ChunkErrorEntry {
  chunk_index: number;
  message: string;
  occurred_at: string;
}

export interface HarmonizerSession {
  id: string;
  user_id: string;
  source_file: string;
  source_kind: HarmonizerSourceKind;
  total_chunks: number;
  current_chunk: number;
  status: HarmonizerSessionStatus;
  facts_registry: Record<string, FactEntry>;
  conflicts_found: ConflictEntry[];
  cross_references: CrossRefEntry[];
  entities_created: EntityCreatedEntry[];
  errors: ChunkErrorEntry[];
  harmonize_run_id: string | null;
  started_at: string | null;
  last_chunk_completed_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Cap di sicurezza per evitare blow-up del JSON facts_registry (~30KB). */
const MAX_FACTS_BYTES = 30_000;

/** Compatta facts_registry quando supera il cap, mantenendo i più recenti. */
function compactFacts(reg: Record<string, FactEntry>): Record<string, FactEntry> {
  const json = JSON.stringify(reg);
  if (json.length <= MAX_FACTS_BYTES) return reg;
  // Strategy: rimuovi ~30% dei fatti più vecchi (chunk index più basso).
  const entries = Object.entries(reg).sort(
    (a, b) => (b[1].source_chunk ?? 0) - (a[1].source_chunk ?? 0),
  );
  const keep = Math.ceil(entries.length * 0.7);
  return Object.fromEntries(entries.slice(0, keep));
}

export async function createHarmonizerSession(input: {
  userId: string;
  sourceFile: string;
  sourceKind?: HarmonizerSourceKind;
  totalChunks: number;
  harmonizeRunId?: string | null;
  /**
   * Entità da pre-popolare in `entities_created` (bootstrap dal DB reale).
   * Riduce drasticamente i falsi INSERT: il modello vede subito che certe
   * righe esistono già e propone UPDATE invece di INSERT.
   */
  bootstrapEntities?: EntityCreatedEntry[];
}): Promise<HarmonizerSession> {
  const { data, error } = await supabase
    .from("harmonizer_sessions" as never)
    .insert({
      user_id: input.userId,
      source_file: input.sourceFile,
      source_kind: input.sourceKind ?? "library",
      total_chunks: input.totalChunks,
      harmonize_run_id: input.harmonizeRunId ?? null,
      status: "in_progress",
      started_at: new Date().toISOString(),
      entities_created: input.bootstrapEntities ?? [],
    } as never)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as HarmonizerSession;
}

export async function loadHarmonizerSession(id: string): Promise<HarmonizerSession | null> {
  const { data, error } = await supabase
    .from("harmonizer_sessions" as never)
    .select("*" as never)
    .eq("id" as never, id as never)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as HarmonizerSession) ?? null;
}

export async function findActiveHarmonizerSession(userId: string): Promise<HarmonizerSession | null> {
  const { data, error } = await supabase
    .from("harmonizer_sessions" as never)
    .select("*" as never)
    .eq("user_id" as never, userId as never)
    .in("status" as never, ["pending", "in_progress"] as never)
    .order("updated_at" as never, { ascending: false } as never)
    .limit(1);
  if (error) throw error;
  const rows = data as unknown as HarmonizerSession[] | null;
  return rows && rows.length > 0 ? rows[0] : null;
}

/** Append/merge facts (chiave deduplicata). */
export async function appendFacts(
  sessionId: string,
  newFacts: FactEntry[],
): Promise<void> {
  const session = await loadHarmonizerSession(sessionId);
  if (!session) throw new Error("session not found");
  const reg = { ...session.facts_registry };
  for (const f of newFacts) {
    reg[f.key] = f;
  }
  const compacted = compactFacts(reg);
  const { error } = await supabase
    .from("harmonizer_sessions" as never)
    .update({ facts_registry: compacted, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, sessionId as never);
  if (error) throw error;
}

export async function appendConflicts(
  sessionId: string,
  newConflicts: ConflictEntry[],
): Promise<void> {
  if (newConflicts.length === 0) return;
  const session = await loadHarmonizerSession(sessionId);
  if (!session) throw new Error("session not found");
  const merged = [...session.conflicts_found, ...newConflicts];
  const { error } = await supabase
    .from("harmonizer_sessions" as never)
    .update({ conflicts_found: merged, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, sessionId as never);
  if (error) throw error;
}

export async function appendCrossReferences(
  sessionId: string,
  refs: CrossRefEntry[],
): Promise<void> {
  if (refs.length === 0) return;
  const session = await loadHarmonizerSession(sessionId);
  if (!session) throw new Error("session not found");
  const merged = [...session.cross_references, ...refs];
  const { error } = await supabase
    .from("harmonizer_sessions" as never)
    .update({ cross_references: merged, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, sessionId as never);
  if (error) throw error;
}

export async function appendEntities(
  sessionId: string,
  entities: EntityCreatedEntry[],
): Promise<void> {
  if (entities.length === 0) return;
  const session = await loadHarmonizerSession(sessionId);
  if (!session) throw new Error("session not found");
  const merged = [...session.entities_created, ...entities];
  const { error } = await supabase
    .from("harmonizer_sessions" as never)
    .update({ entities_created: merged, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, sessionId as never);
  if (error) throw error;
}

/** Avanza al prossimo chunk e aggiorna timestamp. */
export async function advanceChunk(sessionId: string, nextChunkIndex: number): Promise<void> {
  const { error } = await supabase
    .from("harmonizer_sessions" as never)
    .update({
      current_chunk: nextChunkIndex,
      last_chunk_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id" as never, sessionId as never);
  if (error) throw error;
}

export async function markSessionError(
  sessionId: string,
  err: ChunkErrorEntry,
): Promise<void> {
  const session = await loadHarmonizerSession(sessionId);
  if (!session) throw new Error("session not found");
  const merged = [...session.errors, err];
  const { error } = await supabase
    .from("harmonizer_sessions" as never)
    .update({ errors: merged, updated_at: new Date().toISOString() } as never)
    .eq("id" as never, sessionId as never);
  if (error) throw error;
}

export async function completeHarmonizerSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("harmonizer_sessions" as never)
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id" as never, sessionId as never);
  if (error) throw error;
}

export async function cancelHarmonizerSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("harmonizer_sessions" as never)
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id" as never, sessionId as never);
  if (error) throw error;
}
