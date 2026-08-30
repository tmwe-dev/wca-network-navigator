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
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { createLogger } from "../_shared/structuredLogger.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";

const log = createLogger("elevenlabs-conversation-token");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Crea un bridge_token sha256-hashed in tabella, ritorna il token in chiaro */
async function mintBridgeToken(userId: string): Promise<string | null> {
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const raw = crypto.randomUUID() + "-" + crypto.randomUUID();
    const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    const tokenHash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { error } = await supabase.from("bridge_tokens").insert({
      token_hash: tokenHash,
      created_by: userId,
      // expires_at default = 30 min (vedi migration 20260410101008)
    });
    if (error) {
      log.warn("bridge_token insert failed", { details: [error.message] });
      return null;
    }
    return raw;
  } catch (e) {
    log.warn("mintBridgeToken failed", { details: [(e as Error).message] });
    return null;
  }
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  const secretAgentId = Deno.env.get("ELEVENLABS_COMMAND_AGENT_ID");

  if (!apiKey) {
    return edgeErrorWithStatus("INTERNAL_ERROR", "ELEVENLABS_API_KEY non configurato", 500, {
      ...cors,
      "Content-Type": "application/json",
    });
  }

  // Hard auth check: verifica crittografica del JWT (con verify_jwt=false il
  // gateway non lo valida, quindi DOBBIAMO farlo qui).
  const auth = await requireAuth(req, cors);
  if (isAuthError(auth)) return auth;
  // Risoluzione agent_id: body (validato contro allowlist DB) → DB → secret.
  // Gli agenti vocali validi vivono nella tabella `agents` (elevenlabs_agent_id).
  let requestedAgentId: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    requestedAgentId = (body?.agent_id as string | undefined)?.trim() || null;
  } catch {
    /* body opzionale */
  }

  let agentId: string | null = null;
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: rows } = await supabase
      .from("agents")
      .select("elevenlabs_agent_id, role")
      .not("elevenlabs_agent_id", "is", null);
    const allowlist = new Set(
      (rows ?? []).map((r) => (r.elevenlabs_agent_id as string | null)?.trim()).filter((v): v is string => !!v),
    );
    // Default copilota interno: preferisci l'agente con role="voice" (Aurora)
    // invece del primo id in ordine arbitrario (che era l'agente vendite).
    const defaultVoiceAgent =
      (rows ?? [])
        .filter((r) => (r.role as string | null)?.toLowerCase() === "voice")
        .map((r) => (r.elevenlabs_agent_id as string | null)?.trim())
        .find((v): v is string => !!v) ?? null;
    if (requestedAgentId && allowlist.has(requestedAgentId)) {
      agentId = requestedAgentId;
    } else if (defaultVoiceAgent) {
      agentId = defaultVoiceAgent;
    } else if (allowlist.size > 0) {
      agentId = Array.from(allowlist)[0];
    }
  } catch (e) {
    log.warn("agent allowlist lookup failed", { details: [(e as Error).message] });
  }
  // Fallback finale al secret se la DB non fornisce nulla.
  if (!agentId) agentId = secretAgentId || null;

  if (!agentId) {
    return edgeErrorWithStatus(
      "INTERNAL_ERROR",
      "Nessun agente vocale configurato. Imposta elevenlabs_agent_id su un agente o il secret ELEVENLABS_COMMAND_AGENT_ID.",
      500,
      { ...cors, "Content-Type": "application/json" },
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
      return new Response(JSON.stringify({ error: `ElevenLabs token request failed (${resp.status})`, detail }), {
        status: 502,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const token: string | undefined = data?.token;
    if (!token) {
      return edgeErrorWithStatus("UPSTREAM_ERROR", "Risposta ElevenLabs senza token", 502, {
        ...cors,
        "Content-Type": "application/json",
      });
    }

    // Signed URL WebSocket — fallback più compatibile del WebRTC, non soggetto
    // al proxy fetch del preview Lovable che blocca il signaling LiveKit.
    let signedUrl: string | null = null;
    try {
      const sresp = await fetch(
        `https://api.elevenlabs.io/v1/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`,
        { headers: { "xi-api-key": apiKey } },
      );
      if (sresp.ok) {
        const sdata = await sresp.json();
        signedUrl = (sdata?.signed_url as string | undefined) || null;
      }
    } catch (e) {
      log.warn("signed url fetch failed", { details: [(e as Error).message] });
    }

    // Mint bridge_token per autenticare il client tool ask_brain → command-ask-brain
    const bridgeToken = await mintBridgeToken(auth.userId);

    return new Response(JSON.stringify({ token, signed_url: signedUrl, agentId, bridge_token: bridgeToken }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return edgeErrorWithStatus("INTERNAL_ERROR", message, 500, { ...cors, "Content-Type": "application/json" });
  }
});
