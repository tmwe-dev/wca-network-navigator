/**
 * log-action — Edge function per tracciare side-effect post-invio
 * da client-side (WhatsApp, LinkedIn, SMS, invii manuali).
 *
 * LOVABLE-93: Sostituisce useTrackActivity (client-side, duplicato)
 * con una chiamata server-side alla postSendPipeline unificata.
 *
 * Il client chiama questa edge function dopo un invio riuscito.
 * La pipeline esegue: activity + lead_status + interaction +
 * follow-up + touch_count + supervisor_audit_log.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { runPostSendPipeline } from "../_shared/postSendPipeline.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";

interface LogActionBody {
  channel: "email" | "whatsapp" | "linkedin" | "sms";
  source_type: "partner" | "imported_contact" | "business_card";
  source_id: string;
  /** Destinatario (email, telefono, profilo LinkedIn) */
  to: string;
  /** Partner ID (se source_type = partner o se il contatto è collegato a un partner) */
  partner_id?: string;
  /** Contact ID (se source_type = imported_contact) */
  contact_id?: string;
  /** Business card ID (se source_type = business_card) */
  business_card_id?: string;
  /** Oggetto/titolo del messaggio */
  subject?: string;
  /** Corpo del messaggio (HTML per email, testo per altri) */
  body?: string;
  /** Titolo custom per l'activity */
  title?: string;
  /** Agent ID se eseguito da AI */
  agent_id?: string;
  /** Source caller */
  source?: "email_forge" | "agent" | "cadence" | "batch" | "pending_action" | "manual";
  /** Metadati aggiuntivi */
  meta?: Record<string, unknown>;
  /** ID esterno del messaggio */
  message_id_external?: string;
  /** Thread ID */
  thread_id?: string;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // Auth — E2: authGuard terse (contract byte-identico al pre-E2).
    const auth = await requireAuth(req, dynCors, { errorFormat: "terse" });
    if (isAuthError(auth)) return auth;
    const userId = auth.userId;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: LogActionBody = await req.json();

    if (!body.channel || !body.source_type || !body.source_id || !body.to) {
      return new Response(
        JSON.stringify({ error: "VALIDATION_ERROR", message: "Missing: channel, source_type, source_id, to" }),
        { status: 400, headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    // Run unified pipeline
    const result = await runPostSendPipeline(supabase, {
      userId,
      partnerId: body.partner_id || (body.source_type === "partner" ? body.source_id : null),
      contactId: body.contact_id || (body.source_type === "imported_contact" ? body.source_id : null),
      businessCardId: body.business_card_id || (body.source_type === "business_card" ? body.source_id : null),
      sourceType: body.source_type,
      sourceId: body.source_id,
      channel: body.channel,
      subject: body.subject || body.title,
      body: body.body,
      to: body.to,
      agentId: body.agent_id,
      source: body.source || "manual",
      meta: body.meta,
      messageIdExternal: body.message_id_external,
      threadId: body.thread_id,
    });

    return new Response(
      JSON.stringify({ success: true, pipeline: result }),
      { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    console.error("[log-action] Error:", e);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});
