/**
 * outreachTools.ts — Email generation, sending, scheduling, and queueing.
 */
import { supabase } from "../platformToolHelpers.ts";

export async function executeOutreachToolHandler(
  name: string,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
): Promise<unknown> {
  switch (name) {
    case "generate_outreach": {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-outreach`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify(args),
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error || "Errore generazione" };
      return { success: true, channel: data.channel, subject: data.subject, body: data.body };
    }

    case "send_email": {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          to: args.to_email,
          toName: args.to_name,
          subject: args.subject,
          html: args.html_body,
        }),
      });
      const data = await response.json();
      if (!response.ok) return { error: data.error || "Errore invio" };
      if (args.partner_id)
        await supabase.from("interactions").insert({
          partner_id: args.partner_id,
          interaction_type: "email",
          subject: String(args.subject),
          notes: `Inviata a ${args.to_email}`,
        });
      return { success: true, message: `Email inviata a ${args.to_email}.` };
    }

    case "schedule_email": {
      const scheduledAt = String(args.scheduled_at);
      const { data, error } = await supabase
        .from("email_campaign_queue")
        .insert({
          recipient_email: String(args.to_email),
          recipient_name: args.to_name ? String(args.to_name) : null,
          subject: String(args.subject),
          html_body: String(args.html_body),
          partner_id: args.partner_id ? String(args.partner_id) : "00000000-0000-0000-0000-000000000000",
          scheduled_at: scheduledAt,
          status: "pending",
          user_id: userId,
        } as Record<string, unknown>)
        .select("id")
        .single();
      if (error) return { error: error.message };
      return {
        success: true,
        queue_id: data.id,
        scheduled_at: scheduledAt,
        message: `Email programmata per ${scheduledAt}.`,
      };
    }

    case "queue_outreach": {
      const channel = String(args.channel || "email");
      const body = String(args.body || "");
      if (!body) return { error: "body è obbligatorio" };
      const { data, error } = await supabase
        .from("outreach_queue")
        .insert({
          user_id: userId,
          channel,
          recipient_name: args.recipient_name ? String(args.recipient_name) : null,
          recipient_email: args.recipient_email ? String(args.recipient_email) : null,
          partner_id: args.partner_id ? String(args.partner_id) : null,
          contact_id: args.contact_id ? String(args.contact_id) : null,
          subject: args.subject ? String(args.subject) : null,
          body,
          priority: Number(args.priority) || 0,
          created_by: "agent",
        })
        .select("id, channel, recipient_name, status")
        .single();
      if (error) return { error: error.message };
      return { success: true, queue_id: data.id, channel: data.channel, message: `Messaggio ${channel} accodato.` };
    }

    default:
      return { error: `Unknown outreach tool: ${name}` };
  }
}
