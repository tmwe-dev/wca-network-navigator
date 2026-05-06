/**
 * DAL — Funnemail "Lo prendo io" (claim/release/force-claim).
 *
 * La tabella `funnemail_message_claims` è stata creata in una migration
 * più recente della rigenerazione dei tipi Supabase: usiamo cast espliciti.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FunnemailClaimRow {
  message_id: string;
  group_id: string | null;
  claimed_by: string;
  claimed_at: string;
  released_at: string | null;
  user_id: string;
}

export interface FunnemailClaimWithOperator extends FunnemailClaimRow {
  operator_display_name: string | null;
}

const TABLE = "funnemail_message_claims" as const;

/** Lista claim attivi (non ancora rilasciati). Visibilità globale via RLS. */
export async function listActiveFunnemailClaims(
  groupId?: string | null,
): Promise<FunnemailClaimWithOperator[]> {
  let q = (supabase.from as unknown as (t: string) => any)(TABLE)
    .select("message_id, group_id, claimed_by, claimed_at, released_at, user_id")
    .is("released_at", null);
  if (groupId) q = q.eq("group_id", groupId);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as FunnemailClaimRow[];

  // Risolvi display name dal table operators (non-blocking per row)
  const ids = Array.from(new Set(rows.map((r) => r.claimed_by)));
  if (ids.length === 0) return [];

  const { data: ops } = await supabase
    .from("operators")
    .select("user_id, name, email")
    .in("user_id", ids);

  const map = new Map<string, string>();
  for (const o of (ops ?? []) as Array<{ user_id: string | null; name: string | null; email: string | null }>) {
    if (!o.user_id) continue;
    const name = o.name ?? o.email ?? null;
    if (name) map.set(o.user_id, name);
  }

  return rows.map((r) => ({
    ...r,
    operator_display_name: map.get(r.claimed_by) ?? null,
  }));
}

/** Prende in carico un messaggio. Fallisce se già preso da altri (e non sei admin). */
export async function claimFunnemailMessage(args: {
  messageId: string;
  groupId?: string | null;
}): Promise<{ ok: boolean; conflict?: FunnemailClaimRow }> {
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) throw new Error("not_authenticated");

  // Verifica claim esistente attivo
  const { data: existing } = await (supabase.from as unknown as (t: string) => any)(TABLE)
    .select("message_id, group_id, claimed_by, claimed_at, released_at, user_id")
    .eq("message_id", args.messageId)
    .is("released_at", null)
    .maybeSingle();

  const current = existing as FunnemailClaimRow | null;
  if (current && current.claimed_by !== uid) {
    return { ok: false, conflict: current };
  }

  const { error } = await (supabase.from as unknown as (t: string) => any)(TABLE)
    .upsert(
      {
        message_id: args.messageId,
        group_id: args.groupId ?? null,
        claimed_by: uid,
        user_id: uid,
        claimed_at: new Date().toISOString(),
        released_at: null,
      },
      { onConflict: "message_id" },
    );
  if (error) throw error;
  return { ok: true };
}

/** Rilascia il claim (soft, per audit). Solo proprietario o admin via RLS. */
export async function releaseFunnemailMessage(messageId: string): Promise<void> {
  const { error } = await (supabase.from as unknown as (t: string) => any)(TABLE)
    .update({ released_at: new Date().toISOString() })
    .eq("message_id", messageId)
    .is("released_at", null);
  if (error) throw error;
}

/** Forza presa in carico (admin only, RPC SECURITY DEFINER). */
export async function forceClaimFunnemailMessage(args: {
  messageId: string;
  groupId?: string | null;
}): Promise<void> {
  const { error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: unknown }>)("force_claim_message", {
    p_message_id: args.messageId,
    p_group_id: args.groupId ?? null,
  });
  if (error) throw error as Error;
}