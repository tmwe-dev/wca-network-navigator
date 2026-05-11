import "../_shared/llmFetchInterceptor.ts";
/**
 * classify-inbound-message — Universal inbound message classifier (email, whatsapp, linkedin).
 * Invoked by pg_net from on_inbound_message trigger.
 *
 * Sprint 2: orchestrator decomposto in stage modules sub-200 LOC.
 * Tutti gli stage sono fail-safe e mantengono comportamento identico al monolite.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { checkInjectionGuard } from "../_shared/injectionGuard.ts";
import { resolveCaller, assertMessageOwned } from "../_shared/ownership.ts";
import { makeRecordStage, type RequestBody } from "./stages/types.ts";
import { runAiClassification, persistClassificationSideEffects } from "./stages/stageClassifyAi.ts";
import { runEmailProcessManager, runFunnemailDispatcher } from "./stages/stagePostClassification.ts";
import { runFunnemailScoutAndClassify, runFunnemailAutoRoute, runFunnemailPolicyPipeline } from "./stages/stageFunnemailPipeline.ts";
import { runContentClassification, refreshConversationContext, runTriageAndAlert } from "./stages/stageContentAndContext.ts";
import { createTracer } from "../_shared/pipelineTrace.ts";

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const corsH = getCorsHeaders(origin);
  const headers = getSecurityHeaders(corsH);
  const metrics = startMetrics("classify-inbound-message");

  try {
    // ── Auth + ownership ──
    // Accepts: user JWT (UI) OR service-role (trigger pg_net). Anon-key rejected.
    const corsHeadersOnly = corsH;
    const caller = await resolveCaller(req, corsHeadersOnly);
    if (caller instanceof Response) {
      endMetrics(metrics, false, caller.status);
      return caller;
    }
    const body: RequestBody = (caller.bodyJson ?? {}) as RequestBody;
    const { message_id, channel, body_text, from_address, subject } = body;

    // For user-JWT callers: force user_id = JWT sub and verify message ownership.
    // For service-role (trigger): trust body.user_id (set by DB trigger from owning row).
    if (!caller.isService) {
      body.user_id = caller.userId;
      if (message_id) {
        const ownErr = await assertMessageOwned(
          // use a service client so RLS doesn't block the lookup
          createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { auth: { persistSession: false } },
          ),
          message_id,
          caller.userId,
          corsHeadersOnly,
        );
        if (ownErr) {
          endMetrics(metrics, false, ownErr.status);
          return ownErr;
        }
      }
    }

    if (!message_id) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "Missing message_id" }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // ── Job ledger (Sprint 1 Funnemail) ──
    const recordStage = makeRecordStage(supabase, message_id, body.user_id ?? null);
    if (channel === "email") void recordStage("received", { channel, from_address });

    // ── Pipeline trace (fail-safe, non blocca mai) ──
    // trace_id = message_id per correlare deterministicamente tutti gli step su un singolo messaggio.
    const tracer = createTracer(supabase, {
      traceId: message_id,
      entityType: channel === "email" ? "email" : channel === "whatsapp" ? "whatsapp" : "linkedin",
      entityId: message_id,
      entityLabel: subject || from_address || null,
      operatorId: body.user_id ?? null,
    });
    void tracer.step("classify_inbound:received", { input: { from_address, subject, channel }, status: "started" });

    // ── Idempotency guard ──
    // Il messaggio può essere classificato sia dal trigger DB on_inbound_message
    // sia dal fallback check-inbox/postProcessing. Se esiste già una riga
    // reply_classifications per questo message_id, ritorniamo senza ri-eseguire
    // AI/postClassificationPipeline/funnemail (evita doppi side-effect).
    {
      const { data: existingClass } = await supabase
        .from("reply_classifications")
        .select("id")
        .eq("message_id", message_id)
        .maybeSingle();
      if (existingClass) {
        endMetrics(metrics, true, 200);
        return new Response(
          JSON.stringify({ success: true, deduped: true, message_id }),
          { status: 200, headers },
        );
      }
    }

    // ── Anti-Prompt-Injection Guard ──
    if (body.user_id) {
      const reviewToken = req.headers.get("x-injection-review-id");
      const guard = await checkInjectionGuard(supabase, {
        userId: body.user_id,
        source: channel === "whatsapp" ? "whatsapp-message"
          : channel === "linkedin" ? "linkedin-message"
          : "email-inbound",
        functionName: "classify-inbound-message",
        text: `${subject || ""}\n\n${body_text || ""}`,
        reviewToken,
        metadata: { message_id, activity_id: body.activity_id, channel, from_address },
      });
      if (guard.needsConfirmation) {
        endMetrics(metrics, true, 409);
        return new Response(
          JSON.stringify({
            error: "prompt_injection_review_required",
            review_id: guard.reviewId,
            findings: guard.findings,
            message_id,
            hint: "Approva la review via POST /confirm-injection-review e ritrasmetti la richiesta con header x-injection-review-id.",
          }),
          { status: 409, headers },
        );
      }
    }

    // ── Stage 1: AI Classification (LLM + side-effects sincroni) ──
    const t1 = Date.now();
    const { result, model } = await runAiClassification(supabase, body);
    void tracer.step("classify_inbound:ai", {
      output: { classification: result.classification, confidence: result.confidence, sentiment: result.sentiment, urgency: result.urgency },
      aiModel: model, aiScope: "classification", durationMs: Date.now() - t1, status: "success",
    });
    await persistClassificationSideEffects(supabase, body, result, model);

    // ── Stage 2: Post-classification (PM + Funnemail dispatcher) ──
    const t2 = Date.now();
    const postClassResult = await runEmailProcessManager(supabase, body, result);
    const funnemailResult = await runFunnemailDispatcher(supabase, body, result);
    void tracer.step("classify_inbound:post_classification", {
      output: { post_class: !!postClassResult, funnemail_dispatched: !!funnemailResult },
      durationMs: Date.now() - t2, status: "success",
    });

    // ── Stage 3: Funnemail pipeline (scout → classify → auto-route). Fire-and-forget. ──
    const t3 = Date.now();
    await runFunnemailScoutAndClassify(supabase, body, result, recordStage);
    await runFunnemailAutoRoute(supabase, body, recordStage);
    await runFunnemailPolicyPipeline(supabase, body, recordStage);
    void tracer.step("classify_inbound:funnemail_pipeline", { durationMs: Date.now() - t3, status: "success" });

    // ── Stage 4: Strato 2 (content) + refresh + triage. Fire-and-forget. ──
    const t4 = Date.now();
    await runContentClassification(supabase, body);
    await refreshConversationContext(supabase, body);
    await runTriageAndAlert(supabase, body);
    void tracer.step("classify_inbound:content_and_triage", { durationMs: Date.now() - t4, status: "success" });

    endMetrics(metrics, true, 200);
    if (channel === "email") void recordStage("completed", { post_classification: !!postClassResult, funnemail: !!funnemailResult });
    return new Response(JSON.stringify({
      success: true,
      classification: result.classification,
      confidence: result.confidence,
      sentiment: result.sentiment,
      urgency: result.urgency,
      channel,
      post_classification: postClassResult,
      funnemail: funnemailResult,
    }), { status: 200, headers });

  } catch (error: unknown) {
    logEdgeError("classify-inbound-message", error);
    endMetrics(metrics, false, 500);
    const message = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers });
  }
});
