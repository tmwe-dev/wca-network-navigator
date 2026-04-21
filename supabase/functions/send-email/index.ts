import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { sanitizeHtml, escapeHtml } from "../_shared/htmlSanitizer.ts";
import { runPostSendPipeline } from "../_shared/postSendPipeline.ts";
import { loadSendingConfig, validateSendingWindow, validateSmtpConfig } from "../_shared/emailSendingConfig.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { journalistReview } from "../_shared/journalistReviewLayer.ts";
import type { JournalistReviewInput } from "../_shared/journalistTypes.ts";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AppSettingRow {
  key: string;
  value: string | null;
}

interface SendEmailBody {
  to: string;
  subject: string;
  html: string;
  from?: string;
  partner_id?: string;
  contact_id?: string;
  agent_id?: string;
  reply_to?: string;
  operator_id?: string;
  in_reply_to?: string;
  references?: string;
  /**
   * Idempotency key — if provided, a successful send with the same key
   * + recipient is returned cached (no double-send) and a failed one is
   * recorded so the caller can decide whether to retry.
   */
  idempotency_key?: string;
  /**
   * If true, skip journalist review (content was already reviewed upstream)
   */
  journalist_reviewed?: boolean;
}

interface SmtpSendOptions {
  from: string;
  to: string;
  subject: string;
  content: string;
  html: string;
  replyTo?: string;
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // ── Auth check ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return edgeError("AUTH_REQUIRED", "Unauthorized");
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims?.sub) {
      return edgeError("AUTH_INVALID", "Invalid or expired token");
    }

    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: SendEmailBody = await req.json();
    const { to, subject, html, from, partner_id, contact_id, agent_id, reply_to, operator_id, idempotency_key, journalist_reviewed } = body;

    if (!to || !subject || !html) {
      return edgeError("VALIDATION_ERROR", "Missing required fields: to, subject, html");
    }

    // Validate email format
    if (!EMAIL_REGEX.test(to)) {
      return edgeError("VALIDATION_ERROR", "Invalid recipient email format", to);
    }

    const userIdEarly = claimsData.claims.sub as string;

    // ── LOVABLE-58: Idempotency check ─────────────────────────────────
    // Se la stessa idempotency_key + recipient è già stata "sent",
    // restituisce il risultato cached evitando il doppio invio.
    if (idempotency_key) {
      const { data: prior } = await supabase
        .from("email_campaign_queue")
        .select("status, message_id, error_message")
        .eq("idempotency_key", idempotency_key)
        .eq("recipient_email", to)
        .in("status", ["sent", "failed"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (prior?.status === "sent") {
        console.log(`[send-email] Idempotent hit for key=${idempotency_key} → cached`);
        return new Response(
          JSON.stringify({
            success: true,
            cached: true,
            message_id: prior.message_id ?? null,
          }),
          { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }
    }

    // ── HARD GUARD: blacklist commerciale prima di qualsiasi invio ───────────
    const recipientEmail = to.toLowerCase().trim();
    const recipientDomain = recipientEmail.includes("@") ? recipientEmail.split("@")[1] : null;
    const blacklistQuery = supabase
      .from("blacklist")
      .select("id, reason")
      .eq("user_id", userIdEarly)
      .limit(1);
    const { data: blacklisted } = recipientDomain
      ? await blacklistQuery.or(`email.eq.${recipientEmail},domain.eq.${recipientDomain}`).maybeSingle()
      : await blacklistQuery.eq("email", recipientEmail).maybeSingle();

    if (blacklisted) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "BLACKLISTED",
          reason: blacklisted.reason || "Destinatario in blacklist",
          retriable: false,
        }),
        { status: 403, headers: { ...dynCors, "Content-Type": "application/json" } },
      );
    }

    if (partner_id) {
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", partner_id)
        .maybeSingle();
      if (partner?.lead_status === "blacklisted") {
        return new Response(
          JSON.stringify({ success: false, error: "BLACKLISTED", reason: "Partner con lead_status = blacklisted", retriable: false }),
          { status: 403, headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }
    }

    if (contact_id) {
      const { data: contact } = await supabase
        .from("imported_contacts")
        .select("lead_status")
        .eq("id", contact_id)
        .maybeSingle();
      if (contact?.lead_status === "blacklisted") {
        return new Response(
          JSON.stringify({ success: false, error: "BLACKLISTED", reason: "Contatto con lead_status = blacklisted", retriable: false }),
          { status: 403, headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }
    }

    // ── HARD GUARD: blocca invio a email bounced/invalid ─────────────────
    // Controlla email_status (fatto tecnico, separato da lead_status commerciale).
    const [contactCheck, partnerCheck] = await Promise.all([
      supabase.from("imported_contacts").select("email_status").ilike("email", to).limit(1).maybeSingle(),
      supabase.from("partners").select("email_status").ilike("email", to).limit(1).maybeSingle(),
    ]);
    const blockedStatus =
      (contactCheck.data?.email_status && contactCheck.data.email_status !== "valid")
        ? contactCheck.data.email_status
        : (partnerCheck.data?.email_status && partnerCheck.data.email_status !== "valid")
          ? partnerCheck.data.email_status
          : null;
    if (blockedStatus) {
      console.warn(`[send-email] BLOCKED — ${to} has email_status='${blockedStatus}'`);
      return edgeError(
        "VALIDATION_ERROR",
        `Email non inviabile: indirizzo segnato come "${blockedStatus}". Aggiorna lo stato in CRM se è tornato valido.`,
        to,
      );
    }

    // Read SMTP settings from app_settings (scoped to authenticated user)
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", claimsData.claims.sub as string)
      .in("key", [
        "smtp_host", "smtp_port", "smtp_user", "smtp_password",
        "default_sender_email", "default_sender_name",
        "ai_signature_image_url", "ai_footer_image_url",
      ]);

    const s: Record<string, string> = {};
    (settingsRows as AppSettingRow[] | null)?.forEach((row) => { if (row.value) s[row.key] = row.value; });

    const smtpHost = s["smtp_host"];
    const smtpPort = parseInt(s["smtp_port"] || "465", 10);
    const smtpUser = s["smtp_user"];
    const smtpPass = s["smtp_password"];

    if (!smtpHost || !smtpUser || !smtpPass) {
      return edgeError("VALIDATION_ERROR", "SMTP non configurato. Vai in Impostazioni → Email per configurarlo.");
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
        tls: !useTLS,
        auth: {
          username: smtpUser,
          password: smtpPass,
        },
      },
    });

    // Inject signature and footer images into HTML
    let finalHtml = sanitizeHtml(html);

    // Helper: validate URL is https before interpolation
    const isValidHttpsUrl = (url: string | undefined): url is string =>
      typeof url === "string" && url.startsWith("https://");

    if (agent_id) {
      const { data: agentRow } = await supabase
        .from("agents")
        .select("signature_html, signature_image_url, avatar_emoji, name, role, voice_call_url")
        .eq("id", agent_id)
        .eq("user_id", claimsData.claims.sub as string)
        .single();

      if (agentRow?.signature_html) {
        finalHtml += sanitizeHtml(agentRow.signature_html);
      } else if (agentRow) {
        const safeName = escapeHtml(agentRow.name || "");
        const safeRole = escapeHtml(agentRow.role || "");
        const avatarPart = isValidHttpsUrl(agentRow.signature_image_url)
          ? sanitizeHtml(`<img src="${agentRow.signature_image_url}" alt="${safeName}" />`)
          : `<span style="font-size:28px;">${escapeHtml(agentRow.avatar_emoji || "")}</span>`;
        const callPart = agentRow.voice_call_url
          ? `<br/>${sanitizeHtml(`<a href="${agentRow.voice_call_url}">Chiamami</a>`)}`
          : "";
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
      const footerImg = s["ai_footer_image_url"];
      if (isValidHttpsUrl(footerImg)) {
        finalHtml += sanitizeHtml(`<div style="margin-top:24px;border-top:1px solid #e0e0e0;padding-top:16px"><img src="${footerImg}" alt="Footer" style="max-width:600px;width:100%;height:auto" /></div>`);
      }
    } else {
      const sigImg = s["ai_signature_image_url"];
      const footerImg = s["ai_footer_image_url"];
      if (isValidHttpsUrl(sigImg)) {
        finalHtml += sanitizeHtml(`<div style="margin-top:16px"><img src="${sigImg}" alt="Signature" style="max-width:300px;height:auto" /></div>`);
      }
      if (isValidHttpsUrl(footerImg)) {
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

    // ── LOVABLE-80: Journalist Review Gate ─────────────────────────────
    // Skip review if already reviewed upstream (e.g., from generate-email or agent-execute)
    if (!journalist_reviewed) {
      // Fetch partner & contact data for journalist review context
      const [partnerData, contactData] = await Promise.all([
        partner_id
          ? supabase
              .from("partners")
              .select("company_name, country")
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
        final_draft: html,
        resolved_brief: {},
        channel: "email",
        commercial_state: {
          lead_status: "unknown",
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

      const reviewResult = await journalistReview(supabase, userIdEarly, reviewInput);

      // Block send if journalist review verdict is "block"
      if (reviewResult.verdict === "block") {
        console.warn(`[send-email] BLOCKED by journalist review: ${reviewResult.reasoning_summary}`);
        return new Response(
          JSON.stringify({
            success: false,
            error: "JOURNALIST_BLOCK",
            reason: reviewResult.reasoning_summary,
            warnings: reviewResult.warnings,
            retriable: false,
          }),
          { status: 403, headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }

      // If edits were made (pass_with_edits), use edited version
      if (reviewResult.verdict === "pass_with_edits") {
        finalHtml = reviewResult.edited_text;
      }
    }

    const sendOptions: SmtpSendOptions = {
      from: senderEmail,
      to: to,
      subject: subject,
      content: "auto",
      html: finalHtml,
    };
    if (resolvedReplyTo) {
      sendOptions.replyTo = resolvedReplyTo;
    }

    // Generate synthetic Message-ID (denomailer doesn't expose server-assigned ID)
    const messageIdExternal = `<${Date.now()}.${crypto.randomUUID().slice(0, 8)}@wca-crm.app>`;
    const threadId = body.in_reply_to || body.references || messageIdExternal;

    // ── LOVABLE-58: SMTP send wrapped in try/catch with retriable classification ──
    try {
      await client.send(sendOptions);
      await client.close();
    } catch (smtpErr) {
      try { await client.close(); } catch { /* ignore */ }
      const errMsg = extractErrorMessage(smtpErr);
      const lower = errMsg.toLowerCase();
      const retriable =
        lower.includes("timeout") ||
        lower.includes("etimedout") ||
        lower.includes("econnreset") ||
        lower.includes("429") ||
        lower.includes("rate limit") ||
        lower.includes("temporarily") ||
        /\b4\d\d\b/.test(lower); // 4xx generic transient

      // Persist failure if idempotency_key provided so caller can decide
      if (idempotency_key) {
        await supabase.from("email_campaign_queue").insert({
          user_id: userIdEarly,
          partner_id: partner_id ?? null,
          recipient_email: to,
          subject,
          html_body: html,
          status: "failed",
          idempotency_key,
          error_message: errMsg.slice(0, 1000),
          failed_at: new Date().toISOString(),
        });
      }

      console.error(`[send-email] SMTP failure (retriable=${retriable}):`, errMsg);
      return new Response(
        JSON.stringify({ success: false, retriable, error: errMsg }),
        {
          status: retriable ? 503 : 502,
          headers: { ...dynCors, "Content-Type": "application/json" },
        },
      );
    }

    // Log side effects ONLY after confirmed SMTP success — via pipeline unificata
    // LOVABLE-93: sourceType esplicito per multi-source support
    const pipelineResult = await runPostSendPipeline(supabase, {
      userId: userIdEarly,
      partnerId: partner_id || null,
      contactId: contact_id || null,
      sourceType: contact_id && !partner_id ? "imported_contact" : "partner",
      channel: "email",
      subject,
      body: html,
      to,
      agentId: agent_id,
      source: agent_id ? "agent" : "email_forge",
      messageIdExternal,
      threadId,
    });
    console.log("[send-email] postSendPipeline:", JSON.stringify(pipelineResult));

    // Persist idempotency success record
    if (idempotency_key) {
      await supabase.from("email_campaign_queue").insert({
        user_id: userIdEarly,
        partner_id: partner_id ?? null,
        recipient_email: to,
        subject,
        html_body: html,
        status: "sent",
        idempotency_key,
        message_id: messageIdExternal,
        sent_at: new Date().toISOString(),
      });
    }

    // LOVABLE-93: supervisor audit è ora integrato in postSendPipeline

    return new Response(
      JSON.stringify({ success: true, message_id: messageIdExternal, retriable: false }),
      { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    console.error("send-email error:", e);
    return edgeError("INTERNAL_ERROR", extractErrorMessage(e));
  }
});
