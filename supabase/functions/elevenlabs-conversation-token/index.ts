/**
 * elevenlabs-conversation-token
 *
 * Issues a short-lived WebRTC conversation token for the ElevenLabs
 * Conversational Agent used by Command (hybrid voice mode).
 *
 * Requires:
 *  - ELEVENLABS_API_KEY (server secret)
 *  - ELEVENLABS_COMMAND_AGENT_ID (server secret — agent configured in
 *    ElevenLabs dashboard with the prompt/voice for Command)
 *
 * The endpoint validates the caller's JWT (anon key already required by the
 * gateway) and proxies the token request so the API key never reaches the
 * client.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Estrae user_id dal JWT senza verifica crittografica (gateway l'ha già validato) */
function extractUserIdFromJwt(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, "");
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(
      atob(payload.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return (decoded?.sub as string) || null;
  } catch {
    return null;
  }
}

/** Crea un bridge_token sha256-hashed in tabella, ritorna il token in chiaro */
async function mintBridgeToken(userId: string): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const raw = crypto.randomUUID() + "-" + crypto.randomUUID();
    const hashBuf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(raw),
    );
    const tokenHash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error } = await supabase.from("bridge_tokens").insert({
      token_hash: tokenHash,
      created_by: userId,
      // expires_at default = 30 min (vedi migration 20260410101008)
    });
    if (error) {
      console.warn("bridge_token insert failed", error.message);
      return null;
    }
    return raw;
  } catch (e) {
    console.warn("mintBridgeToken failed", (e as Error).message);
    return null;
  }
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const agentId = Deno.env.get("ELEVENLABS_COMMAND_AGENT_ID");

  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "ELEVENLABS_API_KEY non configurato" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
  if (!agentId) {
    return new Response(
      JSON.stringify({
        error:
          "ELEVENLABS_COMMAND_AGENT_ID non configurato. Crea un agente in ElevenLabs e imposta il secret.",
      }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Lightweight JWT presence check — the gateway already validates the JWT
  // signature; here we only refuse anonymous traffic.
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Authorization mancante" }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  try {
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`,
      {
        headers: { "xi-api-key": apiKey },
      },
    );

    if (!resp.ok) {
      const detail = await resp.text();
      return new Response(
        JSON.stringify({ error: `ElevenLabs token request failed (${resp.status})`, detail }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const token: string | undefined = data?.token;
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Risposta ElevenLabs senza token" }),
        { status: 502, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }

    // Mint bridge_token per autenticare il client tool ask_brain → command-ask-brain
    const userId = extractUserIdFromJwt(authHeader);
    const bridgeToken = userId ? await mintBridgeToken(userId) : null;

    return new Response(JSON.stringify({ token, agentId, bridge_token: bridgeToken }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});