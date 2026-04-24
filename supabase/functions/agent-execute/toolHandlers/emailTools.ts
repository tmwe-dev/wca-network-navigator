import type { AgentExecuteSupabaseClient as SupabaseClient } from "../shared.ts";
import { runPostSendPipeline } from "../../_shared/postSendPipeline.ts";
import { checkCadenceGate, checkWhatsAppGate } from "../../_shared/postSendHook.ts";
import { buildEmailContract, validateEmailContract } from "../../_shared/emailContract.ts";
import { detectEmailType } from "../../_shared/emailTypeDetector.ts";
import { loadOptimusSettings } from "../../_shared/journalistSelector.ts";
import { journalistReview } from "../../_shared/journalistReviewLayer.ts";

export async function handleSendEmail(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
  authHeader: string,
  ctx?: { agentId?: string }
): Promise<unknown> {
  const partnerId = args.partner_id ? String(args.partner_id) : null;

  // ── PRE-SEND: Cadence gate (Costituzione §3 — mai stesso canale <7gg) ──
  if (partnerId) {
    const gate = await checkCadenceGate(supabase, userId, partnerId, "email");
    if (!gate.allowed) {
      return { error: `BLOCCATO: ${gate.reason}`, blocked_by: "cadence_gate" };
    }
  }

  // ── LOVABLE-81/82: Contratto + detector tipo prima dell'invio ──
  if (partnerId) {
    try {
      const { contract } = await buildEmailContract(supabase, userId, {
        engine: "agent-execute",
        operation: "generate",
        partnerId,
        contactId: args.contact_id ? String(args.contact_id) : null,
        emailType: String(args.email_type || "follow_up"),
        emailDescription: String(args.subject || ""),
        fallbackContactEmail: args.to_email ? String(args.to_email) : undefined,
      });
      const validation = validateEmailContract(contract);
      if (!validation.valid) {
        return {
          error: `Contratto email non valido: ${validation.errors.join("; ")}`,
          blocked_by: "email_contract",
          warnings: validation.warnings,
        };
      }
      const resolved = detectEmailType(contract);
      if (!resolved.proceed) {
        return {
          error: `Tipo "${resolved.original_type}" non coerente con stato/history. ${resolved.conflicts
            .filter((c) => c.severity === "blocking")
            .map((c) => c.suggestion)
            .join(". ")}`,
          blocked_by: "type_detector",
          type_resolution: resolved,
        };
      }
    } catch (cerr) {
      console.warn("[send_email] contract/detector failed (non-blocking):", cerr instanceof Error ? cerr.message : cerr);
    }
  }

  // ── GIORNALISTA AI: review pre-invio ──
  try {
    const optimus = await loadOptimusSettings(supabase, userId);
    if (optimus.enabled && args.html_body) {
      let leadStatus = "new";
      let companyName: string | null = null;
      if (partnerId) {
        const { data: p } = await supabase.from("partners").select("lead_status, company_name, country_name").eq("id", partnerId).maybeSingle();
        leadStatus = (p as { lead_status?: string } | null)?.lead_status || "new";
        companyName = (p as { company_name?: string } | null)?.company_name || null;
      }
      const review = await journalistReview(supabase, userId, {
        final_draft: String(args.html_body),
        resolved_brief: { objective: args.subject ? String(args.subject) : undefined },
        channel: "email",
        commercial_state: { lead_status: leadStatus },
        partner: { id: partnerId, company_name: companyName },
      }, { mode: optimus.mode, strictness: optimus.strictness });
      if (review.verdict === "block") {
        console.warn("[send_email] BLOCKED by journalist:", JSON.stringify(review.warnings));
        return {
          error: "Journalist Review ha bloccato questo messaggio. Correggi il brief e riprova.",
          blocked_by: "journalist_review",
          warnings: review.warnings,
        };
      }
      if (review.verdict === "warn") {
        console.warn("[send_email] WARN journalist:", JSON.stringify(review.warnings));
      }
      if (review.verdict === "pass_with_edits" && review.edited_text) {
        args.html_body = review.edited_text;
      }
    }
  } catch (jerr) {
    console.error("[send_email] journalistReview failed:", jerr);
  }

  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader },
    body: JSON.stringify({ to: args.to_email, toName: args.to_name, subject: args.subject, html: args.html_body }),
  });
  const data = await response.json();
  if (!response.ok) return { error: data.error || "Errore invio" };
  if (partnerId) await supabase.from("interactions").insert({ partner_id: partnerId, interaction_type: "email", subject: String(args.subject), notes: `Inviata a ${args.to_email}` });

  // ── POST-SEND PIPELINE UNIFICATA (LOVABLE-85) ──
  const seqDay = typeof args.sequence_day === "number" ? args.sequence_day : 0;
  const pipelineResult = await runPostSendPipeline(supabase, {
    userId,
    partnerId,
    contactId: args.contact_id ? String(args.contact_id) : null,
    channel: "email",
    subject: String(args.subject || ""),
    body: String(args.html_body || ""),
    to: String(args.to_email),
    sequenceDay: seqDay,
    agentId: ctx?.agentId,
    source: "agent",
  });
  

  return { success: true, message: `Email inviata a ${args.to_email}.`, post_send: pipelineResult };
}

export async function handleSendWhatsApp(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
  ctx?: { agentId?: string }
): Promise<unknown> {
  // ── WhatsApp gate (Costituzione §4) ──
  const partnerId = args.partner_id ? String(args.partner_id) : null;
  let leadStatus: string | null = null;
  let hasInboundWa = false;
  if (partnerId) {
    const { data: p } = await supabase.from("partners").select("lead_status").eq("id", partnerId).maybeSingle();
    leadStatus = p?.lead_status || null;
    const { count } = await supabase
      .from("channel_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("partner_id", partnerId).eq("channel", "whatsapp").eq("direction", "inbound");
    hasInboundWa = (count || 0) > 0;
  }
  const now = new Date();
  const wgate = checkWhatsAppGate({
    partnerLeadStatus: leadStatus,
    hasInboundWhatsApp: hasInboundWa,
    isWhitelisted: !!args.whitelisted,
    localHour: now.getHours(),
    localDayOfWeek: now.getDay(),
  });
  if (!wgate.allowed) {
    return { error: `BLOCCATO: ${wgate.reason}`, blocked_by: "whatsapp_gate" };
  }
  if (partnerId) {
    const cgate = await checkCadenceGate(supabase, userId, partnerId, "whatsapp");
    if (!cgate.allowed) return { error: `BLOCCATO: ${cgate.reason}`, blocked_by: "cadence_gate" };
  }

  // ── GIORNALISTA AI: review pre-invio WhatsApp ──
  try {
    const optimus = await loadOptimusSettings(supabase, userId);
    if (optimus.enabled && args.message) {
      const review = await journalistReview(supabase, userId, {
        final_draft: String(args.message),
        resolved_brief: {},
        channel: "whatsapp",
        commercial_state: { lead_status: leadStatus || "new" },
        partner: { id: partnerId, company_name: null },
      }, { mode: optimus.mode, strictness: optimus.strictness });
      if (review.verdict === "block") {
        console.warn("[send_whatsapp] BLOCKED by journalist:", JSON.stringify(review.warnings));
        return { error: "Journalist Review ha bloccato questo messaggio.", blocked_by: "journalist_review", warnings: review.warnings };
      }
      if (review.verdict === "pass_with_edits" && review.edited_text) {
        args.message = review.edited_text;
      }
    }
  } catch (jerr) {
    console.error("[send_whatsapp] journalistReview failed:", jerr);
  }

  // Bridge invio: registra come pending da bridge estensione
  await supabase.from("activities").insert({
    user_id: userId,
    partner_id: partnerId,
    source_id: partnerId || crypto.randomUUID(),
    source_type: partnerId ? "partner" : "imported_contact",
    activity_type: "whatsapp_message",
    title: `WA → ${args.phone || args.to || "?"}`,
    description: String(args.message || "").substring(0, 500),
    status: "pending",
  });
  const pipeWa = await runPostSendPipeline(supabase, {
    userId, partnerId,
    contactId: args.contact_id ? String(args.contact_id) : null,
    channel: "whatsapp",
    to: String(args.phone || args.to || ""),
    subject: String(args.message || "").substring(0, 80),
    body: String(args.message || ""),
    source: "agent",
    agentId: ctx?.agentId,
  });
  return { success: true, queued_to_bridge: true, post_send: pipeWa };
}

export async function handleSendLinkedIn(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string,
  ctx?: { agentId?: string }
): Promise<unknown> {
  const partnerId = args.partner_id ? String(args.partner_id) : null;
  if (partnerId) {
    const cgate = await checkCadenceGate(supabase, userId, partnerId, "linkedin");
    if (!cgate.allowed) return { error: `BLOCCATO: ${cgate.reason}`, blocked_by: "cadence_gate" };
  }
  await supabase.from("activities").insert({
    user_id: userId,
    partner_id: partnerId,
    source_id: partnerId || crypto.randomUUID(),
    source_type: partnerId ? "partner" : "imported_contact",
    activity_type: "linkedin_message",
    title: `LinkedIn → ${args.profile_url || args.to || "?"}`,
    description: String(args.message || "").substring(0, 500),
    status: "pending",
  });
  const seqDay = typeof args.sequence_day === "number" ? args.sequence_day : 0;
  const pipeLi = await runPostSendPipeline(supabase, {
    userId, partnerId,
    contactId: args.contact_id ? String(args.contact_id) : null,
    channel: "linkedin",
    to: String(args.profile_url || args.to || ""),
    subject: String(args.message || "").substring(0, 80),
    body: String(args.message || ""),
    sequenceDay: seqDay,
    source: "agent",
    agentId: ctx?.agentId,
  });
  return { success: true, queued_to_bridge: true, post_send: pipeLi };
}

export async function handleQueueOutreach(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const channel = String(args.channel || "email");
  const body = String(args.body || "");
  if (!body) return { error: "body è obbligatorio" };
  const { data, error } = await supabase.from("outreach_queue").insert({
    user_id: userId, channel,
    recipient_name: args.recipient_name ? String(args.recipient_name) : null,
    recipient_email: args.recipient_email ? String(args.recipient_email) : null,
    recipient_phone: args.recipient_phone ? String(args.recipient_phone) : null,
    recipient_linkedin_url: args.recipient_linkedin_url ? String(args.recipient_linkedin_url) : null,
    partner_id: args.partner_id ? String(args.partner_id) : null,
    contact_id: args.contact_id ? String(args.contact_id) : null,
    subject: args.subject ? String(args.subject) : null,
    body, priority: Number(args.priority) || 0, created_by: "agent",
  }).select("id, channel, recipient_name, status").single();
  if (error) return { error: error.message };
  return { success: true, queue_id: data.id, channel: data.channel, recipient: data.recipient_name, message: `Messaggio ${channel} accodato per ${data.recipient_name || "destinatario"}.` };
}

export async function handleScheduleEmail(
  supabase: SupabaseClient,
  args: Record<string, unknown>,
  userId: string
): Promise<unknown> {
  const scheduledAt = String(args.scheduled_at);
  const { data, error } = await supabase.from("email_campaign_queue").insert({
    recipient_email: String(args.to_email),
    recipient_name: args.to_name ? String(args.to_name) : null,
    subject: String(args.subject),
    html_body: String(args.html_body),
    partner_id: args.partner_id ? String(args.partner_id) : "00000000-0000-0000-0000-000000000000",
    scheduled_at: scheduledAt,
    status: "pending",
    user_id: userId,
  } as Record<string, unknown>).select("id").single();
  if (error) return { error: error.message };
  await supabase.from("activities").insert({
    title: `Email programmata: ${args.subject}`,
    activity_type: "email",
    source_type: "partner",
    source_id: args.partner_id || crypto.randomUUID(),
    partner_id: args.partner_id || null,
    scheduled_at: scheduledAt,
    status: "pending",
    user_id: userId,
    email_subject: String(args.subject),
    email_body: String(args.html_body),
    source_meta: { company_name: args.to_name || args.to_email, scheduled: true } as Record<string, unknown>,
  });
  return { success: true, queue_id: data.id, scheduled_at: scheduledAt, message: `Email programmata per ${scheduledAt} a ${args.to_email}.` };
}

export async function handleGenerateOutreach(
  authHeader: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-outreach`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: authHeader }, body: JSON.stringify(args),
  });
  const data = await response.json();
  if (!response.ok) return { error: data.error || "Errore generazione" };
  return { success: true, channel: data.channel, subject: data.subject, body: data.body };
}
