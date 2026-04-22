import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { aiChat } from "../_shared/aiGateway.ts";
import { logSupervisorAudit } from "../_shared/supervisorAudit.ts";
import { applyLeadStatusChange } from "../_shared/leadStatusGuard.ts";
import { runPostClassificationPipeline } from "../_shared/postClassificationPipeline.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { getMaxTokensForFunction } from "../_shared/tokenLogger.ts";

// ── Import refactored modules ──
import { buildClassificationPrompt, ConversationExchange } from "./classificationPrompts.ts";
import { parseClassificationResponse, ClassificationResult, computeDominantSentiment, getNextStatus } from "./responseParser.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ClassifyRequest {
  user_id: string;
  email_address: string;
  subject: string;
  body: string;
  direction: "inbound" | "outbound";
  source_activity_id?: string;
  partner_id?: string;
  contact_id?: string;
  sender_name?: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateRequest(data: unknown): ClassifyRequest {
  const d = data as Record<string, unknown>;
  if (!d?.user_id || typeof d.user_id !== "string") throw new Error("user_id required");
  if (!d?.email_address || typeof d.email_address !== "string") throw new Error("email_address required");
  if (!d?.subject || typeof d.subject !== "string") throw new Error("subject required");
  if (!d?.body || typeof d.body !== "string") throw new Error("body required");
  if (!["inbound", "outbound"].includes(d.direction as string)) throw new Error("direction must be inbound or outbound");
  return d as unknown as ClassifyRequest;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  const headers = { ...dynCors, "Content-Type": "application/json" };

  const metrics = startMetrics("classify-email-response");
  try {
    // 0. Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers });
    }
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "AUTH_INVALID" }), { status: 401, headers });
    }

    // Rate limiting
    const rl = checkRateLimit(`classify:${claimsData.claims.sub}`, { maxTokens: 60, refillRate: 1 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    // 1. Validate input
    const body = await req.json();
    const input = validateRequest(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // LOVABLE-93: global pause check
    const { data: pauseSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_automations_paused")
      .eq("user_id", input.user_id)
      .maybeSingle();

    if (pauseSettings?.value === "true") {
      console.log(`[classify-email-response] AI automations paused for user ${input.user_id}`);
      return new Response(JSON.stringify({ error: "AI automations are paused" }), {
        status: 503, headers,
      });
    }

    // 2. Load context in parallel
    const [convCtxRes, rulesRes, allClassificationsRes] = await Promise.all([
      supabase
        .from("contact_conversation_context")
        .select("last_exchanges, conversation_summary, dominant_sentiment, last_interaction_at")
        .eq("user_id", input.user_id)
        .eq("email_address", input.email_address)
        .maybeSingle(),
      supabase
        .from("email_address_rules")
        .select("*, email_prompts:prompt_id(instructions), partner_id, domain_type")
        .eq("user_id", input.user_id)
        .eq("email_address", input.email_address)
        .maybeSingle(),
      supabase
        .from("email_classifications")
        .select("id, classified_at")
        .eq("user_id", input.user_id)
        .eq("email_address", input.email_address),
    ]);

    const convCtx = convCtxRes.data;
    const lastExchanges: ConversationExchange[] = Array.isArray(convCtx?.last_exchanges)
      ? convCtx.last_exchanges as ConversationExchange[]
      : [];
    const conversationSummary: string | null = convCtx?.conversation_summary ?? null;

    const rules = rulesRes.data;
    const promptInstructions: string | null =
      (rules as Record<string, unknown>)?.email_prompts
        ? ((rules as Record<string, unknown>).email_prompts as Record<string, string>)?.instructions ?? null
        : null;

    // LOVABLE-93: Compute relational context
    let relationalContext: { lead_status?: string; touchCount?: number; daysSinceLastContact?: number } | null = null;
    const partnerId = input.partner_id || (rules as Record<string, unknown> | null)?.partner_id;
    if (partnerId) {
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", partnerId)
        .maybeSingle();

      if (partner) {
        const touchCount = allClassificationsRes.data?.length ?? 0;
        let daysSinceLastContact: number | undefined = undefined;

        const lastInteractionAt = convCtx?.last_interaction_at;
        if (lastInteractionAt) {
          const lastDate = new Date(lastInteractionAt);
          const today = new Date();
          daysSinceLastContact = Math.floor((today.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        }

        relationalContext = {
          lead_status: partner.lead_status,
          touchCount,
          daysSinceLastContact,
        };
      }
    }

    // 3. Call AI for classification
    const classPrompt = buildClassificationPrompt(
      input,
      lastExchanges,
      conversationSummary,
      rules as Record<string, unknown>,
      promptInstructions,
      relationalContext
    );

    const maxTokens = await getMaxTokensForFunction(supabase, input.user_id, "ai_max_tokens_classify_email", 1000);
    const aiRes = await aiChat({
      model: "claude-opus-4-1-20250805",
      system: "Ti specializzi nella classificazione di email commerciali. Analizza con cura il dominio, la categoria, la fiducia e l'urgenza. Rispondi SOLO con JSON valido, no markdown, no code fences.",
      messages: [{ role: "user", content: classPrompt }],
      temperature: 0.3,
      max_tokens: maxTokens,
    });

    let classification: ClassificationResult;
    try {
      classification = parseClassificationResponse(aiRes.content[0].type === "text" ? aiRes.content[0].text : null);
    } catch (parseErr) {
      console.error("[classify-email-response] Parse error:", parseErr);
      return edgeError("CLASSIFICATION_PARSE_ERROR", String(parseErr), undefined, dynCors);
    }

    // 4. Upsert classification
    const { data: existingClass } = await supabase
      .from("email_classifications")
      .select("id")
      .eq("user_id", input.user_id)
      .eq("email_address", input.email_address)
      .eq("classified_at", new Date().toISOString().split("T")[0])
      .limit(1);

    const classificationId = existingClass?.[0]?.id || crypto.randomUUID();
    const { error: upsertErr } = await supabase.from("email_classifications").upsert({
      id: classificationId,
      user_id: input.user_id,
      email_address: input.email_address,
      domain: classification.domain,
      category: classification.category,
      confidence: classification.confidence,
      ai_summary: classification.ai_summary,
      keywords: classification.keywords,
      urgency: classification.urgency,
      sentiment: classification.sentiment,
      detected_patterns: classification.detected_patterns,
      action_suggested: classification.action_suggested,
      reasoning: classification.reasoning,
      partner_id: input.partner_id || null,
      contact_id: input.contact_id || null,
      classified_at: new Date().toISOString(),
      source_activity_id: input.source_activity_id || null,
    });

    if (upsertErr) {
      console.error("[classify-email-response] Upsert error:", upsertErr);
      return edgeError("CLASSIFICATION_UPSERT_ERROR", upsertErr.message, undefined, dynCors);
    }

    // 5. Auto-execute eligible actions
    let actionTaken = "none";
    let decisionLogId: string | null = null;

    if (classification.confidence >= 0.70 && input.partner_id && input.direction === "inbound") {
      // ── Status transition logic ──
      const { data: partner } = await supabase
        .from("partners")
        .select("lead_status")
        .eq("id", input.partner_id)
        .maybeSingle();

      if (partner) {
        const nextStatus = getNextStatus(partner.lead_status, classification);
        if (nextStatus) {
          const guardRes = await applyLeadStatusChange(supabase, {
            userId: input.user_id,
            partnerId: input.partner_id,
            newLeadStatus: nextStatus,
            reason: `Auto-executed by AI classification: ${classification.category} (${classification.domain})`,
            channel: "email",
          });

          if (guardRes.allowed) {
            const { error: statusErr } = await supabase
              .from("partners")
              .update({ lead_status: nextStatus, updated_at: new Date().toISOString() })
              .eq("id", input.partner_id);

            if (!statusErr) {
              actionTaken = "auto_executed";
              decisionLogId = crypto.randomUUID();
              await logSupervisorAudit(supabase, {
                audit_id: decisionLogId,
                user_id: input.user_id,
                action_type: "lead_status_change",
                action_detail: `Email da ${input.email_address} classificata: ${classification.domain}/${classification.category} (${Math.round(classification.confidence * 100)}%)`,
                target_type: "email",
                partner_id: input.partner_id || undefined,
                email_address: input.email_address,
                decision_origin: "ai_auto",
                ai_decision_log_id: decisionLogId || undefined,
                metadata: { domain: classification.domain, category: classification.category, confidence: classification.confidence, sentiment: classification.sentiment, action_suggested: classification.action_suggested },
              });
            }
          }
        }
      }
    }

    // ═══ LOVABLE-93: Auto-suggest group ═══
    try {
      const { data: addressRule } = await supabase
        .from("email_address_rules")
        .select("id, group_id, ai_suggested_group, ai_suggestion_confidence")
        .eq("user_id", input.user_id)
        .eq("email_address", input.email_address)
        .maybeSingle();

      if (addressRule) {
        const hasGroup = !!addressRule.group_id;
        const currentSuggestionConfidence = addressRule.ai_suggestion_confidence || 0;
        const shouldUpdate = !hasGroup && classification.confidence > currentSuggestionConfidence;

        if (shouldUpdate) {
          await supabase
            .from("email_address_rules")
            .update({
              ai_suggested_group: `auto_${classification.category}`,
              ai_suggestion_confidence: classification.confidence,
            })
            .eq("id", addressRule.id);

          console.log(
            `[classify-email-response] Updated AI suggestion for ${input.email_address}: ` +
            `category=${classification.category}, confidence=${classification.confidence}`
          );
        }
      }
    } catch (aiSuggestErr) {
      console.warn("[classify-email-response] AI suggestion update error (non-blocking):", aiSuggestErr);
    }

    // ═══ LOVABLE-86: Post-classification pipeline ═══
    let postClassResult = null;
    try {
      postClassResult = await runPostClassificationPipeline(supabase, {
        userId: input.user_id,
        partnerId: input.partner_id || null,
        contactId: input.contact_id || null,
        domain: classification.domain,
        category: classification.category,
        confidence: classification.confidence,
        senderEmail: input.email_address || "",
        senderName: input.sender_name || undefined,
        subject: input.subject || undefined,
        aiSummary: classification.ai_summary || undefined,
        urgency: classification.urgency || undefined,
        sentiment: classification.sentiment || undefined,
        channel: "email",
      });
      console.log(`[classify-email-response] postClassification:`, JSON.stringify(postClassResult));
    } catch (pcErr) {
      console.warn("[classify-email-response] postClassification error (non-blocking):", pcErr);
    }

    console.log(`[classify-email-response] Done: category=${classification.category} confidence=${classification.confidence} action=${actionTaken}`);

    metrics.userId = input.user_id;
    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({
      success: true,
      classification_id: classificationId,
      category: classification.category,
      confidence: classification.confidence,
      action_taken: actionTaken,
      post_classification: postClassResult,
    }), { headers });

  } catch (e: unknown) {
    logEdgeError("classify-email-response", e);
    endMetrics(metrics, false, 500);
    console.error("[classify-email-response] Error:", extractErrorMessage(e));
    return edgeError("INTERNAL_ERROR", extractErrorMessage(e), undefined, dynCors);
  }
});
