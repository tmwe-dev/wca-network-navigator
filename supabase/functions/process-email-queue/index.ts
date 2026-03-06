import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { draft_id, action } = await req.json();

    if (!draft_id) {
      return new Response(JSON.stringify({ error: "Missing draft_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle pause/cancel actions
    if (action === "pause") {
      await supabase.from("email_drafts").update({ queue_status: "paused" }).eq("id", draft_id);
      return new Response(JSON.stringify({ success: true, action: "paused" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (action === "cancel") {
      await supabase.from("email_drafts").update({ queue_status: "cancelled", queue_completed_at: new Date().toISOString() }).eq("id", draft_id);
      await supabase.from("email_campaign_queue").update({ status: "cancelled" }).eq("draft_id", draft_id).eq("status", "pending");
      return new Response(JSON.stringify({ success: true, action: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Load SMTP settings ──
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", ["smtp_host", "smtp_port", "smtp_user", "smtp_password", "default_sender_email", "default_sender_name"]);

    const s: Record<string, string> = {};
    settingsRows?.forEach((row: any) => { s[row.key] = row.value; });

    const smtpHost = s["smtp_host"];
    const smtpPort = parseInt(s["smtp_port"] || "465", 10);
    const smtpUser = s["smtp_user"];
    const smtpPass = s["smtp_password"];

    if (!smtpHost || !smtpUser || !smtpPass) {
      await supabase.from("email_drafts").update({ queue_status: "error" }).eq("id", draft_id);
      return new Response(JSON.stringify({ error: "SMTP non configurato" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

      // Mark as sending
      await supabase.from("email_campaign_queue").update({ status: "sending" }).eq("id", item.id);

      try {
        await client.send({
          from: senderEmail,
          to: item.recipient_email,
          subject: item.subject,
          content: "auto",
          html: item.html_body,
        });

        await supabase.from("email_campaign_queue").update({
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", item.id);

        // Log interaction
        if (item.partner_id) {
          await supabase.from("interactions").insert({
            partner_id: item.partner_id,
            interaction_type: "email",
            subject: `Email: ${item.subject}`,
            notes: item.html_body,
          });
        }

        sentCount++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        await supabase.from("email_campaign_queue").update({
          status: "failed",
          error_message: errorMsg,
          retry_count: (item.retry_count || 0) + 1,
        }).eq("id", item.id);
        failedCount++;
      }

      // Update draft counters (atomic increment via raw SQL-like approach)
      const { data: currentDraft } = await supabase.from("email_drafts").select("sent_count").eq("id", draft_id).single();
      const cumulativeSent = (currentDraft?.sent_count || 0) + 1;
      await supabase.from("email_drafts").update({
        sent_count: cumulativeSent,
      }).eq("id", draft_id);

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

    return new Response(JSON.stringify({
      success: true,
      completed: !hasMore,
      sent: sentCount,
      failed: failedCount,
      remaining: remaining || 0,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("process-email-queue error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
