/**
 * email-delivery-webhook (P3.1)
 *
 * Webhook handler per eventi di delivery email da provider esterni
 * (SMTP relay, ESP come Postmark/SendGrid/SES).
 *
 * Auth: shared secret via header `x-webhook-secret` confrontato con
 * env `EMAIL_WEBHOOK_SECRET`. Le ESP solitamente firmano via HMAC; per
 * il primo step usiamo confronto costante. Se non presente → 401.
 *
 * Body atteso (formato canonico):
 *   { event_type, recipient_email, message_id?, smtp_code?,
 *     diagnostic_code?, reason?, occurred_at?, raw? }
 *
 * Supporta anche batch: { events: [...] }.
 *
 * Una volta inserito, il trigger DB `apply_email_delivery_event` aggiorna
 * lo status nella `email_campaign_queue`.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

const EventSchema = z.object({
  event_type: z.enum([
    "delivered",
    "bounce_hard",
    "bounce_soft",
    "complaint",
    "opened",
    "clicked",
    "deferred",
    "rejected",
  ]),
  recipient_email: z.string().email().max(320),
  message_id: z.string().max(998).optional().nullable(),
  campaign_queue_id: z.string().uuid().optional().nullable(),
  smtp_code: z.string().max(32).optional().nullable(),
  diagnostic_code: z.string().max(2000).optional().nullable(),
  reason: z.string().max(2000).optional().nullable(),
  occurred_at: z.string().datetime().optional(),
  raw: z.record(z.unknown()).optional(),
});

const BodySchema = z.union([
  EventSchema,
  z.object({ events: z.array(EventSchema).min(1).max(500) }),
]);

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const expected = Deno.env.get("EMAIL_WEBHOOK_SECRET");
  if (!expected) {
    console.error("[email-delivery-webhook] EMAIL_WEBHOOK_SECRET not configured");
    return json(503, { error: "Webhook not configured" });
  }
  const provided = req.headers.get("x-webhook-secret") ?? "";
  if (!timingSafeEqual(provided, expected)) {
    return json(401, { error: "Invalid webhook secret" });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON" });
  }

  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json(400, { error: "Invalid payload", details: parsed.error.flatten() });
  }

  const events = "events" in parsed.data ? parsed.data.events : [parsed.data];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const rows = events.map((e) => ({
    event_type: e.event_type,
    recipient_email: e.recipient_email.toLowerCase(),
    message_id: e.message_id ?? null,
    campaign_queue_id: e.campaign_queue_id ?? null,
    smtp_code: e.smtp_code ?? null,
    diagnostic_code: e.diagnostic_code ?? null,
    reason: e.reason ?? null,
    occurred_at: e.occurred_at ?? new Date().toISOString(),
    raw_payload: e.raw ?? {},
    source: "webhook",
  }));

  const { error } = await supabase.from("email_delivery_events").insert(rows);
  if (error) {
    console.error("[email-delivery-webhook] insert failed:", error.message);
    return json(500, { error: "Insert failed" });
  }

  return json(200, { accepted: rows.length });
});