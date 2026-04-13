import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { aiChat } from "../_shared/aiGateway.ts";

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
}

interface ClassificationResult {
  category: string;
  confidence: number;
  ai_summary: string;
  keywords: string[];
  urgency: string;
  sentiment: string;
  detected_patterns: string[];
  action_suggested: string;
  reasoning: string;
}

interface ConversationExchange {
  date: string;
  subject: string;
  summary: string;
  direction: string;
  sentiment: string;
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

// ─── Prompt Builder ──────────────────────────────────────────────────────────

function buildClassificationPrompt(
  req: ClassifyRequest,
  conversationCtx: ConversationExchange[] | null,
  conversationSummary: string | null,
  rules: Record<string, unknown> | null,
  promptInstructions: string | null,
): string {
  const parts: string[] = [];

  // Context block
  if (conversationCtx?.length) {
    parts.push("## Conversation History (last exchanges)");
    for (const ex of conversationCtx.slice(-5)) {
      parts.push(`- [${ex.date}] ${ex.direction}: "${ex.subject}" — ${ex.summary} (sentiment: ${ex.sentiment})`);
    }
  }
  if (conversationSummary) {
    parts.push(`\n## Conversation Summary\n${conversationSummary}`);
  }
  if (rules) {
    const ruleDetails: string[] = [];
    if (rules.category) ruleDetails.push(`Category: ${rules.category}`);
    if (rules.tone_override) ruleDetails.push(`Preferred tone: ${rules.tone_override}`);
    if (Array.isArray(rules.topics_to_emphasize) && rules.topics_to_emphasize.length) {
      ruleDetails.push(`Topics to emphasize: ${(rules.topics_to_emphasize as string[]).join(", ")}`);
    }
    if (Array.isArray(rules.topics_to_avoid) && rules.topics_to_avoid.length) {
      ruleDetails.push(`Topics to avoid: ${(rules.topics_to_avoid as string[]).join(", ")}`);
    }
    if (ruleDetails.length) {
      parts.push(`\n## Sender Rules\n${ruleDetails.join("\n")}`);
    }
  }
  if (promptInstructions) {
    parts.push(`\n## Custom Instructions\n${promptInstructions}`);
  }

  // Email content
  parts.push(`\n## Email to Classify`);
  parts.push(`Direction: ${req.direction}`);
  parts.push(`From: ${req.email_address}`);
  parts.push(`Subject: ${req.subject}`);
  parts.push(`Body:\n${req.body.substring(0, 4000)}`);

  // Output format
  parts.push(`\n## Required Output`);
  parts.push(`Respond with a JSON object (no markdown, no code fences):
{
  "category": "interested|not_interested|request_info|meeting_request|complaint|follow_up|auto_reply|spam|uncategorized",
  "confidence": 0.0-1.0,
  "ai_summary": "one-sentence summary of the email content and intent",
  "keywords": ["keyword1", "keyword2"],
  "urgency": "critical|high|normal|low",
  "sentiment": "positive|negative|neutral|mixed",
  "detected_patterns": ["pattern1"],
  "action_suggested": "brief description of recommended next action",
  "reasoning": "brief explanation of classification reasoning"
}`);

  return parts.join("\n");
}

// ─── Response Parser ─────────────────────────────────────────────────────────

function parseClassificationResponse(raw: string | null): ClassificationResult {
  if (!raw) throw new Error("Empty AI response");

  // Strip markdown fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  const parsed = JSON.parse(cleaned);

  const VALID_CATEGORIES = ["interested", "not_interested", "request_info", "meeting_request", "complaint", "follow_up", "auto_reply", "spam", "uncategorized"];
  const VALID_URGENCY = ["critical", "high", "normal", "low"];
  const VALID_SENTIMENT = ["positive", "negative", "neutral", "mixed"];

  return {
    category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : "uncategorized",
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
    ai_summary: String(parsed.ai_summary || "").substring(0, 1000),
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords.map(String).slice(0, 20) : [],
    urgency: VALID_URGENCY.includes(parsed.urgency) ? parsed.urgency : "normal",
    sentiment: VALID_SENTIMENT.includes(parsed.sentiment) ? parsed.sentiment : "neutral",
    detected_patterns: Array.isArray(parsed.detected_patterns) ? parsed.detected_patterns.map(String).slice(0, 10) : [],
    action_suggested: String(parsed.action_suggested || "").substring(0, 500),
    reasoning: String(parsed.reasoning || "").substring(0, 1000),
  };
}

// ─── Sentiment Aggregation ───────────────────────────────────────────────────

function computeDominantSentiment(exchanges: ConversationExchange[]): string {
  const last3 = exchanges.slice(-3);
  if (!last3.length) return "neutral";
  const counts: Record<string, number> = {};
  for (const ex of last3) {
    counts[ex.sentiment] = (counts[ex.sentiment] || 0) + 1;
  }
  let max = 0;
  let dominant = "neutral";
  for (const [s, c] of Object.entries(counts)) {
    if (c > max) { max = c; dominant = s; }
  }
  return dominant;
}

// ─── Main Handler ────────────────────────────────────────────────────────────

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);
  const headers = { ...dynCors, "Content-Type": "application/json" };

  try {
    // 1. Validate input
    const body = await req.json();
    const input = validateRequest(body);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 2. Load context in parallel
    const [convCtxRes, rulesRes] = await Promise.all([
      supabase
        .from("contact_conversation_context")
        .select("last_exchanges, conversation_summary, dominant_sentiment")
        .eq("user_id", input.user_id)
        .eq("email_address", input.email_address)
        .maybeSingle(),
      supabase
        .from("email_address_rules")
        .select("*, email_prompts:prompt_id(instructions)")
        .eq("user_id", input.user_id)
        .eq("email_address", input.email_address)
        .maybeSingle(),
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

    // 3. Build prompt
    const userPrompt = buildClassificationPrompt(
      input,
      lastExchanges,
      conversationSummary,
      rules as Record<string, unknown> | null,
      promptInstructions,
    );

    const systemPrompt = "You are an email response classifier for a B2B commercial development platform specialized in logistics networks. Classify the incoming email and suggest the best next action. Always respond with valid JSON only, no markdown formatting.";

    // 4. Call AI
    const startMs = Date.now();
    const aiResult = await aiChat({
      models: ["google/gemini-2.5-flash", "openai/gpt-5-mini"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      max_tokens: 1024,
      timeoutMs: 30000,
      context: "classify-email-response",
    });
    const executionTimeMs = Date.now() - startMs;

    // 5. Parse response
    const classification = parseClassificationResponse(aiResult.content);

    // 6. Insert classification
    const { data: classRow, error: classErr } = await supabase
      .from("email_classifications")
      .insert({
        user_id: input.user_id,
        email_address: input.email_address,
        partner_id: input.partner_id || null,
        contact_id: input.contact_id || null,
        subject: input.subject,
        body_preview: input.body.substring(0, 500),
        direction: input.direction,
        category: classification.category,
        confidence: classification.confidence,
        ai_summary: classification.ai_summary,
        keywords: classification.keywords,
        urgency: classification.urgency,
        sentiment: classification.sentiment,
        detected_patterns: classification.detected_patterns,
        reasoning: classification.reasoning,
        action_suggested: classification.action_suggested,
        source_activity_id: input.source_activity_id || null,
      })
      .select("id")
      .single();

    if (classErr) {
      console.error("[classify] Insert classification error:", classErr.message);
    }

    const classificationId = classRow?.id;

    // 7. Update conversation context (upsert)
    const newExchange: ConversationExchange = {
      date: new Date().toISOString(),
      subject: input.subject,
      summary: classification.ai_summary,
      direction: input.direction,
      sentiment: classification.sentiment,
    };

    const updatedExchanges = [...lastExchanges, newExchange].slice(-8);
    const dominantSentiment = computeDominantSentiment(updatedExchanges);

    // Calculate response metrics from exchanges
    const inboundExchanges = updatedExchanges.filter(e => e.direction === "inbound");
    const outboundExchanges = updatedExchanges.filter(e => e.direction === "outbound");
    const responseRate = outboundExchanges.length > 0 && inboundExchanges.length > 0
      ? Math.round((inboundExchanges.length / outboundExchanges.length) * 100) / 100
      : 0;

    // Calculate avg response time from consecutive exchanges
    let avgResponseTimeHours: number | null = null;
    if (updatedExchanges.length >= 2) {
      const diffs: number[] = [];
      for (let i = 1; i < updatedExchanges.length; i++) {
        const prev = new Date(updatedExchanges[i - 1].date).getTime();
        const curr = new Date(updatedExchanges[i].date).getTime();
        if (curr > prev) diffs.push((curr - prev) / (1000 * 60 * 60));
      }
      if (diffs.length) avgResponseTimeHours = Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 100) / 100;
    }

    const updatedSummary = classification.ai_summary
      ? `Latest: ${classification.ai_summary}${conversationSummary ? ` | Previous: ${conversationSummary.substring(0, 300)}` : ""}`
      : conversationSummary;

    await supabase
      .from("contact_conversation_context")
      .upsert({
        user_id: input.user_id,
        email_address: input.email_address,
        partner_id: input.partner_id || null,
        contact_id: input.contact_id || null,
        last_exchanges: updatedExchanges,
        conversation_summary: updatedSummary?.substring(0, 2000) ?? null,
        interaction_count: (convCtx?.interaction_count ?? 0) + 1,
        last_interaction_at: new Date().toISOString(),
        dominant_sentiment: dominantSentiment,
        response_rate: responseRate,
        avg_response_time_hours: avgResponseTimeHours,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,email_address" });

    // 8. Log AI decision
    const { data: decisionRow } = await supabase
      .from("ai_decision_log")
      .insert({
        user_id: input.user_id,
        partner_id: input.partner_id || null,
        contact_id: input.contact_id || null,
        email_address: input.email_address,
        decision_type: "classify_email",
        input_context: {
          subject: input.subject,
          body_preview: input.body.substring(0, 200),
          direction: input.direction,
          conversation_length: lastExchanges.length,
          has_rules: !!rules,
        },
        ai_reasoning: classification.reasoning,
        decision_output: {
          category: classification.category,
          confidence: classification.confidence,
          urgency: classification.urgency,
          sentiment: classification.sentiment,
          action_suggested: classification.action_suggested,
          classification_id: classificationId,
        },
        confidence: classification.confidence,
        model_used: aiResult.modelUsed,
        tokens_used: aiResult.usage.totalTokens,
        was_auto_executed: false,
        execution_time_ms: executionTimeMs,
      })
      .select("id")
      .single();

    const decisionLogId = decisionRow?.id;

    // 9. Auto-action logic
    let actionTaken: "auto_executed" | "pending_review" | "none" = "none";

    if (rules) {
      const autoExecute = (rules as Record<string, unknown>).auto_execute === true;
      const threshold = Number((rules as Record<string, unknown>).ai_confidence_threshold) || 0.85;
      const autoAction = String((rules as Record<string, unknown>).auto_action || "none");

      if (autoAction !== "none") {
        if (autoExecute && classification.confidence >= threshold) {
          // Auto-execute: log as executed
          actionTaken = "auto_executed";

          // Update the decision log
          if (decisionLogId) {
            await supabase
              .from("ai_decision_log")
              .update({ was_auto_executed: true })
              .eq("id", decisionLogId);
          }

          // Insert executed pending action for audit trail
          await supabase
            .from("ai_pending_actions")
            .insert({
              user_id: input.user_id,
              decision_log_id: decisionLogId || null,
              partner_id: input.partner_id || null,
              contact_id: input.contact_id || null,
              email_address: input.email_address,
              action_type: autoAction,
              action_payload: (rules as Record<string, unknown>).auto_action_params || {},
              suggested_content: classification.action_suggested,
              reasoning: classification.reasoning,
              confidence: classification.confidence,
              source: "ai_classifier",
              status: "executed",
              executed_at: new Date().toISOString(),
            });

          // Update interaction stats on the rule
          await supabase
            .from("email_address_rules")
            .update({
              interaction_count: ((rules as Record<string, unknown>).interaction_count as number || 0) + 1,
              last_interaction_at: new Date().toISOString(),
            })
            .eq("id", (rules as Record<string, unknown>).id as string);
        } else {
          // Queue for review
          actionTaken = "pending_review";

          await supabase
            .from("ai_pending_actions")
            .insert({
              user_id: input.user_id,
              decision_log_id: decisionLogId || null,
              partner_id: input.partner_id || null,
              contact_id: input.contact_id || null,
              email_address: input.email_address,
              action_type: autoAction,
              action_payload: (rules as Record<string, unknown>).auto_action_params || {},
              suggested_content: classification.action_suggested,
              reasoning: classification.reasoning,
              confidence: classification.confidence,
              source: "ai_classifier",
              status: "pending",
            });
        }
      }
    }

    console.log(`[classify-email-response] Done: category=${classification.category} confidence=${classification.confidence} action=${actionTaken}`);

    return new Response(JSON.stringify({
      success: true,
      classification_id: classificationId,
      category: classification.category,
      confidence: classification.confidence,
      action_taken: actionTaken,
    }), { headers });

  } catch (e: unknown) {
    console.error("[classify-email-response] Error:", extractErrorMessage(e));
    return edgeError("INTERNAL_ERROR", extractErrorMessage(e), undefined, dynCors);
  }
});
