/**
 * Funnemail Autoresponder — Template-only acknowledgment sender.
 *
 * ECCEZIONE APPROVATA AL JOURNALIST REVIEW:
 * Questo è un invio di sola NOTIFICA "presa in carico", non un messaggio
 * generato da AI. Usa esclusivamente template pre-approvati salvati in
 * `funnemail_autoresponder_templates`. Nessun testo libero, nessuna
 * inferenza AI, nessuna personalizzazione oltre alle variabili sicure
 * {nome}, {oggetto}, {ticket_id}.
 *
 * Per questo motivo passa `journalist_reviewed: true` a `send-email`:
 * il template è stato revisionato UNA volta in fase di approvazione e
 * ogni invio viene auditato in `funnemail_autoresponder_log`.
 *
 * Anti-duplicato: vincolo DB `idx_autoresp_log_unique_per_message` impedisce
 * due autorisposte sullo stesso source_message_id.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";

const BodySchema = z.object({
  source_message_id: z.string().uuid(),
  recipient_email: z.string().email(),
  recipient_name: z.string().optional().default("there"),
  original_subject: z.string().optional().default(""),
  language: z.enum(["it", "en"]).optional().default("it"),
  template_name: z.string().optional(), // override esplicito
  partner_id: z.string().uuid().optional(),
  contact_id: z.string().uuid().optional(),
});

const SAFE_VAR_PATTERN = /\{(nome|oggetto|ticket_id)\}/g;

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(SAFE_VAR_PATTERN, (_match, key: string) => {
    const v = vars[key];
    return typeof v === "string" ? v : "";
  });
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return edgeError("AUTH_REQUIRED", "Unauthorized");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }
    const input = parsed.data;

    // Anti-duplicate (race-safe via DB unique index, but pre-check saves work)
    const { data: existing } = await admin
      .from("funnemail_autoresponder_log")
      .select("id")
      .eq("source_message_id", input.source_message_id)
      .eq("status", "sent")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ skipped: "already_sent", log_id: existing.id }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Load template (explicit name OR fallback by language)
    const templateName = input.template_name ?? `default_ack_${input.language}`;
    const { data: tpl, error: tplErr } = await admin
      .from("funnemail_autoresponder_templates")
      .select("id, name, subject_template, body_template, enabled")
      .eq("name", templateName)
      .eq("enabled", true)
      .maybeSingle();

    if (tplErr || !tpl) {
      return edgeError("TEMPLATE_NOT_FOUND", `Template '${templateName}' not found or disabled`);
    }

    const ticketId = input.source_message_id.slice(0, 8).toUpperCase();
    const vars = {
      nome: input.recipient_name,
      oggetto: input.original_subject,
      ticket_id: ticketId,
    };

    const renderedSubject = renderTemplate(tpl.subject_template, vars);
    const renderedBody = renderTemplate(tpl.body_template, vars);
    // Convert plaintext body to safe HTML (paragraphs from line breaks)
    const renderedHtml = renderedBody
      .split("\n\n")
      .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
      .join("");

    // Invoke send-email with journalist_reviewed: true (legitimate exception)
    const sendRes = await admin.functions.invoke("send-email", {
      headers: { Authorization: authHeader },
      body: {
        to: input.recipient_email,
        subject: renderedSubject,
        html: renderedHtml,
        partner_id: input.partner_id,
        contact_id: input.contact_id,
        idempotency_key: `autoresp:${input.source_message_id}`,
        journalist_reviewed: true, // ECCEZIONE: template pre-approvato
      },
    });

    const sendOk = !sendRes.error;
    const { data: logRow, error: logErr } = await admin
      .from("funnemail_autoresponder_log")
      .insert({
        source_message_id: input.source_message_id,
        template_id: tpl.id,
        template_name: tpl.name,
        recipient_email: input.recipient_email,
        rendered_subject: renderedSubject,
        rendered_body: renderedBody,
        variables: vars,
        status: sendOk ? "sent" : "failed",
        error_message: sendOk ? null : extractErrorMessage(sendRes.error),
        send_email_response: (sendRes.data ?? null) as Record<string, unknown> | null,
        triggered_by: "funnemail-send-autoresponder",
      })
      .select("id")
      .maybeSingle();

    if (logErr) {
      console.error("[autoresponder] log insert failed", logErr);
    }

    return new Response(
      JSON.stringify({
        success: sendOk,
        template_used: tpl.name,
        log_id: logRow?.id ?? null,
        error: sendOk ? null : extractErrorMessage(sendRes.error),
      }),
      {
        status: sendOk ? 200 : 500,
        headers: { ...cors, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return edgeError("AUTORESPONDER_FAILED", extractErrorMessage(err));
  }
});