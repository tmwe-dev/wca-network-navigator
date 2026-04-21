/**
 * generate-email/index.ts — Orchestrator (~120 LOC).
 * Delegates to contextAssembler, promptBuilder, responseParser.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { logSupervisorAudit } from "../_shared/supervisorAudit.ts";
import type { Quality } from "../_shared/kbSlice.ts";

import { loadEntityFromActivity, loadStandalonePartner, assembleContextBlocks } from "./contextAssembler.ts";
import { buildEmailPrompts, getModel, type PartnerData, type ContactData } from "./promptBuilder.ts";
import { parseEmailResponse } from "./responseParser.ts";
import { journalistReview } from "../_shared/journalistReviewLayer.ts";
import { loadOptimusSettings } from "../_shared/journalistSelector.ts";
import type { JournalistReviewOutput } from "../_shared/journalistTypes.ts";
import { buildEmailContract, validateEmailContract, type ResolvedEmailType } from "../_shared/emailContract.ts";
import { detectEmailType } from "../_shared/emailTypeDetector.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const metrics = startMetrics("generate-email");
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

    // ── Rate limit ──
    const rl = checkRateLimit(`generate-email:${userId}`, { maxTokens: 10, refillRate: 0.2 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    const { activity_id, goal, base_proposal, language, document_ids, quality: rawQuality, oracle_type, oracle_tone, use_kb, deep_search, standalone, partner_id, _recipient_count, recipient_countries, recipient_name, recipient_company, email_type_prompt, email_type_structure, email_type_kb_categories, _debug_return_prompt, _system_prompt_override, _user_prompt_override } = await req.json();
    const quality: Quality = (["fast", "standard", "premium"].includes(rawQuality) ? rawQuality : "standard") as Quality;

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // ── Load entity (partner + contact) ──
    let partner: PartnerData | null = null;
    let contact: ContactData | null = null;
    let contactEmail: string | null = null;
    let sourceType = "partner";

    if (standalone && partner_id) {
      const loaded = await loadStandalonePartner(supabase, partner_id, recipient_name);
      partner = loaded.partner; contact = loaded.contact; contactEmail = loaded.contactEmail; sourceType = loaded.sourceType;
      if (!partner) {
        partner = { id: partner_id, company_name: recipient_company || "Destinatario", company_alias: recipient_company || null, country_code: "IT", country_name: recipient_countries || "", city: "", email: null, phone: null, website: null, profile_description: null, rating: null, raw_profile_markdown: null };
        sourceType = "standalone";
      }
    } else if (standalone) {
      const firstCountry = (recipient_countries || "").split(/[,;\s]+/).find((s: string) => s.trim().length === 2) || "IT";
      partner = { id: null, company_name: recipient_company || "Destinatario generico", company_alias: recipient_company || null, country_code: firstCountry.toUpperCase().trim(), country_name: recipient_countries || "Vari", city: "", email: null, phone: null, website: null, profile_description: null, rating: null, raw_profile_markdown: null };
      contact = recipient_name ? { id: "", name: recipient_name, contact_alias: recipient_name, title: null, email: null, direct_phone: null, mobile: null } : null;
      contactEmail = "destinatario@email.com";
      sourceType = "standalone";
    } else {
      if (!activity_id) throw new Error("activity_id is required");
      const loaded = await loadEntityFromActivity(supabase, activity_id);
      partner = loaded.partner; contact = loaded.contact; contactEmail = loaded.contactEmail; sourceType = loaded.sourceType;
      if (!partner) throw new Error("Source entity not found");
    }

    // ── Validations ──
    if (!standalone && sourceType === "partner" && !contact) {
      return new Response(JSON.stringify({ error: "no_contact", message: "Nessun contatto selezionato. Seleziona un contatto prima di generare l'email.", partner_name: partner!.company_name }), { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } });
    }
    if (!standalone && !contactEmail) {
      return new Response(JSON.stringify({ error: "no_email", message: "Nessun indirizzo email disponibile per questo contatto/partner", partner_name: partner!.company_name, contact_name: contact?.name || null }), { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    // ── LOVABLE-81/82: Costruisci contratto + detector tipo (non bloccante per standalone) ──
    let typeResolution: ResolvedEmailType | null = null;
    const contractWarnings: string[] = [];
    if (!standalone && partner?.id) {
      try {
        const { contract, build_warnings } = await buildEmailContract(supabase, userId, {
          engine: "generate-email",
          operation: "generate",
          partnerId: partner.id,
          contactId: contact?.id ?? null,
          emailType: oracle_type || "primo_contatto",
          emailDescription: goal || base_proposal || "",
          objective: goal || undefined,
          language,
          fallbackPartnerName: partner.company_name,
          fallbackContactEmail: contactEmail || undefined,
        });
        const validation = validateEmailContract(contract);
        contractWarnings.push(...build_warnings, ...validation.warnings);
        if (!validation.valid) {
          // Errori bloccanti del contratto (es. blacklisted) → 422 esplicito
          return new Response(
            JSON.stringify({
              success: false,
              error: "CONTRACT_INVALID",
              errors: validation.errors,
              warnings: validation.warnings,
            }),
            { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } },
          );
        }
        // Detector tipo/descrizione/history/stato
        typeResolution = detectEmailType(contract);
        if (!typeResolution.proceed) {
          return new Response(
            JSON.stringify({
              success: false,
              error: "TYPE_CONFLICT",
              type_resolution: typeResolution,
              message: `Tipo "${typeResolution.original_type}" non coerente con stato/history. ${typeResolution.conflicts
                .filter((c) => c.severity === "blocking")
                .map((c) => c.suggestion)
                .join(". ")}`,
            }),
            { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } },
          );
        }
      } catch (cerr) {
        console.warn("[generate-email] contract/detector failed (non-blocking):", cerr instanceof Error ? cerr.message : cerr);
      }
    }

    // ── Assemble context ──
    let ctx;
    try {
      ctx = await assembleContextBlocks(supabase, userId, partner!, contact, contactEmail, sourceType, quality, !!standalone, { oracle_type, use_kb, document_ids, partner_id, deep_search, authHeader, email_type_kb_categories });
    } catch (e: Record<string, unknown>) {
      if (e.code === "duplicate_branch") {
        return new Response(JSON.stringify({ error: "duplicate_branch", message: e.message, recent_contact: e.recentContact }), { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } });
      }
      throw e;
    }

    // ── LOVABLE-93: Decision Engine — evaluate before generation ──
    let decisionContext: Record<string, unknown> | undefined;
    if (!standalone && partner?.id) {
      try {
        const { evaluatePartner } = await import("../_shared/decisionEngine.ts");
        const { state: pState, actions } = await evaluatePartner(supabase, partner.id, userId);
        const topAction = actions[0];
        if (topAction && topAction.action !== "no_action") {
          decisionContext = {
            action: topAction.action,
            autonomy: topAction.autonomy,
            channel: topAction.channel,
            journalist_role: topAction.journalist_role,
            reasoning: topAction.reasoning,
            priority: topAction.priority,
            state: {
              leadStatus: pState.leadStatus,
              touchCount: pState.touchCount,
              daysSinceLastOutbound: pState.daysSinceLastOutbound,
              enrichmentScore: pState.enrichmentScore,
            },
          };
        }
      } catch (decErr) {
        console.warn("[generate-email] Decision Engine evaluation failed (non-blocking):", decErr);
      }
    }

    // ── Build prompts ──
    const built = buildEmailPrompts({
      partner: partner!, contact, contactEmail, sourceType, quality, language,
      goal, base_proposal, oracle_type, oracle_tone, use_kb,
      email_type_prompt, email_type_structure,
      decisionContext: decisionContext as never,
      ...ctx,
    });
    // Prompt-Lab overrides: replace system/user prompt entirely if provided
    const systemPrompt = (typeof _system_prompt_override === "string" && _system_prompt_override.trim().length > 0)
      ? _system_prompt_override : built.systemPrompt;
    const userPrompt = (typeof _user_prompt_override === "string" && _user_prompt_override.trim().length > 0)
      ? _user_prompt_override : built.userPrompt;
    const blocks = built.blocks;
    const systemBlocks = built.systemBlocks;
    const promptOverridden = systemPrompt !== built.systemPrompt || userPrompt !== built.userPrompt;

    // ── AI call ──
    const model = getModel(quality);
    const aiStart = Date.now();
    const result = await aiChat({
      models: [model, "google/gemini-2.5-flash", "openai/gpt-5-mini"],
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      timeoutMs: 45000, maxRetries: 1, context: "generate-email:" + userId.substring(0, 8),
    });
    const aiLatencyMs = Date.now() - aiStart;

    // ── Parse response ──
    const { subject, body } = parseEmailResponse(result.content || "", ctx.signatureBlock);

    // ── GIORNALISTA AI — Caporedattore Finale (LOVABLE-80 v2) ──
    let finalSubject = subject;
    let finalBody = body;
    let journalistResult: JournalistReviewOutput | null = null;
    try {
      const optimus = await loadOptimusSettings(supabase, userId);
      if (optimus.enabled && finalBody) {
        // LOVABLE-93: Detect reply context
        const isReplyContext =
          (oracle_type && (oracle_type.includes("reply") || oracle_type.includes("risposta"))) ||
          !!ctx.historyContext ||
          (typeResolution?.resolved_type && ["follow_up", "reply"].includes(typeResolution.resolved_type as string));

        journalistResult = await journalistReview(supabase, userId, {
          final_draft: finalBody,
          resolved_brief: {
            email_type: oracle_type ?? undefined,
            objective: goal ?? undefined,
            playbook_active: ctx.playbookActive ? "yes" : undefined,
          },
          channel: "email",
          commercial_state: {
            lead_status: (ctx.commercialState as string) || (partner as { lead_status?: string } | null)?.lead_status || "new",
            touch_count: ctx.touchCount ?? 0,
            last_outcome: ctx.lastOutcome ?? undefined,
            days_since_last_inbound: ctx.daysSinceLastContact ?? undefined,
            has_active_conversation: !!ctx.historyContext,
            decision_engine: decisionContext || undefined,
          },
          partner: {
            id: partner?.id ?? null,
            company_name: partner?.company_name,
            country: partner?.country_name,
          },
          contact: contact ? { name: contact.name, role: contact.title } : undefined,
          history_summary: ctx.historyContext || undefined,
          kb_summary: (ctx.salesKBSections || []).join(", ") || undefined,
          is_reply: isReplyContext,
          original_inbound: isReplyContext ? {
            subject: ctx.historyContext?.split("\n")[0],
            summary: ctx.historyContext,
            classification: typeResolution?.original_type,
          } : undefined,
        }, { mode: optimus.mode, strictness: optimus.strictness });
        if (journalistResult.verdict !== "block" && journalistResult.edited_text) {
          finalBody = journalistResult.edited_text;
        }
      }
    } catch (jerr) {
      console.error("[generate-email] journalistReview failed:", jerr);
    }

    // ── Credits (AFTER journalist review) ──
    // Deduct credits based on journalist verdict:
    // - If journalist blocks the email (verdict === "block"), deduct 50% credits: the AI call happened and resources were used,
    //   but the output was not usable/publishable, so the user doesn't get full value.
    // - Otherwise, deduct full credits: the email was approved or allowed to proceed.
    if (result.usage) {
      let creditsToDeduct = Math.max(1, Math.ceil((result.usage.promptTokens + result.usage.completionTokens * 2) / 1000));
      if (journalistResult?.verdict === "block") {
        creditsToDeduct = Math.ceil(creditsToDeduct * 0.5);
      }
      await supabase.rpc("deduct_credits", { p_user_id: userId, p_amount: creditsToDeduct, p_operation: "ai_call", p_description: `generate-email (${quality}): ${result.usage.promptTokens} in + ${result.usage.completionTokens} out${journalistResult?.verdict === "block" ? " [50% blocked by journalist]" : ""}` });
    }

    // Supervisor audit (fire-and-forget)
    logSupervisorAudit(supabase, {
      user_id: userId, actor_type: "ai_agent", actor_name: model,
      action_category: "email_drafted",
      action_detail: `Bozza email generata per ${contactEmail}: ${finalSubject}`,
      target_type: "email", target_label: finalSubject,
      partner_id: partner?.id || undefined, email_address: contactEmail || undefined,
      decision_origin: "ai_auto",
      metadata: { model, quality, tokens: result.usage?.promptTokens, journalist_verdict: journalistResult?.verdict ?? null },
    });

    metrics.userId = userId;
    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({
      subject: finalSubject, body: finalBody, full_content: result.content || "",
      partner_name: partner!.company_name,
      contact_name: contact?.contact_alias || contact?.name || null,
      contact_email: contactEmail, has_contact: !!contact,
      used_partner_email: !contact?.email && !!partner!.email, quality, model,
      journalist_review: journalistResult ? {
        journalist: journalistResult.journalist,
        verdict: journalistResult.verdict,
        warnings: journalistResult.warnings,
        edits: journalistResult.edits,
        quality_score: journalistResult.quality_score,
        reasoning: journalistResult.reasoning_summary,
      } : null,
      _context_summary: {
        kb_sections: ctx.salesKBSections || [],
        history_present: !!ctx.historyContext,
        touch_count: ctx.touchCount ?? 0,
        days_since_last_contact: ctx.daysSinceLastContact ?? null,
        warmth_score: ctx.warmthScore ?? null,
        commercial_state: ctx.commercialState ?? null,
        last_channel: ctx.lastChannel ?? null,
        last_outcome: ctx.lastOutcome ?? null,
        deep_search_status: ctx.deepSearchStatus ?? "missing",
        deep_search_age_days: ctx.deepSearchAgeDays ?? null,
        playbook_active: ctx.playbookActive ?? false,
        met_in_person: !!ctx.metInPersonContext,
        documents_count: (document_ids?.length ?? 0),
        sender_settings_ok: !!(ctx.settings.ai_contact_alias || ctx.settings.ai_contact_name),
        oracle_type: oracle_type ?? null,
      },
      // LOVABLE-75: segnale al frontend che NON ci sono dati di arricchimento per questo partner.
      // Il backend non chiama mai più enrich-partner-website live: arricchimento si fa da Settings o Email Forge.
      enrichment_missing: ctx.deepSearchStatus === "missing",
      contract_used: true,
      contract_warnings: contractWarnings,
      type_resolution: typeResolution,
      ...(_debug_return_prompt ? {
        _debug: {
          systemPrompt,
          userPrompt,
          systemBlocks,
          blocks,
          model,
          quality,
          ai_latency_ms: aiLatencyMs,
          tokens_in: result.usage?.promptTokens ?? null,
          tokens_out: result.usage?.completionTokens ?? null,
          prompt_overridden: promptOverridden,
        },
      } : {}),
    }), { headers: { ...dynCors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    logEdgeError("generate-email", e);
    endMetrics(metrics, false, 500);
    console.error("generate-email error:", e);
    return mapErrorToResponse(e, getCorsHeaders(req.headers.get("origin")));
  }
});
