/**
 * aiActions.ts — AI pending actions, approvals, rejections, and memory.
 * Handles get_pending_actions, approve_ai_action, reject_ai_action, detect_language,
 * suggest_next_contacts tools.
 */

import { extractErrorMessage } from "../../_shared/handleEdgeError.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof import("https://esm.sh/@supabase/supabase-js@2.39.3").createClient<any>>;

export async function executeGetPendingActions(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const status = String(args.status || "pending");
  let q = supabase
    .from("ai_pending_actions")
    .select(
      "id, action_type, confidence, reasoning, suggested_content, partner_id, contact_id, email_address, status, created_at, source",
    )
    .eq("user_id", userId)
    .eq("status", status)
    .order("confidence", { ascending: false })
    .limit(Number(args.limit) || 20);
  if (args.action_type) q = q.eq("action_type", String(args.action_type));
  const { data, error } = await q;
  if (error) return { error: error.message };
  return { count: data?.length || 0, actions: data || [] };
}

export async function executeApproveAiAction(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const actionId = String(args.action_id);
  const { error } = await supabase
    .from("ai_pending_actions")
    .update({
      status: "approved",
      executed_at: new Date().toISOString(),
    })
    .eq("id", actionId)
    .eq("user_id", userId);
  if (error) return { error: error.message };
  return { success: true, message: `Azione ${actionId} approvata.` };
}

export async function executeRejectAiAction(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
): Promise<unknown> {
  const actionId = String(args.action_id);
  const reason = args.reason ? String(args.reason) : null;
  const updatePayload: Record<string, unknown> = { status: "rejected" };
  if (reason) updatePayload.reasoning = reason;
  const { error } = await supabase
    .from("ai_pending_actions")
    .update(updatePayload)
    .eq("id", actionId)
    .eq("user_id", userId);
  if (error) return { error: error.message };

  if (reason && userId) {
    supabase
      .from("ai_memory")
      .insert({
        user_id: userId,
        memory_type: "decision",
        content: `L'utente ha rifiutato un'azione AI (${actionId}). Motivo: "${reason}". Non ripetere questo tipo di azione in futuro senza chiedere conferma.`,
        tags: [
          "feedback_negativo",
          "correzione_utente",
          "azione_rifiutata",
        ],
        level: 1,
        importance: 4,
        confidence: 0.6,
        decay_rate: 0.01,
        source: "user_rejection",
      })
      .then(() => {})
      .catch((e: unknown) =>
        console.warn("rejection memory save failed:", extractErrorMessage(e))
      );
  }

  return { success: true, message: `Azione ${actionId} rifiutata.` };
}

export async function executeSuggestNextContacts(
  authHeader?: string,
  args?: Record<string, unknown>,
): Promise<unknown> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(
    `${supabaseUrl}/functions/v1/ai-arena-suggest`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authHeader || serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        focus: (args?.focus as string) || "tutti",
        preferred_channel: (args?.channel as string) || "email",
        batch_size: Math.min(Number(args?.batch_size) || 5, 10),
        excluded_ids: [],
      }),
    },
  );
  if (!res.ok) return { error: await res.text() };
  return await res.json();
}

export async function executeDetectLanguage(
  args: Record<string, unknown>,
): Promise<unknown> {
  const { getLanguageHint } = await import(
    "../../_shared/textUtils.ts"
  );
  const hint = getLanguageHint(String(args.country_code || "US"));
  return { country_code: args.country_code, ...hint };
}
