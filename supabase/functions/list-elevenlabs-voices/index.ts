import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

interface VoiceRaw {
  voice_id?: string;
  name?: string;
  category?: string;
  labels?: Record<string, string>;
  preview_url?: string;
  description?: string;
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
      status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const anonClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "AUTH_INVALID" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "AUTH_INVALID" }), {
      status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ELEVENLABS_API_KEY not configured", voices: [], status: "missing_key" }),
      { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }

  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": ELEVENLABS_API_KEY },
    });

    if (!response.ok) {
      const status = response.status;
      return new Response(
        JSON.stringify({ error: `ElevenLabs API error: ${status}`, voices: [], status: status === 401 ? "invalid_key" : "api_error" }),
        { status: 200, headers: { ...dynCors, "Content-Type": "application/json" } }
      );
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

    return new Response(
      JSON.stringify({ voices, status: "ok", total: voices.length }),
      { headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("list-elevenlabs-voices error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", voices: [], status: "error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});
