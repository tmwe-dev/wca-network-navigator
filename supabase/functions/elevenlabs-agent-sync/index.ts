/**
 * elevenlabs-agent-sync — Legge e pubblica il prompt dell'agente vocale
 * ElevenLabs usato dal Command.
 *
 * Finora la personalità viveva SOLO nella dashboard ElevenLabs: non era
 * versionata né allineata alla persona salvata in `agents.system_prompt`.
 * Questa funzione chiude il cerchio:
 *   action=get   → restituisce prompt, first_message, voice, lingua attuali
 *   action=push  → scrive su ElevenLabs il prompt passato (o quello salvato
 *                  su `agents.system_prompt` per l'agente indicato)
 *
 * Sicurezza: JWT utente obbligatorio; l'agent_id deve essere in allowlist
 * (colonna agents.elevenlabs_agent_id) o coincidere col secret di progetto.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { requireAuth, isAuthError } from "../_shared/authGuard.ts";
import { createLogger } from "../_shared/structuredLogger.ts";
import { edgeErrorWithStatus } from "../_shared/handleEdgeError.ts";

const log = createLogger("elevenlabs-agent-sync");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EL_BASE = "https://api.elevenlabs.io/v1/convai/agents";

interface Body {
  action?: "get" | "push" | "create_copilot";
  /** ID agente ElevenLabs (deve essere in allowlist). */
  elevenlabs_agent_id?: string;
  /** Record `agents` da cui prendere il prompt quando non è passato inline. */
  agent_row_id?: string;
  prompt?: string;
  first_message?: string;
  language?: string;
  /** create_copilot: nome del nuovo agente e agente sorgente da cui copiare voce/tool. */
  name?: string;
  source_agent_id?: string;
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const cors = getCorsHeaders(req.headers.get("origin"));
  const json = { ...cors, "Content-Type": "application/json" };

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return edgeErrorWithStatus("INTERNAL_ERROR", "ELEVENLABS_API_KEY non configurato", 500, json);
  }

  const auth = await requireAuth(req, cors);
  if (isAuthError(auth)) return auth;

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* body opzionale per action=get */
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  // ── Allowlist agenti vocali ──
  let allowlist = new Set<string>();
  let rowPrompt: string | null = null;
  try {
    const { data: rows } = await supabase.from("agents").select("id, elevenlabs_agent_id, system_prompt");
    for (const r of rows ?? []) {
      const id = (r.elevenlabs_agent_id as string | null)?.trim();
      if (id) allowlist.add(id);
      if (body.agent_row_id && r.id === body.agent_row_id) {
        rowPrompt = (r.system_prompt as string | null) ?? null;
      }
    }
  } catch (e) {
    log.warn("allowlist lookup failed", { details: [(e as Error).message] });
    allowlist = new Set<string>();
  }

  const secretAgent = Deno.env.get("ELEVENLABS_COMMAND_AGENT_ID")?.trim() || null;
  if (secretAgent) allowlist.add(secretAgent);

  const requested = body.elevenlabs_agent_id?.trim() || null;
  const agentId = requested && allowlist.has(requested) ? requested : (Array.from(allowlist)[0] ?? null);

  if (!agentId) {
    return edgeErrorWithStatus("VALIDATION_ERROR", "Nessun agente vocale configurato o id non autorizzato", 400, json);
  }

  const headers = { "xi-api-key": apiKey, "Content-Type": "application/json" };

  try {
    if ((body.action ?? "get") === "get") {
      const resp = await fetch(`${EL_BASE}/${encodeURIComponent(agentId)}`, { headers });
      const raw = await resp.text();
      if (!resp.ok) {
        return new Response(JSON.stringify({ error: `ElevenLabs GET ${resp.status}`, detail: raw.slice(0, 800) }), {
          status: 502,
          headers: json,
        });
      }
      const data = JSON.parse(raw) as Record<string, unknown>;
      const conv = (data.conversation_config ?? {}) as Record<string, unknown>;
      const agentCfg = (conv.agent ?? {}) as Record<string, unknown>;
      const promptCfg = (agentCfg.prompt ?? {}) as Record<string, unknown>;
      const ttsCfg = (conv.tts ?? {}) as Record<string, unknown>;
      return new Response(
        JSON.stringify({
          agent_id: agentId,
          name: data.name ?? null,
          prompt: (promptCfg.prompt as string | undefined) ?? "",
          llm: promptCfg.llm ?? null,
          temperature: promptCfg.temperature ?? null,
          first_message: agentCfg.first_message ?? "",
          language: agentCfg.language ?? null,
          voice_id: ttsCfg.voice_id ?? null,
          tool_ids: promptCfg.tool_ids ?? [],
        }),
        { status: 200, headers: json },
      );
    }

    // ── create_copilot: crea un agente vocale dedicato copiando voce e tool ──
    if (body.action === "create_copilot") {
      const promptText = (body.prompt ?? rowPrompt ?? "").trim();
      if (promptText.length < 50) {
        return edgeErrorWithStatus("VALIDATION_ERROR", "Prompt mancante per il nuovo agente", 400, json);
      }
      const sourceId = body.source_agent_id?.trim() || agentId;
      const src = await fetch(`${EL_BASE}/${encodeURIComponent(sourceId)}`, { headers });
      if (!src.ok) {
        const detail = await src.text();
        return new Response(JSON.stringify({ error: `ElevenLabs GET sorgente ${src.status}`, detail: detail.slice(0, 500) }), {
          status: 502,
          headers: json,
        });
      }
      const srcData = (await src.json()) as Record<string, unknown>;
      const srcConv = (srcData.conversation_config ?? {}) as Record<string, unknown>;
      const srcAgent = (srcConv.agent ?? {}) as Record<string, unknown>;
      const srcPrompt = (srcAgent.prompt ?? {}) as Record<string, unknown>;

      const payload = {
        name: body.name || "AURORA — Copilota Command",
        conversation_config: {
          ...srcConv,
          agent: {
            ...srcAgent,
            language: body.language || (srcAgent.language as string) || "it",
            first_message: body.first_message ?? "Ciao Luca, sono Aurora. Dimmi pure.",
            // ElevenLabs rifiuta `tools` e `tool_ids` insieme: teniamo solo gli id.
            prompt: (() => {
              const cloned = { ...srcPrompt, prompt: promptText } as Record<string, unknown>;
              if (Array.isArray(cloned.tool_ids) && (cloned.tool_ids as unknown[]).length > 0) {
                delete cloned.tools;
              }
              return cloned;
            })(),
          },
        },
      };

      const created = await fetch(`${EL_BASE}/create`, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
      const createdRaw = await created.text();
      if (!created.ok) {
        return new Response(JSON.stringify({ error: `ElevenLabs CREATE ${created.status}`, detail: createdRaw.slice(0, 800) }), {
          status: 502,
          headers: json,
        });
      }
      const createdData = JSON.parse(createdRaw) as Record<string, unknown>;
      log.info("voice copilot created", { details: [String(createdData.agent_id ?? "")] });
      return new Response(JSON.stringify({ success: true, agent_id: createdData.agent_id ?? null }), {
        status: 200,
        headers: json,
      });
    }

    // ── push ──
    const newPrompt = (body.prompt ?? rowPrompt ?? "").trim();
    if (newPrompt.length < 50) {
      return edgeErrorWithStatus("VALIDATION_ERROR", "Prompt vuoto o troppo corto per la pubblicazione", 400, json);
    }

    const agentPatch: Record<string, unknown> = { prompt: { prompt: newPrompt } };
    if (body.first_message !== undefined) agentPatch.first_message = body.first_message;
    if (body.language) agentPatch.language = body.language;

    const resp = await fetch(`${EL_BASE}/${encodeURIComponent(agentId)}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ conversation_config: { agent: agentPatch } }),
    });
    const raw = await resp.text();
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: `ElevenLabs PATCH ${resp.status}`, detail: raw.slice(0, 800) }), {
        status: 502,
        headers: json,
      });
    }

    log.info("voice prompt published", { details: [agentId, String(newPrompt.length)] });
    return new Response(JSON.stringify({ success: true, agent_id: agentId, prompt_length: newPrompt.length }), {
      status: 200,
      headers: json,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return edgeErrorWithStatus("INTERNAL_ERROR", message, 500, json);
  }
});
