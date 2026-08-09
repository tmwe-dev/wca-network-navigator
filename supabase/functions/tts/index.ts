import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { checkDailyBudget, recordUsage, budgetExceededResponse } from "../_shared/costGuardrail.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/structuredLogger.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";

const log = createLogger("tts");

const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY")!;
const DEFAULT_VOICE_ID_IT = "JBFqnCBsd6RMkjVDRZzb";
const ELEVENLABS_VOICE_ID_PATTERN = /^[A-Za-z0-9]{20}$/;
const MODEL = "eleven_multilingual_v2";

function resolveVoiceId(candidate?: unknown): string {
  const value = typeof candidate === "string" ? candidate.trim() : "";
  if (ELEVENLABS_VOICE_ID_PATTERN.test(value)) return value;
  return DEFAULT_VOICE_ID_IT;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    let userId = "anonymous";
    if (token) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "",
      );
      const {
        data: { user },
      } = await sb.auth.getUser(token);
      if (user) userId = user.id;
    }

    // Rate limit: 60 req/min
    const rl = checkRateLimit(`tts:${userId}`, { maxTokens: 60, refillRate: 1 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const { text, voiceId } = await req.json();
    if (!text || typeof text !== "string") {
      return edgeErrorWithStatus("VALIDATION_ERROR", "text required", 400, {
        ...corsHeaders,
        "Content-Type": "application/json",
      });
    }

    if (!ELEVENLABS_API_KEY) {
      return edgeErrorWithStatus("INTERNAL_ERROR", "ELEVENLABS_API_KEY not configured", 500, {
        ...corsHeaders,
        "Content-Type": "application/json",
      });
    }

    const truncated = text.slice(0, 1500);
    const resolvedVoiceId = resolveVoiceId(voiceId ?? Deno.env.get("ELEVENLABS_VOICE_ID_IT"));

    // Cost guardrail
    const budget = await checkDailyBudget(userId, "tts", truncated.length);
    if (!budget.allowed) return budgetExceededResponse(budget, corsHeaders);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: truncated,
          model_id: MODEL,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      log.error("[tts] ElevenLabs error:", err);
      return new Response(JSON.stringify({ error: err }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record TTS usage
    await recordUsage(userId, "tts", truncated.length).catch(() => {});

    const audio = await res.arrayBuffer();
    return new Response(audio, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "tts failed";
    log.error("[tts] error:", msg);
    return edgeErrorWithStatus("INTERNAL_ERROR", msg, 500, { ...corsHeaders, "Content-Type": "application/json" });
  }
});
