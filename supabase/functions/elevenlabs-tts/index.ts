import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

interface SettingRow {
  key: string;
  value: string | null;
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const ELEVENLABS_API_KEY = Deno.env.get("ELEVENLABS_API_KEY");
  if (!ELEVENLABS_API_KEY) {
    return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY not configured" }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }

  try {
    const { text, voiceId } = await req.json();

    if (!text || !voiceId) {
      return new Response(JSON.stringify({ error: "text and voiceId are required" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // --- Auth & user settings ---
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

    let modelId = "eleven_multilingual_v2";
    let stability = 0.5;
    let similarityBoost = 0.75;
    let style = 0.3;
    let useSpeakerBoost = true;
    let outputFormat = "mp3_44100_128";

    if (token && token !== SUPABASE_ANON_KEY) {
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: claims } = await supabase.auth.getUser(token);
        const userId = claims?.user?.id;

        if (userId) {
          const supabaseService = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          const { data: settings } = await supabaseService
            .from("app_settings")
            .select("key, value")
            .eq("user_id", userId)
            .in("key", [
              "elevenlabs_tts_model",
              "elevenlabs_stability",
              "elevenlabs_similarity",
              "elevenlabs_style",
              "elevenlabs_speaker_boost",
              "elevenlabs_output_format",
            ]);

          if (settings) {
            const map = new Map<string, string>();
            for (const row of settings as SettingRow[]) {
              if (row.value != null) map.set(row.key, row.value);
            }

            if (map.has("elevenlabs_tts_model")) modelId = map.get("elevenlabs_tts_model")!;
            if (map.has("elevenlabs_stability")) stability = parseFloat(map.get("elevenlabs_stability")!) || 0.5;
            if (map.has("elevenlabs_similarity")) similarityBoost = parseFloat(map.get("elevenlabs_similarity")!) || 0.75;
            if (map.has("elevenlabs_style")) style = parseFloat(map.get("elevenlabs_style")!) || 0.3;
            if (map.has("elevenlabs_speaker_boost")) useSpeakerBoost = map.get("elevenlabs_speaker_boost") !== "false";
            if (map.has("elevenlabs_output_format")) outputFormat = map.get("elevenlabs_output_format")!;
          }
        }
      } catch {
        // best effort — use defaults
      }
    }

    // Limit text length to avoid excessive API costs
    const truncatedText = text.slice(0, 4000);

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=${outputFormat}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: truncatedText,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
            style,
            use_speaker_boost: useSpeakerBoost,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs API error:", response.status, errText);
      return new Response(JSON.stringify({ error: `ElevenLabs error: ${response.status}` }), {
        status: 502,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const audioBuffer = await response.arrayBuffer();

    return new Response(audioBuffer, {
      headers: {
        ...dynCors,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
