import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { sanitizeHtml, escapeHtml } from "../_shared/htmlSanitizer.ts";

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

    const { to, subject, html, from, partner_id, agent_id, reply_to, operator_id } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read SMTP settings from app_settings
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .in("key", [
        "smtp_host", "smtp_port", "smtp_user", "smtp_password",
        "default_sender_email", "default_sender_name",
        "ai_signature_image_url", "ai_footer_image_url",
      ]);

    const s: Record<string, string> = {};
    settingsRows?.forEach((row: any) => { s[row.key] = row.value; });

    const smtpHost = s["smtp_host"];
    const smtpPort = parseInt(s["smtp_port"] || "465", 10);
    const smtpUser = s["smtp_user"];
    const smtpPass = s["smtp_password"];

    if (!smtpHost || !smtpUser || !smtpPass) {
      return new Response(
        JSON.stringify({ error: "SMTP non configurato. Vai in Impostazioni → Email per configurarlo." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build sender
    let senderEmail = from;
    if (!senderEmail) {
      const senderEmailVal = s["default_sender_email"] || smtpUser;
      const senderName = s["default_sender_name"];
      senderEmail = senderName ? `${senderName} <${senderEmailVal}>` : senderEmailVal;
    }

    // Determine TLS mode
    const useTLS = smtpPort === 587;

    // Send via SMTP
    const client = new SMTPClient({
      connection: {
        hostname: smtpHost,
        port: smtpPort,
        tls: !useTLS, // port 465 = implicit TLS (tls: true), port 587 = STARTTLS (tls: false)
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    // Inject signature and footer images into HTML
    // Vol. II §6.4: every HTML chunk passes through sanitizer before concat
    let finalHtml = sanitizeHtml(html);

    // If sent by an AI agent, use agent's signature instead of default
    if (agent_id) {
      const { data: agentRow } = await supabase
        .from("agents")
        .select("signature_html, signature_image_url, avatar_emoji, name, role, voice_call_url")
        .eq("id", agent_id)
        .single();

      if (agentRow?.signature_html) {
        finalHtml += sanitizeHtml(agentRow.signature_html);
      } else if (agentRow) {
        // Auto-generate minimal agent signature (escape user-provided fields)
        const safeName = escapeHtml(agentRow.name || "");
        const safeRole = escapeHtml(agentRow.role || "");
        const safeImageUrl = sanitizeHtml(`<img src="${agentRow.signature_image_url || ""}" alt="${safeName}" />`);
        const safeCallUrl = agentRow.voice_call_url
          ? sanitizeHtml(`<a href="${agentRow.voice_call_url}">Chiamami</a>`)
          : "";
        const avatarPart = agentRow.signature_image_url
          ? safeImageUrl
          : `<span style="font-size:28px;">${escapeHtml(agentRow.avatar_emoji || "")}</span>`;
        const callPart = safeCallUrl ? `<br/>${safeCallUrl}` : "";
        finalHtml += `<div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:12px;">
          <table cellpadding="0" cellspacing="0" style="font-family:Arial,sans-serif;font-size:13px;color:#333;">
            <tr>
              <td style="padding-right:10px;vertical-align:top;">${avatarPart}</td>
              <td style="vertical-align:top;">
                <strong>${safeName}</strong><br/>
                <span style="color:#666;font-size:12px;">${safeRole}</span>${callPart}
              </td>
            </tr>
          </table>
        </div>`;
      }
      // Still add footer image if configured
      const footerImg = s["ai_footer_image_url"];
      if (footerImg) {
        finalHtml += sanitizeHtml(`<div style="margin-top:24px;border-top:1px solid #e0e0e0;padding-top:16px"><img src="${footerImg}" alt="Footer" style="max-width:600px;width:100%;height:auto" /></div>`);
      }
    } else {
      // Default user signature
      const sigImg = s["ai_signature_image_url"];
      const footerImg = s["ai_footer_image_url"];
      if (sigImg) {
        finalHtml += sanitizeHtml(`<div style="margin-top:16px"><img src="${sigImg}" alt="Signature" style="max-width:300px;height:auto" /></div>`);
      }
      if (footerImg) {
        finalHtml += sanitizeHtml(`<div style="margin-top:24px;border-top:1px solid #e0e0e0;padding-top:16px"><img src="${footerImg}" alt="Footer" style="max-width:600px;width:100%;height:auto" /></div>`);
      }
    }

    // Resolve Reply-To: explicit > operator > commercial global > none
    let resolvedReplyTo = reply_to || null;
    if (!resolvedReplyTo && operator_id) {
      const { data: opRow } = await supabase
        .from("operators")
        .select("reply_to_email")
        .eq("id", operator_id)
        .single();
      if (opRow?.reply_to_email) resolvedReplyTo = opRow.reply_to_email;
    }
    if (!resolvedReplyTo) {
      const commercialReply = s["commercial_reply_to_email"];
      if (commercialReply) resolvedReplyTo = commercialReply;
    }

    const sendOptions: any = {
      from: senderEmail,
      to: to,
      subject: subject,
      content: "auto",
      html: finalHtml,
    };
    if (resolvedReplyTo) {
      sendOptions.replyTo = resolvedReplyTo;
    }

    await client.send(sendOptions);

    await client.close();

    // Log interaction in DB if partner_id provided
    if (partner_id) {
      await supabase.from("interactions").insert({
        partner_id,
        interaction_type: "email",
        subject: `Email a ${to}: ${subject}`,
        notes: html,
      });
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-email error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
