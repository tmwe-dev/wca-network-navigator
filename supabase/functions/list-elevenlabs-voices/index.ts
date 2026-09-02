import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { edgeError, edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";
import { createLogger } from "../_shared/structuredLogger.ts";
import { trackUsage } from "../_shared/usageTrack.ts";

const log = createLogger("list-elevenlabs-voices");

interface VoiceRaw {
  voice_id?: string;
  name?: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  description?: string;
}

serve(async (req) => {
  trackUsage("list-elevenlabs-voices", "quarantine", { note: "Q2 bonifica, scadenza 2026-10-02" });
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  // Auth check — _shared/authGuard (terse: { error: CODE }), contratto invariato
  try {
    const auth = await requireAuth(req, dynCors, { errorFormat: "terse" });
    if (isAuthError(auth)) return auth;
  } catch {
    return edgeErrorWithStatus("AUTH_INVALID", "AUTH_INVALID", 401, dynCors);
  }

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    // status 200 legacy preservato: la UI mostra lo stato "missing_key" senza toast di errore
    return edgeErrorWithStatus("VALIDATION_ERROR", "ELEVENLABS_API_KEY not configured", 200, dynCors, {
      voices: [],
      status: "missing_key",
    });
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });

    if (!response.ok) {
      const status = response.status;
      return edgeErrorWithStatus("UPSTREAM_ERROR", `ElevenLabs API error: ${status}`, 200, dynCors, {
        voices: [],
        status: status === 401 ? "invalid_key" : "api_error",
      });
    }

    const data = await response.json();
    const voices = (data.voices || []).map((v: VoiceRaw) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category || "premade",
      labels: v.labels || {},
      preview_url: v.preview_url || null,
      description: v.description || null,
    }));

    return new Response(JSON.stringify({ voices, status: "ok", total: voices.length }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (error) {
    log.error("voices_fetch_failed", error);
    return edgeError("INTERNAL_ERROR", "Internal error", undefined, dynCors, {
      voices: [],
      status: "error",
    });
  }
});
