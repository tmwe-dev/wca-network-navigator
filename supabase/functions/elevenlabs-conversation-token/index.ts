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

    return new Response(JSON.stringify({ token, agentId }), {
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