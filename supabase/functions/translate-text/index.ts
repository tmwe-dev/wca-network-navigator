/**
 * translate-text — Edge function di traduzione email/short text.
 *
 * USO TIPICO
 *  - Bulk send: tradurre lo stesso oggetto+corpo nella lingua del destinatario
 *    (risolta lato client da `resolveLanguage`).
 *  - Composer singolo (futuro pulsante "Traduci ora"): tradurre il draft
 *    già scritto a mano dall'operatore.
 *
 * GUARANTEE
 *  - Preserva la formattazione HTML semplice (br, p, strong, em, a, ul/li).
 *  - Non aggiunge note del traduttore, scuse, intestazioni "Subject:".
 *  - Se la lingua sorgente coincide con la target, restituisce il testo
 *    invariato (no-op, no costo AI).
 *  - JWT obbligatorio (verifica via SUPABASE_ANON_KEY).
 */
import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { createLogger } from "../_shared/structuredLogger.ts";

interface TranslatePayload {
  subject?: string;
  body?: string;
  targetLanguage: string;
  sourceLanguage?: string;
  /** Se true, NON tradurre se source==target (no-op). Default true. */
  skipIfSame?: boolean;
  /** Modello AI override (default: gemini-2.5-flash). */
  model?: string;
}

interface TranslateResponse {
  subject: string;
  body: string;
  source_language: string;
  target_language: string;
  translated: boolean;
  model: string;
}

const log = createLogger("translate-text");

function jsonResponse(data: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
  });
}

function normalize(s: string | undefined | null): string {
  return (s || "").trim().toLowerCase();
}

serve(async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;
  const origin = req.headers.get("origin");

  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, origin);
  }

  // --- Auth ---
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "unauthorized" }, 401, origin);
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "unauthorized" }, 401, origin);
  }
  const userId = userData.user.id;

  // --- Rate limit ---
  const rl = await checkRateLimit({ userId, action: "translate-text", limit: 60, windowSec: 60 });
  if (!rl.allowed) return rateLimitResponse(rl, origin);

  // --- Payload ---
  let payload: TranslatePayload;
  try {
    payload = (await req.json()) as TranslatePayload;
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, origin);
  }
  const target = normalize(payload.targetLanguage);
  if (!target) return jsonResponse({ error: "missing_target_language" }, 400, origin);
  const subject = (payload.subject || "").trim();
  const body = (payload.body || "").trim();
  if (!subject && !body) return jsonResponse({ error: "empty_input" }, 400, origin);

  const source = normalize(payload.sourceLanguage);
  const skipIfSame = payload.skipIfSame !== false;
  if (skipIfSame && source && source === target) {
    const result: TranslateResponse = {
      subject, body,
      source_language: source,
      target_language: target,
      translated: false,
      model: "no-op",
    };
    return jsonResponse(result, 200, origin);
  }

  const model = payload.model || "google/gemini-2.5-flash";

  const systemPrompt = [
    "Sei un traduttore professionale di email B2B.",
    `Traduci dal ${source || "italiano (presunto)"} al ${target}.`,
    "REGOLE TASSATIVE:",
    "1. Preserva la formattazione HTML esistente (tag <br>, <p>, <strong>, <em>, <a>, <ul>, <ol>, <li>).",
    "2. NON aggiungere mai note, scuse, commenti del traduttore, prefissi tipo 'Translation:' o 'Subject:'.",
    "3. Mantieni nomi propri, brand, indirizzi email, URL e numeri esattamente identici.",
    "4. Mantieni il tono professionale e diretto dell'originale.",
    "5. Se trovi placeholder come {{contact_name}} o {{company_name}}, lasciali INVARIATI.",
    "6. Restituisci ESCLUSIVAMENTE un JSON valido con esattamente queste chiavi: {\"subject\":\"…\",\"body\":\"…\"}.",
    "7. Niente markdown attorno al JSON, niente ```json fence.",
  ].join("\n");

  const userPrompt = [
    `OGGETTO ORIGINALE:\n${subject || "(vuoto)"}`,
    "",
    `CORPO ORIGINALE:\n${body || "(vuoto)"}`,
    "",
    `Traduci entrambi in ${target} e restituisci JSON {"subject","body"}.`,
  ].join("\n");

  try {
    const ai = await aiChat({
      models: [model],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.2,
      maxTokens: 4000,
      userId,
      scope: "translation",
      functionName: "translate-text",
      context: "bulk_or_composer_translate",
    });

    const raw = (ai.content || "").trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: { subject?: string; body?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      log.warn("translate_invalid_json", { len: raw.length, target });
      return jsonResponse({ error: "invalid_ai_output" }, 502, origin);
    }

    const result: TranslateResponse = {
      subject: (parsed.subject || subject).trim(),
      body: (parsed.body || body).trim(),
      source_language: source || "auto",
      target_language: target,
      translated: true,
      model: ai.model ?? model,
    };
    return jsonResponse(result, 200, origin);
  } catch (err) {
    return mapErrorToResponse(err, getCorsHeaders(origin));
  }
});