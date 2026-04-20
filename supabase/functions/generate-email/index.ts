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

    const { activity_id, goal, base_proposal, language, document_ids, quality: rawQuality, oracle_type, oracle_tone, use_kb, deep_search, standalone, partner_id, _recipient_count, recipient_countries, recipient_name, recipient_company, email_type_prompt, email_type_structure, email_type_kb_categories } = await req.json();
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

    // ── Assemble context ──
    let ctx;
    try {
      ctx = await assembleContextBlocks(supabase, userId, partner!, contact, contactEmail, sourceType, quality, !!standalone, { oracle_type, use_kb, document_ids, partner_id, deep_search, authHeader });
    } catch (e: Record<string, unknown>) {
      if (e.code === "duplicate_branch") {
        return new Response(JSON.stringify({ error: "duplicate_branch", message: e.message, recent_contact: e.recentContact }), { status: 422, headers: { ...dynCors, "Content-Type": "application/json" } });
      }
      throw e;
    }

    // ── Build prompts ──
    const { systemPrompt, userPrompt } = buildEmailPrompts({
      partner: partner!, contact, contactEmail, sourceType, quality, language,
      goal, base_proposal, oracle_type, oracle_tone, use_kb,
      ...ctx,
    });

    // ── AI call ──
    const model = getModel(quality);
    const result = await aiChat({
      models: [model, "google/gemini-2.5-flash", "openai/gpt-5-mini"],
      messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
      timeoutMs: 45000, maxRetries: 1, context: "generate-email:" + userId.substring(0, 8),
    });

    // ── Credits ──
    if (result.usage) {
      const totalCredits = Math.max(1, Math.ceil((result.usage.promptTokens + result.usage.completionTokens * 2) / 1000));
      await supabase.rpc("deduct_credits", { p_user_id: userId, p_amount: totalCredits, p_operation: "ai_call", p_description: `generate-email (${quality}): ${result.usage.promptTokens} in + ${result.usage.completionTokens} out` });
    }

    // ── Parse response ──
    const { subject, body } = parseEmailResponse(result.content || "", ctx.signatureBlock);

    // Supervisor audit (fire-and-forget)
    logSupervisorAudit(supabase, {
      user_id: userId, actor_type: "ai_agent", actor_name: model,
      action_category: "email_drafted",
      action_detail: `Bozza email generata per ${contactEmail}: ${subject}`,
      target_type: "email", target_label: subject,
      partner_id: partner?.id || undefined, email_address: contactEmail || undefined,
      decision_origin: "ai_auto",
      metadata: { model, quality, tokens: result.usage?.promptTokens },
    });

    metrics.userId = userId;
    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({
      subject, body, full_content: result.content || "",
      partner_name: partner!.company_name,
      contact_name: contact?.contact_alias || contact?.name || null,
      contact_email: contactEmail, has_contact: !!contact,
      used_partner_email: !contact?.email && !!partner!.email, quality, model,
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
    }), { headers: { ...dynCors, "Content-Type": "application/json" } });
  } catch (e: unknown) {
    logEdgeError("generate-email", e);
    endMetrics(metrics, false, 500);
    console.error("generate-email error:", e);
    return mapErrorToResponse(e, getCorsHeaders(req.headers.get("origin")));
  }
});
