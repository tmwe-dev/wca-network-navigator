/**
 * send-whatsapp — Queues a WhatsApp message for dispatch via browser extension.
 * Architecture: NO official API. Messages are queued in extension_dispatch_queue
 * and picked up by the user's browser extension polling.
 * ⚠️ TOS RISK: Uses web.whatsapp.com DOM injection. Not official API.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { journalistReview } from "../_shared/journalistReviewLayer.ts";
import type { JournalistReviewInput } from "../_shared/journalistTypes.ts";

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
    const { contact_id, recipient, message_text, mission_id, partner_id, outreach_queue_id, journalist_reviewed } = body;

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

    // === GATE HARD: Dottrina Multi-Canale WhatsApp ===
    if (partner_id) {
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", partner_id)
        .maybeSingle();

      if (partner?.lead_status === "blacklisted") {
        return new Response(JSON.stringify({ success: false, error: "BLACKLISTED", reason: "Partner in blacklist" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const blockedStatuses = ["new", "first_touch_sent", "holding"];
      if (partner?.lead_status && blockedStatuses.includes(partner.lead_status)) {
        const { count } = await supabase
          .from("channel_messages")
          .select("id", { count: "exact", head: true })
          .eq("partner_id", partner_id)
          .eq("channel", "whatsapp")
          .eq("direction", "inbound");

        if (!count) {
          return new Response(JSON.stringify({
            success: false,
            error: "GATE_BLOCKED",
            reason: `WhatsApp non consentito a fase ${partner.lead_status}. Serve almeno 'engaged'. Usa email o LinkedIn.`,
            suggested_alternative: "email",
          }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const { data: lastWa } = await supabase
        .from("channel_messages")
        .select("created_at")
        .eq("partner_id", partner_id)
        .eq("channel", "whatsapp")
        .eq("direction", "outbound")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastWa?.created_at) {
        const daysSince = (Date.now() - new Date(lastWa.created_at).getTime()) / 86400000;
        if (daysSince < 7) {
          return new Response(JSON.stringify({
            success: false,
            error: "CADENCE_GATE",
            reason: `Ultimo WhatsApp ${Math.round(daysSince)} giorni fa. Minimo 7 giorni tra invii WhatsApp.`,
          }), { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // ── LOVABLE-80: Journalist Review Gate ─────────────────────────────
    // Skip review if already reviewed upstream (e.g., from generate-whatsapp or agent-execute)
    let finalMessage = message_text;
    if (!journalist_reviewed) {
      // Fetch partner & contact data for journalist review context
      const [partnerData, contactData] = await Promise.all([
        partner_id
          ? supabase
              .from("partners")
              .select("company_name, country, lead_status")
              .eq("id", partner_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        contact_id
          ? supabase
              .from("imported_contacts")
              .select("name, role")
              .eq("id", contact_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      // Build journalist review input
      const reviewInput: JournalistReviewInput = {
        final_draft: message_text,
        resolved_brief: {},
        channel: "whatsapp",
        commercial_state: {
          lead_status: partnerData.data?.lead_status || "unknown",
        },
        partner: {
          id: partner_id || null,
          company_name: partnerData.data?.company_name || undefined,
          country: partnerData.data?.country || undefined,
        },
        contact: contactData.data
          ? {
              name: contactData.data.name || undefined,
              role: contactData.data.role || undefined,
            }
          : undefined,
      };

      const reviewResult = await journalistReview(supabase, user.id, reviewInput);

      // Block send if journalist review verdict is "block"
      if (reviewResult.verdict === "block") {
        console.warn(`[send-whatsapp] BLOCKED by journalist review: ${reviewResult.reasoning_summary}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: "JOURNALIST_BLOCK",
            reason: reviewResult.reasoning_summary,
            warnings: reviewResult.warnings,
            retriable: false,
          }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // If edits were made (pass_with_edits), use edited version
      if (reviewResult.verdict === "pass_with_edits") {
        finalMessage = reviewResult.edited_text;
      }
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
        message_text: finalMessage,
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

    if (partner_id) {
      await supabase.from("activities").insert({
        user_id: user.id,
        partner_id,
        selected_contact_id: contact_id || null,
        activity_type: "whatsapp_message",
        title: `WhatsApp inviato a ${recipient}`,
        description: finalMessage,
        status: "completed",
        priority: "medium",
        source_type: "partner",
        source_id: partner_id,
        completed_at: new Date().toISOString(),
      }).then(() => null, () => null);

      const { data: p } = await supabase.from("partners").select("lead_status").eq("id", partner_id).maybeSingle();
      const reminderDays = p?.lead_status === "negotiation" ? 2 : 5;
      const dueDate = new Date(Date.now() + reminderDays * 86400000).toISOString().slice(0, 10);
      await supabase.from("reminders").insert({
        user_id: user.id,
        partner_id,
        title: "Check risposta WhatsApp",
        due_date: dueDate,
        priority: p?.lead_status === "negotiation" ? "high" : "medium",
        status: "pending",
      }).then(() => null, () => null);
    }

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
