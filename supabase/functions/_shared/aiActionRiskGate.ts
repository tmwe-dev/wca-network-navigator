/**
 * AI Action Risk Gate (WCA v2.1 adoption — minimal core).
 *
 * Two-phase commit + hard gate helper for ai_pending_actions.
 * - claimAction: atomically transitions pending|approved|failed → executing
 * - finalizeAction: marks executed/failed (closes the two-phase commit)
 * - hardGate: server-side block on lead_status (blacklisted/archived) and
 *   contact blacklist for SEND/BULK/EXTERNAL_AUTOMATION/DESTRUCTIVE.
 *
 * Does NOT replace journalistReview, promptSanitizer, agent_personas.
 * Intended to wrap any edge function that executes a queued AI action.
 */

export type AiActionRisk =
  | "READ"
  | "PREPARE"
  | "WRITE"
  | "SEND"
  | "EXTERNAL_AUTOMATION"
  | "BULK"
  | "DESTRUCTIVE";

// deno-lint-ignore no-explicit-any
type Sb = any;

export interface HardGateResult {
  allowed: boolean;
  reason?: string;
}

export interface ClaimResult {
  ok: boolean;
  reason?: string;
}

/**
 * Atomically claim a pending action for execution (two-phase commit start).
 * Returns ok=false if the action was already executing or in a terminal state.
 */
export async function claimAction(
  supabase: Sb,
  actionId: string,
): Promise<ClaimResult> {
  const { data, error } = await supabase.rpc("claim_pending_action", {
    _action_id: actionId,
  });
  if (error) return { ok: false, reason: `claim_error:${error.message}` };
  if (data !== true) return { ok: false, reason: "already_claimed_or_terminal" };
  return { ok: true };
}

/**
 * Server-side hard gate: never sends to blacklisted/archived targets,
 * regardless of what the AI / UI proposes.
 */
export async function hardGate(
  supabase: Sb,
  risk: AiActionRisk,
  partnerId: string | null,
  contactId: string | null,
): Promise<HardGateResult> {
  const { data, error } = await supabase.rpc("ai_action_hard_gate", {
    _risk: risk,
    _partner_id: partnerId,
    _contact_id: contactId,
  });
  if (error) return { allowed: false, reason: `gate_error:${error.message}` };
  const r = data as { allowed: boolean; reason?: string } | null;
  return r ?? { allowed: false, reason: "gate_no_result" };
}

/**
 * Close the two-phase commit. Use status="executed" on success, "failed" on error.
 */
export async function finalizeAction(
  supabase: Sb,
  actionId: string,
  status: "executed" | "failed",
  lastError?: string,
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    executed_at: new Date().toISOString(),
  };
  if (status === "failed" && lastError) patch.last_error = lastError.slice(0, 500);
  await supabase.from("ai_pending_actions").update(patch).eq("id", actionId);
}

/**
 * Convenience wrapper: claim → gate → run → finalize.
 * Throws on gate denial or claim failure so the caller returns a 4xx/409.
 */
export async function runGuardedAction<T>(
  supabase: Sb,
  opts: {
    actionId: string;
    risk: AiActionRisk;
    partnerId?: string | null;
    contactId?: string | null;
  },
  exec: () => Promise<T>,
): Promise<T> {
  const claim = await claimAction(supabase, opts.actionId);
  if (!claim.ok) {
    const err = new Error(`AI_ACTION_CLAIM_FAILED:${claim.reason}`);
    // deno-lint-ignore no-explicit-any
    (err as any).status = 409;
    throw err;
  }

  const gate = await hardGate(
    supabase,
    opts.risk,
    opts.partnerId ?? null,
    opts.contactId ?? null,
  );
  if (!gate.allowed) {
    await finalizeAction(supabase, opts.actionId, "failed", `hard_gate:${gate.reason}`);
    const err = new Error(`AI_ACTION_HARD_GATE_BLOCKED:${gate.reason}`);
    // deno-lint-ignore no-explicit-any
    (err as any).status = 403;
    throw err;
  }

  try {
    const result = await exec();
    await finalizeAction(supabase, opts.actionId, "executed");
    return result;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finalizeAction(supabase, opts.actionId, "failed", msg);
    throw e;
  }
}