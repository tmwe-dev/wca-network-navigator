/**
 * bounceAndUnsubscribeHandler.ts — Handling for bounce and unsubscribe categories.
 * Extracted from postClassificationPipeline.ts
 */

import { applyLeadStatusChange } from "./leadStatusGuard.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface PostClassificationResult {
  actionsExecuted: string[];
  statusChanged: boolean;
  pendingActionCreated: boolean;
  reminderCreated: boolean;
  errors: string[];
}

export interface BounceHandlerInput {
  userId: string;
  partnerId?: string | null;
  confidence: number;
  senderEmail: string;
  category: string;
  aiSummary?: string;
}

/**
 * BOUNCE
 */
export async function handleBounce(
  supabase: SupabaseClient,
  input: BounceHandlerInput,
  result: PostClassificationResult,
) {
  const email = input.senderEmail.toLowerCase().trim();

  try {
    await supabase
      .from("imported_contacts")
      .update({ email_status: "bounced" })
      .ilike("email", email);
    await supabase
      .from("partners")
      .update({ email_status: "bounced" })
      .ilike("email", email);
    result.actionsExecuted.push("email_marked_bounced");
  } catch (e) {
    result.errors.push(`Bounce mark failed: ${e}`);
  }

  try {
    await supabase.from("email_address_rules").upsert(
      {
        user_id: input.userId,
        email_address: email,
        auto_action: "archive",
        reason: "hard_bounce_detected",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email_address" },
    );
    result.actionsExecuted.push("archive_rule_created");
  } catch {
    // Tabella potrebbe non esistere
  }

  if (input.partnerId) {
    try {
      await supabase.from("ai_pending_actions").insert({
        user_id: input.userId,
        partner_id: input.partnerId,
        action_type: "suggest_alternative_channel",
        action_payload: {
          bounced_email: email,
          suggested_action:
            "Email bounce rilevato. Prova canale alternativo: LinkedIn o telefono dal profilo WCA.",
        },
        status: "pending",
        priority: "normal",
      });
      result.pendingActionCreated = true;
      result.actionsExecuted.push("suggest_alternative_channel");
    } catch (e) {
      result.errors.push(`Alt channel suggestion failed: ${e}`);
    }
  }
}

/**
 * UNSUBSCRIBE
 */
export async function handleUnsubscribe(
  supabase: SupabaseClient,
  input: BounceHandlerInput,
  result: PostClassificationResult,
) {
  const email = input.senderEmail.toLowerCase().trim();

  if (input.partnerId) {
    try {
      const res = await applyLeadStatusChange(supabase, {
        table: "partners",
        recordId: input.partnerId,
        newStatus: "blacklisted",
        userId: input.userId,
        actor: { type: "system", name: "postClassificationPipeline" },
        decisionOrigin: "system_trigger",
        trigger: "Richiesta unsubscribe esplicita",
        metadata: { category: "unsubscribe", sender: email },
      });
      if (res.applied) {
        result.statusChanged = true;
        result.actionsExecuted.push("status_to_blacklisted");
      }
    } catch (e) {
      result.errors.push(`Blacklist failed: ${e}`);
    }
  }

  try {
    await supabase.from("blacklist").upsert(
      {
        user_id: input.userId,
        email,
        reason: "Unsubscribe request",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email" },
    );
    result.actionsExecuted.push("added_to_blacklist");
  } catch {
    try {
      await supabase.from("blacklist").insert({
        user_id: input.userId,
        email,
        reason: "Unsubscribe request",
      });
      result.actionsExecuted.push("added_to_blacklist");
    } catch {
      // Ignora duplicati
    }
  }

  try {
    await supabase
      .from("email_campaign_queue")
      .update({ status: "cancelled" })
      .eq("user_id", input.userId)
      .eq("recipient_email", email)
      .eq("status", "pending");
    result.actionsExecuted.push("removed_from_queue");
  } catch {
    // Non critico
  }

  if (input.partnerId) {
    try {
      await supabase
        .from("activities")
        .update({ status: "cancelled" })
        .eq("partner_id", input.partnerId)
        .eq("user_id", input.userId)
        .eq("status", "pending");
      result.actionsExecuted.push("cancelled_all_reminders");
    } catch {
      // Non critico
    }
  }

  try {
    await supabase.from("email_address_rules").upsert(
      {
        user_id: input.userId,
        email_address: email,
        auto_action: "hide",
        reason: "unsubscribe_request",
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,email_address" },
    );
    result.actionsExecuted.push("hide_rule_created");
  } catch {
    // Ignora
  }
}
