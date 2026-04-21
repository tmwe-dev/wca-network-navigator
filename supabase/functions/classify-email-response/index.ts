import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { aiChat } from "../_shared/aiGateway.ts";
import { logSupervisorAudit } from "../_shared/supervisorAudit.ts";
import { applyLeadStatusChange } from "../_shared/leadStatusGuard.ts";
import { runPostClassificationPipeline } from "../_shared/postClassificationPipeline.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { assemblePrompt } from "../_shared/prompts/assembler.ts";

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
  domain: string; // LOVABLE-93: classificazione dominio (commercial/operative/admin/support/internal)
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
  relationalContext?: { lead_status?: string; touchCount?: number; daysSinceLastContact?: number } | null,
): string {
  const parts: string[] = [];

  // ── PRIORITY: custom_prompt injection (BEFORE conversation history) ──
  if (rules && rules.custom_prompt && typeof rules.custom_prompt === "string") {
    parts.push(`## ⚠️ ISTRUZIONE PRIORITARIA PER QUESTO INDIRIZZO\n${rules.custom_prompt}`);
  }

  // LOVABLE-93: Domain type hint from email_address_rules
  if (rules && rules.domain_type && typeof rules.domain_type === "string") {
    parts.push(`## DOMINIO PREDEFINITO\nQuesto indirizzo è stato manualmente categorizzato come: "${rules.domain_type}"\nUsare questa informazione come segnale primario di classificazione.`);
  }

  // LOVABLE-93: contesto relazionale per classificazione
  if (relationalContext) {
    const relCtx: string[] = ["## STATO RELAZIONALE"];
    relCtx.push(`Fase: ${relationalContext.lead_status || "sconosciuto"}`);
    if (relationalContext.touchCount !== undefined) {
      relCtx.push(`Touch totali: ${relationalContext.touchCount}`);
    }
    if (relationalContext.daysSinceLastContact !== undefined) {
      relCtx.push(`Giorni dall'ultimo contatto: ${relationalContext.daysSinceLastContact}`);
    }
    parts.push(relCtx.join("\n"));
  }

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

  // LOVABLE-93: Domain detection hints and rules
  parts.push(`\n## DOMAIN DETECTION RULES (Livello 1)
Classify email domain FIRST before category classification:
- "operative": richieste preventivo, booking, tracking spedizioni, documentazione, tariffe, stato merce, ordini
- "administrative": fatture, pagamenti, solleciti, note di credito, estratti conto, verifiche contabili, ricevute
- "support": reclami, richieste assistenza, problemi tecnici, feedback servizio, errori sistema
- "internal": newsletter, notifiche sistema, comunicazioni interne, auto-reply di sistema, digest automati
- "commercial": tutto ciò che riguarda prospect, lead, partnership, collaborazione nuova, follow-up commerciali

If email_address has manual domain_type set (from email_address_rules), RESPECT that as primary signal.`);

  // Output format
  parts.push(`\n## Required Output`);
  parts.push(`Respond with a JSON object (no markdown, no code fences):
{
  "domain": "commercial|operative|administrative|support|internal",
  "category": "interested|not_interested|request_info|question|meeting_request|complaint|follow_up|auto_reply|unsubscribe|bounce|spam|uncategorized|quote_request|booking_request|shipment_tracking|documentation_request|rate_inquiry|cargo_status|invoice_query|payment_request|payment_confirmation|credit_note|account_statement|service_inquiry|technical_issue|feedback|newsletter|system_notification|internal_communication",
  "confidence": 0.0-1.0,
  "ai_summary": "one-sentence summary of the email content and intent. If the email is NOT in Italian, provide an Italian translation summary here.",
  "keywords": ["keyword1", "keyword2"],
  "urgency": "critical|high|normal|low",
  "sentiment": "positive|negative|neutral|mixed",
  "detected_patterns": ["pattern1"],
  "action_suggested": "brief description of recommended next action",
  "reasoning": "brief explanation of classification reasoning",
  "detected_language": "detected language of the email (e.g. English, Deutsch, Français, Italiano)"
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

  // LOVABLE-93: Add domain validation
  const VALID_DOMAINS = ["commercial", "operative", "administrative", "support", "internal"];
  const VALID_CATEGORIES = [
    "interested", "not_interested", "request_info", "question", "meeting_request", "complaint", "follow_up", "auto_reply", "unsubscribe", "bounce", "spam", "uncategorized",
    // operative categories
    "quote_request", "booking_request", "shipment_tracking", "documentation_request", "rate_inquiry", "cargo_status",
    // administrative categories
    "invoice_query", "payment_request", "payment_confirmation", "credit_note", "account_statement",
    // support categories
    "service_inquiry", "technical_issue", "feedback",
    // internal categories
    "newsletter", "system_notification", "internal_communication",
  ];
  const VALID_URGENCY = ["critical", "high", "normal", "low"];
  const VALID_SENTIMENT = ["positive", "negative", "neutral", "mixed"];

  return {
    domain: VALID_DOMAINS.includes(parsed.domain) ? parsed.domain : "commercial",
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

function getNextStatus(currentStatus: string, classification: { category: string; confidence: number }): string | null {
  const cat = classification.category;
  if (["interested", "meeting_request", "question", "request_info"].includes(cat)) {
    switch (currentStatus) {
      case "new": return "first_touch_sent";
      case "first_touch_sent": return "engaged";
      case "holding": return "engaged";
      case "engaged": return cat === "meeting_request" ? "qualified" : "engaged";
      case "qualified": return cat === "meeting_request" ? "negotiation" : "qualified";
      default: return null;
    }
  }
  if (cat === "not_interested" && classification.confidence >= 0.80) {
    return ["new", "first_touch_sent", "holding", "engaged"].includes(currentStatus) ? "archived" : null;
  }
  if (cat === "unsubscribe") return "blacklisted";
  if (cat === "bounce") return "archived";
  return null;
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
      // LOVABLE-93: fetch all classifications for this sender to compute touch count
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

    // LOVABLE-93: Compute relational context (lead_status + commercial metrics)
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
          lead_status: (partner as Record<string, unknown>).lead_status as string,
          touchCount,
          daysSinceLastContact,
        };
      }
    }

    // 3. Build prompt
    const userPrompt = buildClassificationPrompt(
      input,
      lastExchanges,
      conversationSummary,
      rules as Record<string, unknown> | null,
      promptInstructions,
      relationalContext,
    );

    const systemPrompt = await assemblePrompt({
      agentId: "email-classifier",
      kbCategories: ["procedures"],
      injectExcerpts: ["procedures/lead-qualification"],
    });

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
    // LOVABLE-93: Store domain classification alongside category
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
        domain: classification.domain, // LOVABLE-93: domain level classification (Livello 1)
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
      : (conversationSummary || "");

    await supabase
      .from("contact_conversation_context")
      .upsert({
        user_id: input.user_id,
        email_address: input.email_address,
        partner_id: input.partner_id || null,
        contact_id: input.contact_id || null,
        last_exchanges: updatedExchanges,
        conversation_summary: updatedSummary?.substring(0, 2000) ?? null,
        interaction_count: Number((convCtx as Record<string, unknown> | null)?.interaction_count ?? 0) + 1,
        last_interaction_at: new Date().toISOString(),
        dominant_sentiment: dominantSentiment,
        response_rate: responseRate,
        avg_response_time_hours: avgResponseTimeHours,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id,email_address" });

    // 8. Log AI decision
    // LOVABLE-93: Add domain to decision output
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
          domain: classification.domain, // LOVABLE-93: domain classification (Livello 1)
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

    // ═══ AUTO-STATUS basato su tassonomia 9 stati (via guard centralizzato) ═══
    for (const target of [
      input.partner_id ? { table: "partners" as const, id: input.partner_id } : null,
      input.contact_id ? { table: "imported_contacts" as const, id: input.contact_id } : null,
    ].filter(Boolean) as Array<{ table: "partners" | "imported_contacts"; id: string }>) {
      const { data: cur } = await supabase.from(target.table).select("lead_status").eq("id", target.id).maybeSingle();
      const currentStatus = (cur as { lead_status: string } | null)?.lead_status ?? "new";
      const nextStatus = getNextStatus(currentStatus, classification);
      if (nextStatus && nextStatus !== currentStatus) {
        const reason = nextStatus === "blacklisted"
          ? "unsubscribe"
          : nextStatus === "archived"
            ? (classification.category === "bounce" ? "bounce" : "not_interested")
            : undefined;
        await applyLeadStatusChange(supabase, {
          table: target.table,
          recordId: target.id,
          newStatus: nextStatus,
          userId: input.user_id,
          actor: { type: "system", name: "classify-email-response" },
          decisionOrigin: "ai_auto",
          trigger: `email_classified_as_${classification.category}`,
          reason,
          metadata: { email_address: input.email_address, confidence: classification.confidence, category: classification.category, sentiment: classification.sentiment },
        });
      }
    }

    // ═══ GAP 5: KB LEARNING — pattern per singolo sender ═══
    try {
      const { data: patternCheck } = await supabase
        .from("email_classifications")
        .select("id", { count: "exact" })
        .eq("user_id", input.user_id)
        .eq("email_address", input.email_address)
        .eq("category", classification.category)
        .gte("confidence", 0.75);

      const patternCount = patternCheck?.length ?? 0;

      if (patternCount >= 5 && input.email_address?.includes("@")) {
        const domain = input.email_address.split("@")[1];
        const patternTag = `email_pattern_${domain}_${classification.category}`;

        const { data: existingKB } = await supabase
          .from("kb_entries")
          .select("id")
          .eq("user_id", input.user_id)
          .contains("tags", [patternTag])
          .limit(1);

        if (!existingKB?.length) {
          const { data: recentClassifications } = await supabase
            .from("email_classifications")
            .select("ai_summary, keywords, sentiment")
            .eq("user_id", input.user_id)
            .eq("email_address", input.email_address)
            .eq("category", classification.category)
            .order("classified_at", { ascending: false })
            .limit(5);

          const summaries = recentClassifications
            ?.map((c: { ai_summary?: string }) => c.ai_summary)
            .filter(Boolean)
            .join("; ") || "";

          const keywords = [...new Set(
            recentClassifications?.flatMap((c: { keywords?: string[] }) => c.keywords || []) || []
          )].slice(0, 10);

          const dominantSentiment = recentClassifications?.[0]?.sentiment || "neutral";

          await supabase.from("kb_entries").insert({
            user_id: input.user_id,
            category: "email_management",
            chapter: "pattern_appresi",
            title: `Pattern email: ${input.email_address} → ${classification.category}`,
            content: [
              `L'indirizzo ${input.email_address} (dominio: ${domain}) invia consistentemente email di tipo "${classification.category}".`,
              `Sentiment dominante: ${dominantSentiment}.`,
              `Temi ricorrenti: ${keywords.join(", ")}.`,
              `Contesto: ${summaries.slice(0, 500)}`,
              `Questo pattern è basato su ${patternCount} classificazioni con confidence ≥ 75%.`,
              `Azione consigliata: trattare automaticamente le email da questo sender come "${classification.category}".`,
            ].join("\n"),
            tags: ["email_classification", "auto_learned", patternTag, `category_${classification.category}`, `domain_${domain}`],
            priority: 4,
            is_active: true,
          });
        }
      }

      // ═══ GAP 5: KB LEARNING — pattern per dominio ═══
      const domainForKB = input.email_address?.includes("@") ? input.email_address.split("@")[1] : null;
      if (domainForKB) {
        const { data: domainStats } = await supabase
          .from("email_classifications")
          .select("email_address, category")
          .eq("user_id", input.user_id)
          .like("email_address", `%@${domainForKB}`)
          .eq("category", classification.category)
          .gte("confidence", 0.70);

        const uniqueAddresses = new Set(domainStats?.map((d: Record<string, unknown>) => d.email_address) || []);

        if (uniqueAddresses.size >= 3) {
          const domainPatternTag = `domain_pattern_${domainForKB}_${classification.category}`;

          const { data: existingDomainKB } = await supabase
            .from("kb_entries")
            .select("id")
            .eq("user_id", input.user_id)
            .contains("tags", [domainPatternTag])
            .limit(1);

          if (!existingDomainKB?.length) {
            await supabase.from("kb_entries").insert({
              user_id: input.user_id,
              category: "email_management",
              chapter: "pattern_dominio",
              title: `Pattern dominio: @${domainForKB} → ${classification.category}`,
              content: [
                `Il dominio @${domainForKB} ha ${uniqueAddresses.size} indirizzi distinti classificati come "${classification.category}".`,
                `Indirizzi: ${[...uniqueAddresses].slice(0, 10).join(", ")}.`,
                `Consiglio: tutte le email da @${domainForKB} possono essere pre-classificate come "${classification.category}".`,
              ].join("\n"),
              tags: ["email_classification", "domain_pattern", "auto_learned", domainPatternTag, `domain_${domainForKB}`],
              priority: 5,
              is_active: true,
            });
          }
        }
      }
    } catch (kbErr) {
      console.warn("[classify] KB learning error (non-blocking):", kbErr);
    }

    // Supervisor audit (fire-and-forget)
    // LOVABLE-93: Include domain in audit metadata
    logSupervisorAudit(supabase, {
      user_id: input.user_id, actor_type: "ai_agent", actor_name: aiResult.modelUsed,
      action_category: "email_classified",
      action_detail: `Email da ${input.email_address} classificata: ${classification.domain}/${classification.category} (${Math.round(classification.confidence * 100)}%)`,
      target_type: "email",
      partner_id: input.partner_id || undefined, email_address: input.email_address,
      decision_origin: actionTaken === "auto_executed" ? "ai_auto" : "manual",
      ai_decision_log_id: decisionLogId || undefined,
      metadata: { domain: classification.domain, category: classification.category, confidence: classification.confidence, sentiment: classification.sentiment, action_suggested: classification.action_suggested },
    });

    // ═══ LOVABLE-93: Auto-suggest group for unknown senders on classification ═══
    // If the sender doesn't have a group yet, use classification + confidence to suggest one
    try {
      const { data: addressRule } = await supabase
        .from("email_address_rules")
        .select("id, group_id, ai_suggested_group, ai_suggestion_confidence")
        .eq("user_id", input.user_id)
        .eq("email_address", input.email_address)
        .maybeSingle();

      // If sender has no assigned group and no pending suggestion, OR if new classification has higher confidence
      if (addressRule) {
        const hasGroup = !!addressRule.group_id;
        const currentSuggestionConfidence = addressRule.ai_suggestion_confidence || 0;
        const shouldUpdate = !hasGroup && classification.confidence > currentSuggestionConfidence;

        if (shouldUpdate) {
          // Update with AI classification as suggested group (use category as hint)
          // This will be picked up by the suggestion engine
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

    // ═══ LOVABLE-86: Pipeline post-classificazione ═══
    // LOVABLE-93: rilevamento transizione prospect→client
    // Dopo la classificazione, il pipeline verifica segnali di conversione:
    // - Trigger: Email inbound da partner con lead_status "negotiation" o "qualified"
    // - Condition: domain="operative" AND category IN ("quote_request", "booking_request", "rate_inquiry")
    // - Action: Crea pending action "confirm_conversion" (NOT auto-executed — requires user confirmation)
    // - Rationale: Se contatto in negoziazione invia richiesta operativa, è segnale di collaborazione avviata
    //
    // SOFT SIGNAL: engaged → qualified
    // - Se partner in "engaged" riceve operativa, suggerire qualificazione
    //
    // REVERSE CASE (UPSELL):
    // - Se partner "converted" riceve operative request, è UPSELL non re-entry funnel
    let postClassResult = null;
    try {
      postClassResult = await runPostClassificationPipeline(supabase, {
        userId: input.user_id,
        partnerId: input.partner_id || null,
        contactId: input.contact_id || null,
        domain: classification.domain, // LOVABLE-93: route by domain
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
