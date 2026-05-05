/**
 * refresh-conversation-context — Builder/refresher del riassunto relazione contatto.
 *
 * Idempotente, debounced, fire-and-forget friendly.
 * Legge gli ultimi N (default 30) `channel_messages` cross-canale per partner/email
 * e produce con AI un summary narrativo + last_exchanges + metriche.
 * Upsert in `contact_conversation_context` (uniq user_id+email_address).
 *
 * Input: { user_id, partner_id?, email_address?, force?, limit? }
 * Output: { ok, summary, source, skipped? }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import { normalizeContent } from "../_shared/contentNormalizer.ts";

const DEBOUNCE_MS = 5 * 60 * 1000; // 5 min

interface ReqBody {
  user_id: string;
  partner_id?: string | null;
  email_address?: string | null;
  force?: boolean;
  limit?: number; // max 50
}

const ExchangeSchema = z.object({
  date: z.string().max(20).optional(),
  channel: z.string().max(20).optional(),
  direction: z.string().max(20).optional(),
  gist: z.string().max(160).optional(),
}).passthrough();

const SummarySchema = z.object({
  conversation_summary: z.string().max(1200),
  last_exchanges: z.array(ExchangeSchema).max(5).default([]),
  dominant_sentiment: z.string().max(20).default("neutral"),
  response_rate: z.number().min(0).max(1).default(0),
  avg_response_time_hours: z.number().min(0).max(720).default(0),
  preferred_language: z.string().max(8).default("en"),
});

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const headers = getSecurityHeaders(getCorsHeaders(req.headers.get("origin")));
  const metrics = startMetrics("refresh-conversation-context");

  try {
    const body: ReqBody = await req.json();
    if (!body.user_id || (!body.partner_id && !body.email_address)) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "user_id + (partner_id|email_address) required" }), { status: 400, headers });
    }
    const limit = Math.max(5, Math.min(50, body.limit ?? 30));

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Risolvi email_address chiave (per UNIQUE constraint user_id+email_address)
    let emailKey = body.email_address ?? null;
    if (!emailKey && body.partner_id) {
      const { data: p } = await supabase.from("partners").select("email").eq("id", body.partner_id).maybeSingle();
      if (p?.email) emailKey = p.email;
    }
    if (!emailKey) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "could not resolve email_address" }), { status: 400, headers });
    }

    // Idempotenza/debounce
    const { data: existing } = await supabase
      .from("contact_conversation_context")
      .select("id, interaction_count, updated_at")
      .eq("user_id", body.user_id)
      .eq("email_address", emailKey)
      .maybeSingle();

    // Conta messaggi totali (per detect "nuovo arrivato")
    let countQ = supabase
      .from("channel_messages")
      .select("id", { count: "exact", head: true });
    if (body.partner_id) countQ = countQ.eq("partner_id", body.partner_id);
    else countQ = countQ.or(`from_address.eq.${emailKey},to_address.eq.${emailKey}`);
    const { count: totalCount } = await countQ;
    const total = totalCount ?? 0;

    if (existing && !body.force) {
      const ageMs = Date.now() - new Date(existing.updated_at).getTime();
      const sameCount = (existing.interaction_count ?? 0) === total;
      if (sameCount && ageMs < DEBOUNCE_MS) {
        endMetrics(metrics, true, 200);
        return new Response(JSON.stringify({ ok: true, skipped: "debounced", source: "cache" }), { status: 200, headers });
      }
    }

    // Carica messaggi recenti
    let q = supabase
      .from("channel_messages")
      .select("channel,direction,subject,body_text,created_at,from_address,to_address")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (body.partner_id) q = q.eq("partner_id", body.partner_id);
    else q = q.or(`from_address.eq.${emailKey},to_address.eq.${emailKey}`);
    const { data: msgs } = await q;
    const messages = (msgs ?? []) as Array<{
      channel: string; direction: string; subject: string | null;
      body_text: string | null; created_at: string;
      from_address: string | null; to_address: string | null;
    }>;

    if (messages.length === 0) {
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, skipped: "no-messages" }), { status: 200, headers });
    }

    // Compatta i messaggi per il prompt (cronologico ascendente)
    const compact = messages.slice().reverse().map((m, i) => {
      const subjN = normalizeContent(m.subject ?? "", { source: "email-history", maxChars: 100 }).text;
      const bodyN = normalizeContent(m.body_text ?? "", { source: "email-history", maxChars: 350 }).text;
      return `[${i + 1}] ${m.created_at.slice(0, 10)} ${m.channel}/${m.direction} ${subjN ? `"${subjN}" ` : ""}${bodyN}`;
    }).join("\n");

    // Prompt operativo editabile (Prompt Lab)
    let opBlock = "";
    try {
      const op = await loadOperativePrompts(supabase, body.user_id, {
        scope: "general",
        extraContexts: ["conversation-summary"],
        extraTags: ["conversation-summary", "context"],
        includeUniversal: true,
        limit: 2,
      });
      if (op.block) opBlock = op.block;
    } catch (_) { /* fail-safe */ }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      endMetrics(metrics, false, 500);
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY missing" }), { status: 500, headers });
    }

    const systemPrompt = [
      "Sei il Conversation Summarizer del CRM. Produci un riassunto narrativo (max 800 char) della relazione con un contatto.",
      "Sii sobrio, fattuale, mai inventare. Lingua del summary = lingua dominante della corrispondenza.",
      opBlock || "",
    ].filter(Boolean).join("\n\n");

    const userPrompt = `Contatto: ${emailKey}\nMessaggi cross-canale (${messages.length}, cronologico):\n\n${compact}\n\nUsa lo strumento build_summary.`;

    const model = "google/gemini-3-flash-preview";
    let parsed: z.infer<typeof SummarySchema> | null = null;
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "build_summary",
              description: "Costruisce summary relazione contatto",
              parameters: {
                type: "object",
                properties: {
                  conversation_summary: { type: "string", maxLength: 1200 },
                  last_exchanges: {
                    type: "array", maxItems: 5,
                    items: {
                      type: "object",
                      properties: {
                        date: { type: "string" },
                        channel: { type: "string" },
                        direction: { type: "string" },
                        gist: { type: "string", maxLength: 160 },
                      },
                    },
                  },
                  dominant_sentiment: { type: "string", description: "positive|neutral|negative|mixed" },
                  response_rate: { type: "number", minimum: 0, maximum: 1 },
                  avg_response_time_hours: { type: "number", minimum: 0 },
                  preferred_language: { type: "string", description: "ISO 639-1" },
                },
                required: ["conversation_summary"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "build_summary" } },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          const v = SummarySchema.safeParse(JSON.parse(args));
          if (v.success) parsed = v.data;
        }
      }
    } catch (_) { /* fail-safe */ }

    if (!parsed) {
      endMetrics(metrics, false, 502);
      return new Response(JSON.stringify({ error: "AI summary failed" }), { status: 502, headers });
    }

    // Upsert
    const lastInteraction = messages[0]?.created_at ?? new Date().toISOString();
    const row = {
      user_id: body.user_id,
      email_address: emailKey,
      partner_id: body.partner_id ?? null,
      conversation_summary: parsed.conversation_summary,
      last_exchanges: parsed.last_exchanges,
      interaction_count: total,
      last_interaction_at: lastInteraction,
      dominant_sentiment: parsed.dominant_sentiment,
      response_rate: parsed.response_rate,
      avg_response_time_hours: parsed.avg_response_time_hours,
      preferred_language: parsed.preferred_language,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await supabase
      .from("contact_conversation_context")
      .upsert(row, { onConflict: "user_id,email_address" });

    if (upErr) {
      endMetrics(metrics, false, 500);
      return new Response(JSON.stringify({ error: upErr.message }), { status: 500, headers });
    }

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({ ok: true, source: "ai", summary: row }), { status: 200, headers });
  } catch (error: unknown) {
    logEdgeError("refresh-conversation-context", error);
    endMetrics(metrics, false, 500);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers },
    );
  }
});