/**
 * send-whatsapp — Queues a WhatsApp message for dispatch via browser extension.
 * Architecture: NO official API. Messages are queued in extension_dispatch_queue
 * and picked up by the user's browser extension polling.
 * ⚠️ TOS RISK: Uses web.whatsapp.com DOM injection. Not official API.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const corsHeaders = getCorsHeaders(req.headers.get("origin"));

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { contact_id, recipient, message_text, mission_id, partner_id, outreach_queue_id } = body;

    if (!recipient || !message_text) {
      return new Response(JSON.stringify({ error: "recipient and message_text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check rate limit
    const { data: rlResult } = await supabase.rpc("check_channel_rate_limit", {
      _user_id: user.id,
      _channel: "whatsapp",
    });

    if (rlResult && !rlResult.allowed) {
      return new Response(JSON.stringify({
        error: "rate_limit_exceeded",
        message: "Max 5 WhatsApp/min. Riprova tra qualche secondo.",
        retry_after_ms: rlResult.retry_after_ms,
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rlResult.retry_after_ms || 60000) / 1000)),
        },
      });
    }

    // Queue for extension dispatch
    const { data: queued, error: insertErr } = await supabase
      .from("extension_dispatch_queue")
      .insert({
        user_id: user.id,
        channel: "whatsapp",
        contact_id: contact_id || null,
        partner_id: partner_id || null,
        recipient,
        message_text,
        mission_id: mission_id || null,
        outreach_queue_id: outreach_queue_id || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Queue insert error:", insertErr);
      return new Response(JSON.stringify({ error: "queue_failed", detail: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-whatsapp] Queued ${queued.id} for ${recipient}`);

    return new Response(JSON.stringify({
      success: true,
      dispatch_id: queued.id,
      message: "Messaggio in coda. L'estensione lo invierà a breve.",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("[send-whatsapp] Error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
