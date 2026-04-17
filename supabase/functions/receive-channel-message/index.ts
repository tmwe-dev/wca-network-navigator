/**
 * receive-channel-message — Webhook per estensioni browser.
 * L'estensione invia messaggi inbound (WA/LI) ricevuti, che vengono
 * inseriti in channel_messages + aggiornato dispatch queue se outbound.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";

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

    // Rate limit: 30 messages/min per user
    const rl = checkRateLimit(`receive_${user.id}`, { maxTokens: 30, refillRate: 0.5 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const body = await req.json();
    const { channel, direction, from_address, to_address, body_text, body_html, subject, partner_id, contact_id, dispatch_id, message_id_external } = body;

    if (!channel || !direction) {
      return new Response(JSON.stringify({ error: "channel and direction required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve operator_id for this user
    const { data: opRow } = await supabase
      .from("operators")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    const operator_id = opRow?.id ?? null;
    if (!operator_id) {
      console.warn(`[receive-channel-message] No operator found for user ${user.id}, skipping insert`);
      return new Response(JSON.stringify({ error: "no_operator", detail: "User has no active operator" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upsert into channel_messages (dedup via user_id + message_id_external)
    const row: Record<string, unknown> = {
      user_id: user.id,
      operator_id,
      channel,
      direction,
      from_address: from_address || null,
      to_address: to_address || null,
      body_text: body_text || null,
      partner_id: partner_id || null,
    };
    if (message_id_external) row.message_id_external = message_id_external;
    if (body_html) row.body_html = body_html;
    if (subject) row.subject = subject;

    if (!message_id_external) {
      console.warn(`[receive-channel-message] Missing message_id_external for ${direction} ${channel} (legacy fallback)`);
    }

    const { data: msgRows, error: insertErr } = message_id_external
      ? await supabase
          .from("channel_messages")
          .upsert([row], { onConflict: "user_id,message_id_external", ignoreDuplicates: true })
          .select("id")
      : await supabase
          .from("channel_messages")
          .insert(row)
          .select("id");

    if (insertErr) {
      console.error("[receive-channel-message] Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "insert_failed", detail: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const msgId = msgRows?.[0]?.id ?? null;
    const wasDuplicate = message_id_external && (!msgRows || msgRows.length === 0);

    // If outbound delivery confirmation, update dispatch queue
    if (direction === "outbound" && dispatch_id && !wasDuplicate) {
      await supabase
        .from("extension_dispatch_queue")
        .update({ status: "delivered", delivered_at: new Date().toISOString() })
        .eq("id", dispatch_id)
        .eq("user_id", user.id);
    }

    if (wasDuplicate) {
      console.log(`[receive-channel-message] ${direction} ${channel} duplicate skipped (ext_id=${message_id_external})`);
    } else {
      console.log(`[receive-channel-message] ${direction} ${channel} msg ${msgId}`);
    }

    return new Response(JSON.stringify({
      success: true,
      message_id: msgId,
      duplicate: wasDuplicate,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("[receive-channel-message] Error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
