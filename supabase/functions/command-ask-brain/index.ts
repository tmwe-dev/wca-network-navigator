/**
 * command-ask-brain — Bridge ElevenLabs Command Agent ↔ Brain (ai-assistant scope=command)
 *
 * Chiamato dall'Agente Vocale ElevenLabs come client tool `ask_brain`.
 * L'Agente vocale gestisce SOLO voce/turn-taking/persona; tutta l'intelligenza
 * (memoria, KB, doctrine, holding, prompt operativi, scheduling) vive in Brain.
 *
 * Auth: per-session bridge_token emesso da `elevenlabs-conversation-token`.
 * Risposta: testo plain ottimizzato per TTS (≤80 parole, no markdown).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type AskBrainBody = {
  question?: string;
  bridge_token?: string;
  conversation_id?: string;
  language?: string;
};

async function resolveUserFromBridgeToken(
  supabase: ReturnType<typeof createClient>,
  rawToken: string,
): Promise<string | null> {
  if (!rawToken) return null;
  try {
    const hashBuf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(rawToken),
    );
    const tokenHash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const { data } = await supabase
      .from("bridge_tokens")
      .select("created_by, expires_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (!data) return null;
    if (new Date(data.expires_at as string) < new Date()) return null;
    // NB: per Command il token è multi-use entro la sua finestra (30 min): NON marcare used.
    return data.created_by as string;
  } catch {
    return null;
  }
}

function sanitizeForTts(text: string): string {
  return (text || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`]*`/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("origin"));

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: AskBrainBody;
  try {
    body = (await req.json()) as AskBrainBody;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const question = (body.question || "").trim();
  if (!question) {
    return new Response(
      JSON.stringify({ answer: "Non ho ricevuto la domanda, puoi ripetere?" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const userId = body.bridge_token
    ? await resolveUserFromBridgeToken(supabase, body.bridge_token)
    : null;

  if (!userId) {
    return new Response(
      JSON.stringify({
        answer:
          "Non riesco ad autenticare la sessione vocale. Chiudi e riapri la conversazione, per favore.",
      }),
      { status: 401, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }

  // Inoltra a ai-assistant scope=command (carica memory, KB, doctrine, holding…)
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 18000);
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/ai-assistant`, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        "x-impersonate-user": userId,
      },
      body: JSON.stringify({
        scope: "command",
        mode: "conversational",
        messages: [
          {
            role: "system",
            content:
              "Stai rispondendo via canale VOCE. Output: testo plain, max 80 parole, italiano (o lingua dell'utente), nessun markdown/URL/codice. Vai dritta al punto, finisci con un prossimo passo.",
          },
          { role: "user", content: question },
        ],
        context: {
          source: "command_voice",
          channel: "voice",
          conversation_id: body.conversation_id || null,
          language: body.language || "it",
        },
      }),
    }).finally(() => clearTimeout(tid));

    if (!resp.ok) {
      const detail = await resp.text();
      console.warn("command-ask-brain ai-assistant error", resp.status, detail);
      return new Response(
        JSON.stringify({
          answer:
            "Ho avuto un problema a recuperare l'informazione. Riprova tra qualche secondo.",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
      );
    }
    const data = await resp.json();
    const raw =
      (data?.content as string) ||
      (data?.response as string) ||
      (data?.message as string) ||
      "";
    const answer = sanitizeForTts(raw) ||
      "Non ho una risposta utile in questo momento. Vuoi che approfondisca un tema specifico?";

    return new Response(JSON.stringify({ answer }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.warn("command-ask-brain failed", (e as Error).message);
    return new Response(
      JSON.stringify({
        answer:
          "Connessione lenta verso il sistema. Posso riprovare se ripeti la domanda.",
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});