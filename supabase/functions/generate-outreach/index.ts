import "../_shared/llmFetchInterceptor.ts";
/**
 * generate-outreach/index.ts — Orchestrator (~100 LOC).
 * Delegates to contextAssembler, promptBuilder, responseParser.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { getMaxTokensForFunction } from "../_shared/tokenLogger.ts";
import type { Quality } from "../_shared/kbSlice.ts";
import { getLanguageHint, isLikelyPersonName } from "../_shared/textUtils.ts";

import { assembleOutreachContext } from "./contextAssembler.ts";
import { buildCalligrafiaSection } from "../_shared/calligrafiaInjector.ts";
import { buildOutreachPrompts, getModel, type Channel } from "./promptBuilder.ts";
import { parseOutreachResponse } from "./responseParser.ts";
import { checkCadence } from "../_shared/cadenceEngine.ts";
import { loadOperativePrompts, type PromptScope } from "../_shared/operativePromptsLoader.ts";
import {
  runEmailContract,
  runJournalistReview,
  serializeJournalistReview,
  type PipelineChannel,
} from "../_shared/postGenerationReview.ts";

async function checkWhatsAppConsent(
  supabase: ReturnType<typeof createClient>,
  partnerId: string | null,
  userId: string,
): Promise<boolean> {
  if (!partnerId) return false;
  const { count } = await supabase
    .from("channel_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("partner_id", partnerId)
    .eq("channel", "whatsapp")
    .eq("direction", "inbound");
  return (count || 0) > 0;
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // LOVABLE-93: global pause check
    const { data: pauseSettings } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_automations_paused")
      .eq("user_id", userId)
      .maybeSingle();

    if (pauseSettings?.value === "true") {
      return new Response(JSON.stringify({ error: "AI automations are paused" }), {
        status: 503, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // ── Rate limit ──
    const rl = checkRateLimit(`generate-outreach:${userId}`, { maxTokens: 10, refillRate: 0.2 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    const {
      channel = "email", contact_name, contact_email, company_name,
      country_code = "", language, goal, base_proposal, quality: rawQuality,
      linkedin_profile, email_type_id, email_type_prompt, email_type_structure, oracle_tone,
    } = await req.json();

    const ch = (["email", "linkedin", "whatsapp", "sms"].includes(channel) ? channel : "email") as Channel;
    const quality: Quality = (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard") as Quality;

    // ── Assemble context ──
    let ctx;
    try {
      ctx = await assembleOutreachContext(supabase, userId, ch, quality, {
        company_name, contact_name, contact_email, country_code, linkedin_profile, email_type_id,
      });
    } catch (e: Record<string, unknown>) {
      if (e.code === "duplicate_branch") {
        return new Response(JSON.stringify({ error: "duplicate_branch", message: e.message, recent_contact: e.recentContact }), { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } });
      }
      throw e;
    }

    // ── Cadence check: rispettiamo i tempi e i canali? ──
    if (ch === "email" || ch === "linkedin" || ch === "whatsapp") {
      const lastContactDate = ctx.daysSinceLastContact != null && ctx.daysSinceLastContact > 0
        ? new Date(Date.now() - ctx.daysSinceLastContact * 86400000).toISOString()
        : null;

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      let touchesThisWeek = 0;
      if (ctx.partnerId) {
        const { count } = await supabase
          .from("activities")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .eq("source_id", ctx.partnerId)
          .gte("created_at", weekAgo)
          .in("status", ["completed", "pending"]);
        touchesThisWeek = count || 0;
      }

      const hasWhatsAppConsent = ch === "whatsapp"
        ? await checkWhatsAppConsent(supabase, ctx.partnerId, userId)
        : false;

      const cadenceResult = checkCadence(
        ctx.commercialState || "new",
        lastContactDate,
        null, // lastChannel non tracciato in ctx
        touchesThisWeek,
        ch,
        hasWhatsAppConsent,
      );

      if (!cadenceResult.allowed) {
        console.warn("[generate-outreach] CADENCE_VIOLATION", JSON.stringify({
          partner_id: ctx.partnerId,
          channel: ch,
          state: ctx.commercialState || "new",
          reasonCode: cadenceResult.reasonCode,
          reason: cadenceResult.reason,
          touchesThisWeek,
        }));
        return new Response(
          JSON.stringify({
            error: "cadence_violation",
            reasonCode: cadenceResult.reasonCode,
            message: cadenceResult.reason,
            suggestedChannel: cadenceResult.suggestedChannel,
            nextAllowedDate: cadenceResult.nextAllowedDate,
          }),
          { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }

      // Suggerimento alternanza canali → warning informativo, non blocco
      if (cadenceResult.suggestedChannel && cadenceResult.suggestedChannel !== ch) {
        (ctx as Record<string, unknown>).cadenceWarning =
          `SUGGERIMENTO CADENZA: considera ${cadenceResult.suggestedChannel} invece di ${ch} (alternanza canali).`;
      }
    }

    // ── Decision Object (Fix 3.1: usa relationship_stage REALE) ──
    const detected = getLanguageHint(country_code);
    const effectiveLanguage = language || detected.language;
    const stage = ctx.relationshipStage; // cold | warm | active | stale | ghosted
    const isAdvanced = stage === "warm" || stage === "active";
    const isStaleOrGhosted = stage === "stale" || stage === "ghosted";
    const decision = {
      email_type: email_type_id || (stage === "cold" ? "primo_contatto" : isStaleOrGhosted ? "reattivazione" : "follow_up"),
      // Single source of truth: stage da analyzeRelationshipHistory (NO doppia verità da count)
      relationship_stage: stage,
      relationship_detail: {
        stage,
        response_rate: ctx.relationshipMetrics.response_rate,
        unanswered_streak: ctx.relationshipMetrics.unanswered_count,
        days_since_last_contact: ctx.relationshipMetrics.days_since_last_contact,
        commercial_state: ctx.relationshipMetrics.commercial_state,
        total_interactions: ctx.relationshipMetrics.total_interactions,
      },
      language: effectiveLanguage,
      tone: oracle_tone || (isStaleOrGhosted ? "cordiale_non_insistente" : "professionale"),
      hook_strategy: ctx.intelligence.data_found.networks ? "shared_network" : ctx.intelligence.data_found.partner ? "company_reference" : "sector_relevance",
      cta_type: stage === "cold" ? "light_interest_probe" : isAdvanced ? "direct_action" : isStaleOrGhosted ? "soft_reopen" : "micro_commitment",
      forbidden_elements: [
        "overclaiming",
        "multi_cta",
        ...(stage === "cold" ? ["price", "discount"] : []),
        ...(isStaleOrGhosted ? ["pressure", "urgency_fake"] : []),
      ],
      max_length_lines: ch === "email" ? 12 : ch === "linkedin" ? 6 : 4,
      persuasion_pattern: email_type_id === "follow_up" ? "strategic_no" : email_type_id === "partnership" ? "loss_aversion" : isStaleOrGhosted ? "pattern_interrupt" : "label_technique",
    };

    // ── Readiness ──
    const readiness = {
      sender: [ctx.settings.ai_contact_alias || ctx.settings.ai_contact_name ? 25 : 0, ctx.settings.ai_company_alias || ctx.settings.ai_company_name ? 25 : 0, ctx.settings.ai_knowledge_base ? 25 : 0, ctx.settings.ai_contact_role ? 15 : 0, ctx.settings.ai_email_signature ? 10 : 0].reduce((a, b) => a + b, 0),
      recipient: [ctx.intelligence.data_found.partner ? 30 : 0, ctx.intelligence.data_found.contacts ? 15 : 0, ctx.intelligence.data_found.networks ? 20 : 0, ctx.intelligence.data_found.interactions ? 20 : 0, (ctx.intelligence.data_found.linkedin || ctx.intelligence.data_found.linkedin_live) ? 15 : 0].reduce((a, b) => a + b, 0),
      kb: ctx.salesKBSlice ? Math.min(100, ctx.salesKBSections.length * 15) : 0,
      scenario: [email_type_id ? 40 : 0, goal ? 30 : 0, base_proposal ? 30 : 0].reduce((a, b) => a + b, 0),
    };
    const readinessTotal = Math.round((readiness.sender + readiness.recipient + readiness.kb + readiness.scenario) / 4);
    const readinessWarnings: string[] = [];
    if (readiness.sender < 50) readinessWarnings.push("Profilo mittente incompleto: configura alias, azienda e ruolo in Impostazioni AI");
    if (readiness.recipient < 30) readinessWarnings.push("Pochi dati sul destinatario: arricchisci il partner con LinkedIn, network o note");
    if (readiness.kb < 30) readinessWarnings.push("Knowledge Base vuota o insufficiente: aggiungi entries in KB per risultati migliori");
    if (readiness.scenario < 40) readinessWarnings.push("Scenario generico: specifica tipo email, goal e proposta per email più mirate");

    // ── LOVABLE-93: Decision Engine — evaluate before generation ──
    let decisionEngineBlock = "";
    if (ctx.partnerId) {
      try {
        const { evaluatePartner } = await import("../_shared/decisionEngine.ts");
        const { state: pState, actions } = await evaluatePartner(supabase, ctx.partnerId, userId);
        const topAction = actions[0];
        if (topAction && topAction.action !== "no_action") {
          const journalistHint = topAction.journalist_role
            ? `\n- Giornalista suggerito: ${topAction.journalist_role}`
            : "";
          decisionEngineBlock = `
DECISION ENGINE (raccomandazione automatica):
- Azione: ${topAction.action} (priorità: ${topAction.priority}/5, autonomia: ${topAction.autonomy})
- Motivo: ${topAction.reasoning}
- Stato: ${pState.touchCount} touch, ${pState.daysSinceLastOutbound}gg dall'ultimo invio${journalistHint}`;
        }
      } catch (decErr) {
        console.warn("[generate-outreach] Decision Engine failed (non-blocking):", decErr);
      }
    }

    // ── Build prompts ──
    let recipientName = "";
    if (contact_name && isLikelyPersonName(contact_name)) recipientName = contact_name;

    const { systemPrompt, userPrompt } = buildOutreachPrompts({
      channel: ch, quality, contact_name, contact_email, company_name, country_code,
      language, goal, base_proposal, oracle_tone, email_type_id, email_type_prompt, email_type_structure,
      settings: ctx.settings,
      enrichmentSnippet: ctx.intelligence.enrichment_snippet,
      interlocutorBlock: ctx.interlocutorBlock, relationshipBlock: ctx.relationshipBlock,
      branchBlock: ctx.branchBlock, metInPersonContext: ctx.metInPersonContext,
      conversationIntelligenceContext: ctx.conversationIntelligenceContext,
      salesKBSlice: ctx.salesKBSlice, salesKBSections: ctx.salesKBSections,
      commercialLevers: ctx.settings.ai_commercial_levers || "",
      decision, readinessTotal,
      commercialState: ctx.commercialState,
      touchCount: ctx.touchCount,
      daysSinceLastContact: ctx.daysSinceLastContact,
      // Fix 3.2 + 3.3
      playbookBlock: ctx.playbookBlock,
      channelDeclaration: ctx.channelDeclaration,
      // LOVABLE-93: Decision Engine context
      decisionEngineBlock,
    });

    // ── Prompt Lab injection (UNIFIED loader) ──
    // Map channel → scope so the WhatsApp Message Gate, LinkedIn limits and
    // multi-channel sequence rules from the Prompt Lab actually reach this
    // generator (previously hardcoded prompt only).
    const promptScope: PromptScope =
      ch === "whatsapp" ? "whatsapp" :
      ch === "linkedin" ? "linkedin" :
      ch === "email" ? "outreach" : "outreach";
    const promptLab = await loadOperativePrompts(supabase, userId, {
      scope: promptScope,
      channel: ch,
      includeUniversal: true,
      limit: 6,
    });
    const baseFinalSystemPrompt = promptLab.block
      ? `${promptLab.block}\n\n${systemPrompt}`
      : systemPrompt;
    // ── Calligrafia (regole di formattazione email — SSOT KB "calligrafia") ──
    // Iniettata solo per il canale email; per WhatsApp/LinkedIn la formattazione
    // è governata da prompt operativi specifici (no HTML).
    const calligrafiaSection = ch === "email"
      ? await buildCalligrafiaSection(supabase, userId)
      : "";
    const finalSystemPrompt = `${baseFinalSystemPrompt}${calligrafiaSection ? "\n" + calligrafiaSection : ""}`;

    // ── AI call ──
    const model = getModel(quality);
    const maxTokens = await getMaxTokensForFunction(supabase, userId, "ai_max_tokens_generate_outreach", 1200);
    const result = await aiChat({
      models: [model, "openai/gpt-5-mini"],
      messages: [{ role: "system", content: finalSystemPrompt }, { role: "user", content: userPrompt }],
      timeoutMs: 40000, maxRetries: 1, max_tokens: maxTokens, context: `generate-outreach:${userId.substring(0, 8)}:${ch}/${quality}`,
    });

    // ── Credits ──
    const totalCredits = Math.max(1, Math.ceil((result.usage.promptTokens + result.usage.completionTokens * 2) / 1000));
    await supabase.rpc("deduct_credits", { p_user_id: userId, p_amount: totalCredits, p_operation: "ai_call", p_description: `generate-outreach (${ch}/${quality}): ${result.usage.promptTokens}in + ${result.usage.completionTokens}out` });

    // ── Parse ──
    const { subject, body } = parseOutreachResponse(result.content || "", ch, ctx.settings);

    const kbSource = ctx.salesKBSlice ? "kb_entries" : (ctx.settings.ai_sales_knowledge_base ? "legacy_monolithic_deprecated" : "none");
    const senderAlias = ctx.settings.ai_contact_alias || ctx.settings.ai_contact_name || "";
    const senderCompanyAlias = ctx.settings.ai_company_alias || ctx.settings.ai_company_name || "";

    return new Response(JSON.stringify({
      channel: ch, subject, body, full_content: result.content || "",
      contact_name: recipientName || contact_name || null,
      contact_email: contact_email || null, company_name: company_name || null,
      language: effectiveLanguage, quality, model,
      readiness_score: readinessTotal, readiness_warnings: readinessWarnings,
      _debug: {
        model, quality, language_detected: detected.languageLabel, language_used: effectiveLanguage,
        country_code: country_code || "N/A", recipient_name_resolved: recipientName || "(generico)",
        sender_alias: senderAlias || "(non configurato)", sender_company: senderCompanyAlias || "(non configurato)",
        sender_role: ctx.settings.ai_contact_role || "(non configurato)",
        kb_loaded: !!ctx.settings.ai_knowledge_base, sales_kb_loaded: !!ctx.salesKBSlice, kb_source: kbSource,
        sales_kb_sections: ctx.salesKBSections.join(", ") || (quality === "premium" ? "tutte" : quality === "fast" ? "1,5" : "1-8"),
        goal_used: goal || "(default)", proposal_used: base_proposal || "(default)",
        tokens_input: result.usage.promptTokens, tokens_output: result.usage.completionTokens,
        credits_consumed: totalCredits, model_used: result.modelUsed, ai_attempts: result.attempts,
        channel_instructions: ch.toUpperCase(), settings_keys_found: Object.keys(ctx.settings),
        recipient_intelligence: ctx.intelligence, interaction_history_count: ctx.interactionHistoryCount,
        website_source: ctx.websiteSource, linkedin_source: ctx.linkedinSource,
        decision_object: decision, readiness, readiness_total: readinessTotal, readiness_warnings: readinessWarnings,
        relationship_stage: ctx.relationshipStage,
        relationship_metrics: ctx.relationshipMetrics,
        playbook_active: ctx.playbookActive,
        channel_declaration: ctx.channelDeclaration,
      },
    }), { headers: { ...dynCors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("generate-outreach error:", e);
    return mapErrorToResponse(e, dynCors);
  }
});
