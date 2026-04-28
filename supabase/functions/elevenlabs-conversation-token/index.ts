import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

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

  // Validate JWT to get user_id
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let userId: string | null = null;
  if (!token || token === SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
  try {
    const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data, error: authErr } = await supabaseAuth.auth.getUser(token);
    userId = data?.user?.id || null;
    if (authErr || !userId) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
  } catch {
    return new Response(JSON.stringify({ error: "Authentication check failed" }), {
      status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }

  try {
    const { agent_id } = await req.json();

    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id is required" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // 1. Get ElevenLabs conversation token
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agent_id}`,
      {
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("ElevenLabs token error:", response.status, errText);
      return new Response(JSON.stringify({ error: `Token error: ${response.status}` }), {
        status: 502,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // 2. Generate a per-session bridge token and store hash
    let bridgeToken: string | null = null;
    if (userId) {
      bridgeToken = crypto.randomUUID() + "-" + crypto.randomUUID();
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(bridgeToken)
      );
      const tokenHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const supabaseService = createClient(SUPABASE_URL, SERVICE_ROLE);
      await supabaseService.from("bridge_tokens").insert({
        token_hash: tokenHash,
        agent_id,
        created_by: userId,
        expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      });
    }

    return new Response(
      JSON.stringify({
        token: data.token,
        bridge_token: bridgeToken,
      }),
      {
        headers: { ...dynCors, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Conversation token error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  }
});
