import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { runPostSendPipeline } from "../_shared/postSendPipeline.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { checkSmtpRateLimit } from "../_shared/smtpRateLimit.ts";
import { journalistReview } from "../_shared/journalistReviewLayer.ts";
import type { JournalistReviewInput } from "../_shared/journalistTypes.ts";


Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { draft_id, action } = await req.json();

    if (!draft_id) {
      return new Response(JSON.stringify({ error: "Missing draft_id" }), {
        status: 400, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Handle pause/cancel actions
    if (action === "pause") {
      await supabase.from("email_drafts").update({ queue_status: "paused" }).eq("id", draft_id);
      return new Response(JSON.stringify({ success: true, action: "paused" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    if (action === "cancel") {
      await supabase.from("email_drafts").update({ queue_status: "cancelled", queue_completed_at: new Date().toISOString() }).eq("id", draft_id);
      await supabase.from("email_campaign_queue").update({ status: "cancelled" }).eq("draft_id", draft_id).eq("status", "pending");
      return new Response(JSON.stringify({ success: true, action: "cancelled" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // ── Load SMTP settings (scoped to authenticated user) ──
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "default_sender_email", "default_sender_name"]);

    const s: Record<string, string> = {};
    settingsRows?.forEach((row: Record<string, unknown>) => { s[row.key] = row.value; });

    const smtpHost = s["smtp_host"];
    const smtpPort = parseInt(s["smtp_port"] || "465", 10);
    const smtpUser = s["smtp_user"];
    const smtpPass = s["smtp_password"];

    if (!smtpHost || !smtpUser || !smtpPass) {
      await supabase.from("email_drafts").update({ queue_status: "error" }).eq("id", draft_id);
      return new Response(JSON.stringify({ error: "SMTP non configurato" }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const senderEmailVal = s["default_sender_email"] || smtpUser;
    const senderName = s["default_sender_name"];
    const senderEmail = senderName ? `${senderName} <${senderEmailVal}>` : senderEmailVal;
    const useTLS = smtpPort === 587;

    // ── Load draft config ──
    const { data: draft } = await supabase.from("email_drafts").select("queue_delay_seconds, queue_status").eq("id", draft_id).single();
    if (!draft) {
      return new Response(JSON.stringify({ error: "Draft not found" }), {
        status: 404, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const delayMs = (draft.queue_delay_seconds || 5) * 1000;

    // Mark as processing
    await supabase.from("email_drafts").update({ 
      queue_status: "processing", 
      queue_started_at: draft.queue_status === "idle" || draft.queue_status === "paused" ? new Date().toISOString() : undefined,
      status: "sending",
    }).eq("id", draft_id);

    // ── Process batch (max 10 per invocation to avoid timeout) ──
    const BATCH_SIZE = 10;
    const { data: queueItems } = await supabase
      .from("email_campaign_queue")
      .select("*")
      .eq("draft_id", draft_id)
      .eq("status", "pending")
      .order("position", { ascending: true })
      .limit(BATCH_SIZE);

    if (!queueItems || queueItems.length === 0) {
      // All done
      const { data: stats } = await supabase
        .from("email_campaign_queue")
        .select("status")
        .eq("draft_id", draft_id);

      const sent = stats?.filter(s => s.status === "sent").length || 0;
      const failed = stats?.filter(s => s.status === "failed").length || 0;

      await supabase.from("email_drafts").update({
        queue_status: "completed",
        queue_completed_at: new Date().toISOString(),
        status: "sent",
        sent_count: sent,
        sent_at: new Date().toISOString(),
      }).eq("id", draft_id);

      return new Response(JSON.stringify({ success: true, completed: true, sent, failed }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    let failedCount = 0;
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: !useTLS,
        auth: { username: smtpUser, password: smtpPass },
      },
    });

    for (const item of queueItems) {
      // Check if paused/cancelled
      const { data: freshDraft } = await supabase.from("email_drafts").select("queue_status").eq("id", draft_id).single();
      if (freshDraft?.queue_status === "paused" || freshDraft?.queue_status === "cancelled") {
        break;
      }

      // ── P3.3: SMTP rate limit per-utente (no-op se kill-switch off) ──
      const rl = await checkSmtpRateLimit(supabase, userId);
      if (!rl.allowed) {
        console.log(
          `[pq] rate limit hit user=${userId} sent_last_hour=${rl.sentLastHour} cap=${rl.cap} — pausing batch`,
        );
        // Lascia gli item in 'pending' per il prossimo invocation;
        // marca il draft come paused così il dispatcher lo riprenderà.
        await supabase
          .from("email_drafts")
          .update({ queue_status: "paused" })
          .eq("id", draft_id);
        break;
      }

      // ── Idempotency check: skip if this key was already sent ──
      if (item.idempotency_key) {
        const { data: existing } = await supabase
          .from("email_campaign_queue")
          .select("id")
          .eq("idempotency_key", item.idempotency_key)
          .eq("status", "sent")
          .neq("id", item.id)
          .limit(1);
        if (existing && existing.length > 0) {
          // Duplicate detected — mark as skipped, don't send
          await supabase.from("email_campaign_queue").update({
            status: "sent",
            error_message: "Skipped: duplicate idempotency_key",
            sent_at: new Date().toISOString(),
          }).eq("id", item.id);
          sentCount++;
          continue;
        }
      }

      // Mark as sending
      await supabase.from("email_campaign_queue").update({ status: "sending" }).eq("id", item.id);

      try {
        // ── LOVABLE-80: Journalist Review Gate (parità con send-email) ──
        // Le drafts possono essere editate manualmente dopo generate-email,
        // quindi rivalutiamo qui prima dell'invio reale via SMTP.
        let htmlToSend = item.html_body as string;
        try {
          const { data: partnerData } = item.partner_id
            ? await supabase
                .from("partners")
                .select("company_name, country, lead_status")
                .eq("id", item.partner_id)
                .maybeSingle()
            : { data: null };

          const reviewInput: JournalistReviewInput = {
            final_draft: htmlToSend,
            resolved_brief: {},
            channel: "email",
            commercial_state: {
              lead_status: (partnerData?.lead_status as string) || "unknown",
            },
            partner: {
              id: item.partner_id || null,
              company_name: partnerData?.company_name || undefined,
              country: partnerData?.country || undefined,
            },
          };
          const review = await journalistReview(supabase, userId, reviewInput);
          if (review.verdict === "block") {
            console.warn(`[pq] BLOCKED by journalist for item=${item.id}: ${review.reasoning_summary}`);
            await supabase.from("email_campaign_queue").update({
              status: "failed",
              error_message: `JOURNALIST_BLOCK: ${review.reasoning_summary}`.slice(0, 1000),
              failed_at: new Date().toISOString(),
            }).eq("id", item.id);
            supabase.from("email_send_log").insert({
              user_id: userId,
              recipient_email: item.recipient_email,
              subject: item.subject,
              partner_id: item.partner_id ?? null,
              draft_id,
              campaign_queue_id: item.id,
              idempotency_key: item.idempotency_key ?? null,
              channel: "email",
              send_method: "campaign",
              status: "failed",
              error_message: `JOURNALIST_BLOCK: ${review.reasoning_summary}`.slice(0, 1000),
            }).then(({ error }) => {
              if (error) console.error("[pq] esl insert (block) failed:", error.message);
            });
            failedCount++;
            continue;
          }
          if (review.verdict === "pass_with_edits" && review.edited_text) {
            htmlToSend = review.edited_text;
          }
        } catch (revErr) {
          // Fail-open: stessa policy di send-email — log e procedi col draft originale
          console.error("[pq] journalist review error (fail-open):", revErr);
        }

        await client.send({
          from: senderEmail,
          to: item.recipient_email,
          subject: item.subject,
          content: "auto",
          html: htmlToSend,
        });

        // ── Recovery marker: record SMTP success timestamp BEFORE DB updates ──
        // If DB fails after this point, we can detect orphaned sends
        const smtpSentAt = new Date().toISOString();

        await supabase.from("email_campaign_queue").update({
          status: "sent",
          sent_at: smtpSentAt,
        }).eq("id", item.id);

        // ── Audit log (fire-and-forget) ──
        supabase.from("email_send_log").insert({
          user_id: userId,
          recipient_email: item.recipient_email,
          subject: item.subject,
          partner_id: item.partner_id ?? null,
          draft_id,
          campaign_queue_id: item.id,
          idempotency_key: item.idempotency_key ?? null,
          channel: "email",
          send_method: "campaign",
          status: "sent",
        }).then(({ error }) => {
          if (error) console.error("[pq] esl insert failed:", error.message);
        });

        // ── Post-send: pipeline unificata (LOVABLE-85) ──
        await runPostSendPipeline(supabase, {
          userId,
          partnerId: item.partner_id || null,
          contactId: null,
          channel: "email",
          subject: item.subject,
          body: htmlToSend,
          to: item.recipient_email,
          source: "batch",
          meta: {
            company_name: item.recipient_name || (item as Record<string, unknown>).company_name || "",
            email: item.recipient_email,
            country: (item as Record<string, unknown>).country_name || "",
          },
        });

        sentCount++;

        // Increment draft sent_count (sequential processing — no race condition risk)
        await supabase.from("email_drafts").update({
          sent_count: sentCount,
        } as Record<string, unknown>).eq("id", draft_id);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("email_campaign_queue").update({
          status: "failed",
          error_message: errorMsg,
          retry_count: (item.retry_count || 0) + 1,
        }).eq("id", item.id);

        // ── Audit log (fire-and-forget) ──
        supabase.from("email_send_log").insert({
          user_id: userId,
          recipient_email: item.recipient_email,
          subject: item.subject,
          partner_id: item.partner_id ?? null,
          draft_id,
          campaign_queue_id: item.id,
          idempotency_key: item.idempotency_key ?? null,
          channel: "email",
          send_method: "campaign",
          status: "failed",
          error_message: errorMsg.slice(0, 1000),
        }).then(({ error }) => {
          if (error) console.error("[pq] esl insert (fail) failed:", error.message);
        });

        failedCount++;
      }

      // Delay between sends
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    try { await client.close(); } catch { /* ignore */ }

    // Check if more items remain
    const { count: remaining } = await supabase
      .from("email_campaign_queue")
      .select("id", { count: "exact", head: true })
      .eq("draft_id", draft_id)
      .eq("status", "pending");

    const hasMore = (remaining || 0) > 0;

    // ── Auto-finalize: if no more pending items, mark draft as completed ──
    if (!hasMore) {
      const { data: finalStats } = await supabase
        .from("email_campaign_queue")
        .select("status")
        .eq("draft_id", draft_id);

      const finalSent = finalStats?.filter(s => s.status === "sent").length || 0;
      const finalFailed = finalStats?.filter(s => s.status === "failed").length || 0;

      await supabase.from("email_drafts").update({
        queue_status: "completed",
        queue_completed_at: new Date().toISOString(),
        status: finalFailed > 0 && finalSent === 0 ? "error" : "sent",
        sent_count: finalSent,
        sent_at: new Date().toISOString(),
      }).eq("id", draft_id);
    }

    return new Response(JSON.stringify({
      success: true,
      completed: !hasMore,
      sent: sentCount,
      failed: failedCount,
      remaining: remaining || 0,
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-email-queue error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
