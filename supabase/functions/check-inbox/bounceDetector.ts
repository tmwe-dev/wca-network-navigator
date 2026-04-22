/**
 * bounceDetector.ts — Detect and handle bounce notifications from IMAP messages.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

export interface BounceInfo {
  type: "hard" | "soft";
  bouncedEmail: string | null;
}

const BOUNCE_SENDERS = ["mailer-daemon@", "postmaster@", "mail-delivery-subsystem@", "noreply-dmarc@"];
const BOUNCE_SUBJECTS = [
  "delivery status notification", "undeliverable", "mail delivery failed",
  "returned mail", "undelivered mail", "delivery failure", "failure notice",
];
const HARD_BOUNCE_PATTERNS = [
  /550\s/i, /551\s/i, /552\s/i, /553\s/i, /554\s/i,
  /user unknown/i, /mailbox not found/i, /address rejected/i,
  /permanent failure/i, /does not exist/i, /no such user/i,
];

export function detectBounce(msg: { fromAddr: string; subject: string; bodyText: string }): BounceInfo | null {
  const senderLower = (msg.fromAddr || "").toLowerCase();
  const subjectLower = (msg.subject || "").toLowerCase();
  const bodyText = (msg.bodyText || "");

  const isBounce =
    BOUNCE_SENDERS.some(s => senderLower.includes(s)) ||
    BOUNCE_SUBJECTS.some(s => subjectLower.includes(s));

  if (!isBounce) return null;

  const isHard = HARD_BOUNCE_PATTERNS.some(p => p.test(bodyText)) ||
    /permanent/i.test(bodyText) || /does not exist/i.test(bodyText);

  const emailMatch = bodyText.match(
    /(?:original recipient|final-recipient|to:\s*)<?([a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,})>?/i
  );
  const bouncedEmail = emailMatch?.[1]?.toLowerCase() || null;

  return { type: isHard ? "hard" : "soft", bouncedEmail };
}

export async function handleBounce(
  supabase: SupabaseClient,
  userId: string,
  savedMessageId: string,
  bounce: BounceInfo,
): Promise<void> {
  try {
    // 1. Tag the message as bounce
    await supabase.from("channel_messages").update({
      category: "bounce",
    }).eq("id", savedMessageId);

    // 2. Hard bounce: mark address as invalid
    if (bounce.type === "hard" && bounce.bouncedEmail) {
      await supabase.from("email_address_rules").upsert({
        user_id: userId,
        email_address: bounce.bouncedEmail,
        auto_action: "archive",
        notes: `Hard bounce rilevato il ${new Date().toISOString().split("T")[0]}. Email non valida.`,
        is_active: true,
      }, { onConflict: "user_id,email_address" });

      // Marca SOLO l'email come bounced (fatto tecnico).
      // Il lead_status (decisione commerciale) resta INVARIATO: il contatto
      // può ancora essere lavorato via altri canali (telefono, WhatsApp, LinkedIn).
      const { data: bouncedContacts } = await supabase
        .from("imported_contacts")
        .update({ email_status: "bounced" })
        .ilike("email", bounce.bouncedEmail)
        .eq("user_id", userId)
        .select("id");

      // Stessa logica per partners (potrebbe avere email aziendale bouncata).
      await supabase
        .from("partners")
        .update({ email_status: "bounced" })
        .ilike("email", bounce.bouncedEmail);

      // Log dell'evento bounce come activity (audit trail leggibile).
      if (bouncedContacts && bouncedContacts.length > 0) {
        await supabase.from("activities").insert({
          user_id: userId,
          activity_type: "other",
          title: `Email bounce rilevato: ${bounce.bouncedEmail}`,
          description: `Hard bounce — email_status='bounced'. lead_status invariato (lavorabile via altri canali).`,
          status: "completed",
          source_type: "system",
          source_id: savedMessageId,
        });
      }
    }

    // 3. Audit log
    await supabase.from("supervisor_audit_log").insert({
      user_id: userId,
      actor_type: "system",
      actor_name: "bounce-detector",
      action_category: "email_classified",
      action_detail: `${bounce.type} bounce per ${bounce.bouncedEmail || "unknown"}`,
      target_type: "email",
      target_id: savedMessageId,
      target_label: bounce.bouncedEmail,
      decision_origin: "system_trigger",
    });

  } catch (err) {
    console.error("[check-inbox] Bounce handling error:", err);
  }
}
