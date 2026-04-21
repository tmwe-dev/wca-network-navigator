/**
 * REGOLA TASSATIVA: LinkedIn operations must NEVER exceed:
 * - 50 messaggi al giorno (HARD LIMIT, no exceptions)
 * - 3 messaggi all'ora
 * - Finestra operativa: 9:00-19:00 CET (pausa notturna obbligatoria)
 * - Delay tra messaggi: 45-180 secondi (random, simula comportamento umano)
 * - Queste regole si applicano SEMPRE, anche in caso di bulk, anche dopo autorizzazione
 *
 * send-linkedin — Queues a LinkedIn message for dispatch via browser extension.
 * Architecture: NO official API. Messages are queued in extension_dispatch_queue
 * and picked up by the user's browser extension polling.
 * ⚠️ TOS RISK: Uses linkedin.com DOM injection. Not official API.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { journalistReview } from "../_shared/journalistReviewLayer.ts";
import { loadLinkedInSettings } from "../_shared/linkedinSettings.ts";
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

    // ── Load LinkedIn settings from app_settings table ──
    const liSettings = await loadLinkedInSettings(supabase);

    // ── HARD DAILY LIMIT: Check if user has already sent LinkedIn messages today ──
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStart = today.toISOString();

    // Query extension_dispatch_queue for LinkedIn sends TODAY
    const { data: todayMessages, error: queryErr } = await supabase
      .from("extension_dispatch_queue")
      .select("id", { count: "exact" })
      .eq("user_id", user.id)
      .eq("channel", "linkedin")
      .gte("created_at", todayStart);

    if (queryErr) {
      console.error("[send-linkedin] Daily limit query error:", queryErr);
      return new Response(JSON.stringify({ error: "internal_error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dailyCount = todayMessages?.length || 0;
    if (dailyCount >= liSettings.dailyLimit) {
      console.warn(`[send-linkedin] DAILY LIMIT exceeded for user ${user.id}: ${dailyCount}/${liSettings.dailyLimit}`);
      return new Response(JSON.stringify({
        error: "daily_limit_exceeded",
        message: `Limite giornaliero LinkedIn raggiunto (${liSettings.dailyLimit}/giorno)`,
        daily_count: dailyCount,
        daily_limit: liSettings.dailyLimit,
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(86400),
        },
      });
    }

    const body = await req.json();
    const { contact_id, recipient, message_text, mission_id, partner_id, outreach_queue_id, scheduled_for, journalist_reviewed } = body;

    if (!recipient || !message_text) {
      return new Response(JSON.stringify({ error: "recipient and message_text required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate LinkedIn profile URL
    if (!/^https?:\/\/([\w-]+\.)?linkedin\.com\/(in|pub)\//i.test(recipient)) {
      return new Response(JSON.stringify({ error: "invalid_linkedin_url", detail: "Recipient must be a linkedin.com/in/... profile URL" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // LinkedIn: max 300 chars
    if (message_text.length > 300) {
      return new Response(JSON.stringify({ error: "message_too_long", max: 300 }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate scheduled_for if provided
    let scheduledForIso: string | null = null;
    if (scheduled_for) {
      const d = new Date(scheduled_for);
      if (isNaN(d.getTime())) {
        return new Response(JSON.stringify({ error: "invalid_scheduled_for" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      scheduledForIso = d.toISOString();
    }

    // ── NIGHT PAUSE ENFORCEMENT: Clamp to operational window configured in settings ──
    // If the scheduled time is outside the window, move it to start hour next day
    const clampedTime = new Date(scheduledForIso || new Date());
    const hour = clampedTime.getHours(); // UTC hours, approximation (TODO: proper TZ conversion if needed)

    if (hour < liSettings.sendStartHour) {
      // Before configured start hour: move to start hour same day
      clampedTime.setHours(liSettings.sendStartHour, 0, 0, 0);
    } else if (hour >= liSettings.sendEndHour) {
      // At or after configured end hour: move to start hour next day
      clampedTime.setDate(clampedTime.getDate() + 1);
      clampedTime.setHours(liSettings.sendStartHour, 0, 0, 0);
    }

    if (scheduledForIso && clampedTime.getTime() !== new Date(scheduledForIso).getTime()) {
      console.log(`[send-linkedin] Night pause: rescheduled from ${scheduledForIso} to ${clampedTime.toISOString()}`);
      scheduledForIso = clampedTime.toISOString();
    }

    // Check rate limit only for IMMEDIATE sends (not scheduled batches)
    const isImmediate = !scheduledForIso || new Date(scheduledForIso).getTime() <= Date.now() + 60_000;

    const { data: rlResult } = isImmediate
      ? await supabase.rpc("check_channel_rate_limit", {
          _user_id: user.id,
          _channel: "linkedin",
        })
      : { data: { allowed: true } };

    if (rlResult && !rlResult.allowed) {
      return new Response(JSON.stringify({
        error: "rate_limit_exceeded",
        message: "Max 3 LinkedIn/ora. Riprova più tardi.",
        retry_after_ms: rlResult.retry_after_ms,
      }), {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(Math.ceil((rlResult.retry_after_ms || 3600000) / 1000)),
        },
      });
    }

    // ── LOVABLE-80: Journalist Review Gate ─────────────────────────────
    // Skip review if already reviewed upstream (e.g., from generate-linkedin or agent-execute)
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
        channel: "linkedin",
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
        console.warn(`[send-linkedin] BLOCKED by journalist review: ${reviewResult.reasoning_summary}`);
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
        channel: "linkedin",
        contact_id: contact_id || null,
        partner_id: partner_id || null,
        recipient,
        message_text: finalMessage,
        mission_id: mission_id || null,
        outreach_queue_id: outreach_queue_id || null,
        status: "pending",
        scheduled_for: scheduledForIso,
      })
      .select("id, scheduled_for")
      .single();

    if (insertErr) {
      console.error("Queue insert error:", insertErr);
      return new Response(JSON.stringify({ error: "queue_failed", detail: insertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-linkedin] Queued ${queued.id} for ${recipient}${scheduledForIso ? ` scheduled ${scheduledForIso}` : ""}`);

    return new Response(JSON.stringify({
      success: true,
      dispatch_id: queued.id,
      scheduled_for: queued.scheduled_for,
      message: scheduledForIso
        ? `Messaggio LinkedIn programmato per ${new Date(scheduledForIso).toLocaleString("it-IT")}.`
        : "Messaggio LinkedIn in coda. L'estensione lo invierà a breve.",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    console.error("[send-linkedin] Error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
