import "../_shared/llmFetchInterceptor.ts";
/**
 * ai-assistant/index.ts — Main orchestrator
 * Coordinates: auth → mode dispatch → context assembly → AI calls → tool loops → response
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createServiceClient, createUserClient } from "../_shared/supabaseClient.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { edgeError, extractErrorMessage } from "../_shared/handleEdgeError.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { createReadHandlers } from "../_shared/toolHandlersRead.ts";
import { createWriteHandlers } from "../_shared/toolHandlersWrite.ts";
import { createEnterpriseHandlers } from "../_shared/toolHandlersEnterprise.ts";

import { resolveAiProvider, consumeCredits, compressMessages } from "./contextLoader.ts";
import { TOOL_DEFINITIONS } from "./toolDefinitions.ts";
import type { ToolExecutorDeps } from "./toolExecutors.ts";

import { detectRepetitions } from "./repetitionDetection.ts";
import { handleToolDecisionMode, handlePlanExecutionMode } from "./modeHandlers.ts";
import { assembleSystemPrompt } from "./contextAssembly.ts";
import { composeSystemPrompt } from "./systemPrompt.ts";
import { callAiWithFallback, callAiForToolLoop, callAiWithoutTools } from "./aiCallHandler.ts";
import { executeToolLoop, type ToolLoopState, type ToolLoopResult } from "./toolLoopHandler.ts";
import { appendStructuredData } from "./responseAssembly.ts";

// ━━━ Service-level Supabase client ━━━
const supabase = createServiceClient();

const readH = createReadHandlers(supabase);
const writeH = createWriteHandlers(supabase);
const entH = createEnterpriseHandlers(supabase);

const toolDeps: ToolExecutorDeps = { supabase, readH, writeH, entH };

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MAIN HANDLER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const metrics = startMetrics("ai-assistant");
  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return edgeError("AUTH_REQUIRED", "Unauthorized");
    }
    const token = authHeader.replace("Bearer ", "");
    const authClient = createUserClient(authHeader);
    const { data: userData, error: authError } = await authClient.auth.getUser(token);
    if (authError || !userData?.user?.id) {
      return edgeError("AUTH_INVALID", "Unauthorized");
    }
    const userId: string = userData.user.id;

    // ── Rate limiting ──
    const rl = checkRateLimit(`ai-assistant:${userId}`, { maxTokens: 15, refillRate: 0.25 });
    if (!rl.allowed) {
      return rateLimitResponse(rl, dynCors);
    }

    // ── AI Provider ──
    const provider = await resolveAiProvider(supabase, userId);
    const limitsEnabled = Deno.env.get("AI_USAGE_LIMITS_ENABLED") === "true";
    if (limitsEnabled && !provider.isUserKey) {
      const { data: credits } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", userId)
        .single();
      if (credits && credits.balance <= 0) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Crediti AI esauriti. Acquista crediti extra o aggiungi le tue chiavi API nelle impostazioni.",
            code: "CREDITS_EXHAUSTED",
          }),
          { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Parse request ──
    const { messages, context, mode, scope } = await req.json();

    // ═══ TOOL-DECISION MODE ═══
    if (mode === "tool-decision") {
      const result = await handleToolDecisionMode(
        provider,
        context?.tools,
        Array.isArray(messages) && messages.length > 0
          ? (messages[messages.length - 1]?.content ?? "")
          : "",
        userId,
        supabase
      );
      endMetrics(metrics, true, 200);
      return result;
    }

    // ═══ PLAN-EXECUTION MODE ═══
    if (mode === "plan-execution") {
      const userPrompt = typeof context?.userPrompt === "string"
        ? context.userPrompt
        : Array.isArray(messages)
          ? (
              [...messages]
                .reverse()
                .find((m: Record<string, unknown>) => m?.role === "user")
                ?.content as string
            ) ?? ""
          : "";
      const result = await handlePlanExecutionMode(
        provider,
        context?.tools || [],
        userPrompt,
        Array.isArray(context?.history) ? context.history : [],
        userId,
        supabase
      );
      endMetrics(metrics, true, 200);
      return result;
    }

    // ── Detect conversational mode ──
    const isConversational: boolean =
      mode === "conversational" ||
      context?.conversational === true ||
      context?.mode === "conversational";

    // ── Build system prompt ──
    const systemPromptBase = await composeSystemPrompt({
      operatorBriefing: typeof context?.operatorBriefing === "string" ? context.operatorBriefing : undefined,
      activeWorkflow: undefined, // Set by contextAssembly
      scope: scope || undefined,
      conversational: isConversational,
    });

    // ── Assemble full system prompt with context ──
    const { systemPrompt, budgetStats } = await assembleSystemPrompt(
      supabase,
      systemPromptBase,
      provider,
      userId,
      isConversational,
      context,
      messages,
      scope
    );

    // ── Detect conversational repetitions ──
    let finalSystemPrompt = systemPrompt;
    if (Array.isArray(messages) && messages.length >= 2) {
      const repetitionWarning = detectRepetitions(messages);
      if (repetitionWarning) {
        finalSystemPrompt += "\n\n" + repetitionWarning;
        // Fire-and-forget: save repetition as L1 memory
        if (userId) {
          const lastMsg = [...messages]
            .reverse()
            .find((m: Record<string, unknown>) => m.role === "user")
            ?.content;
          supabase
            .from("ai_memory")
            .insert({
              user_id: userId,
              memory_type: "conversation",
              content: `L'utente ha dovuto ripetere una richiesta. Ultima: "${String(lastMsg || "").substring(0, 200)}". Migliorare comprensione.`,
              tags: ["ripetizione", "feedback_implicito", "da_migliorare"],
              level: 1,
              importance: 3,
              confidence: 0.5,
              decay_rate: 0.02,
              source: "repetition_detection",
            })
            .then(() => {}, () => {});
        }
      }
    }

    // ── Message compression ──
    // Bypass per scope ingestion (kb-supervisor): è single-shot, niente
    // conversazione storica → niente riassunti/scritture su ai_memory.
    const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY") || provider.apiKey;
    const compressedMessages = scope === "kb-supervisor"
      ? messages
      : await compressMessages(
          supabase,
          messages,
          LOVABLE_KEY,
          userId
        );
    const allMessages: Record<string, unknown>[] = [
      { role: "system", content: finalSystemPrompt },
      ...compressedMessages,
    ];

    // ── AI call with model fallback ──
    const initialResponse = await callAiWithFallback(
      provider,
      isConversational,
      scope,
      allMessages,
      isConversational ? undefined : (TOOL_DEFINITIONS as unknown as Record<string, unknown>[])
    );

    if (!initialResponse.ok) {
      const statusCode = initialResponse.statusCode || 500;
      const msg = initialResponse.error || "Errore AI gateway";
      endMetrics(metrics, false, statusCode);
      return new Response(JSON.stringify({ error: msg }), {
        status: statusCode,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // deno-lint-ignore no-explicit-any
    const initialResult = initialResponse.data as any;

    // ── Tool calling loop ──
    const toolLoopState: ToolLoopState = {
      assistantMessage: initialResult.choices?.[0]?.message,
      allMessages,
      lastPartnerResult: undefined,
      uiActions: [],
      totalUsage: {
        prompt_tokens: (initialResult.usage as Record<string, unknown> | undefined)?.prompt_tokens as number || 0,
        completion_tokens: (initialResult.usage as Record<string, unknown> | undefined)?.completion_tokens as number || 0,
      },
    };

    const loopResult: ToolLoopResult = await executeToolLoop(
      supabase,
      toolDeps,
      userId,
      authHeader,
      async (loopMessages: Record<string, unknown>[]) => {
        const res = await callAiForToolLoop(
          provider,
          isConversational,
          scope,
          loopMessages,
          isConversational ? undefined : (TOOL_DEFINITIONS as unknown as Record<string, unknown>[])
        );
        return {
          ok: res.ok,
          data: res.data,
        };
      },
      toolLoopState
    );

    // ── Format final response ──
    const finalMessage = (loopResult.state.assistantMessage?.content as string | undefined) || "";
    let responseContent: string;

    if (finalMessage) {
      if (!isConversational) {
        responseContent = appendStructuredData(
          finalMessage,
          loopResult.state.lastPartnerResult,
          undefined,
          loopResult.state.uiActions
        );
      } else {
        responseContent = finalMessage;
      }
    } else {
      // Fallback: one more call without tools
      if (loopResult.state.assistantMessage) {
        loopResult.state.allMessages.push(loopResult.state.assistantMessage);
      }
      const fallbackResponse = await callAiWithoutTools(provider, loopResult.state.allMessages);
      if (!fallbackResponse.ok) {
        // Graceful degradation: don't 500 the UI. Return an empty assistant
        // message with a soft error flag so the client can surface it.
        endMetrics(metrics, true, 200);
        return new Response(
          JSON.stringify({
            content: "Non sono riuscito a generare una risposta in questo momento. Riprova tra qualche secondo.",
            response: "Non sono riuscito a generare una risposta in questo momento. Riprova tra qualche secondo.",
            soft_error: "ai_empty_completion",
            fallback: true,
          }),
          { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } },
        );
      }
      // deno-lint-ignore no-explicit-any
      const fallbackResult = fallbackResponse.data as any;
      const fallbackText =
        (fallbackResult.choices?.[0]?.message?.content as string) ||
        "Nessuna risposta";
      if (fallbackResult.usage) {
        loopResult.state.totalUsage.prompt_tokens +=
          (fallbackResult.usage as Record<string, unknown>).prompt_tokens as number || 0;
        loopResult.state.totalUsage.completion_tokens +=
          (fallbackResult.usage as Record<string, unknown>).completion_tokens as number || 0;
      }
      responseContent = isConversational
        ? fallbackText
        : appendStructuredData(
            fallbackText,
            loopResult.state.lastPartnerResult,
            undefined,
            loopResult.state.uiActions
          );
    }

    // ── Consume credits ──
    if (userId) {
      await consumeCredits(
        supabase,
        userId,
        loopResult.state.totalUsage,
        provider.isUserKey
      );
    }

    endMetrics(metrics, true, 200);
    // Surface usage + finish_reason al chiamante. Permette al frontend
    // (Harmonizer ecc.) di distinguere tra errore modello e troncamento per
    // max_tokens (finish_reason=length).
    const lastMsg = loopResult.state.assistantMessage as Record<string, unknown> | undefined;
    const finishReason = (lastMsg as { finish_reason?: string } | undefined)?.finish_reason
      ?? (initialResult.choices?.[0]?.finish_reason as string | undefined);
    return new Response(JSON.stringify({
      content: responseContent,
      usage: loopResult.state.totalUsage,
      finish_reason: finishReason,
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    logEdgeError("ai-assistant", e);
    endMetrics(metrics, false, 500);
    console.error("ai-assistant error:", extractErrorMessage(e));
    return edgeError("INTERNAL_ERROR", extractErrorMessage(e));
  }
});
