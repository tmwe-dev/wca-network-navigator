/**
 * process-inbound-enrichment — Worker batch per la coda `inbound_enrichment_queue`.
 *
 * Esegue per ogni mail di mittente sconosciuto:
 *  1. Chiamata AI per classificazione + suggerimento gruppo (1 sola call, JSON).
 *  2. Scrive il risultato in `channel_messages.ai_classification_suggestion`.
 *  3. Marca il job done/error/skipped.
 *
 * Triggerato da pg_cron (ogni minuto) oppure manualmente via curl.
 * Batch max = 5 per esecuzione (cap di sicurezza). Hard guards immutati.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { callLLM } from "../_shared/callLLM.ts";
import { safeParseAiJson } from "../_shared/aiJsonValidator.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const BATCH_SIZE = 5;
const MAX_ATTEMPTS = 3;

const SuggestionSchema = z.object({
  category: z.string(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
  suggested_group: z.string().nullable().optional(),
});
type Suggestion = z.infer<typeof SuggestionSchema>;

const PROMPT_SYSTEM_FALLBACK = `Sei un classificatore di email B2B in arrivo.
Per ogni mail rispondi SOLO con JSON che rispetta lo schema fornito.
Categorie ammesse: "commerciale", "amministrativa", "tecnica", "spam", "newsletter", "personale", "altro".
Confidence: 0.0-1.0. suggested_group: nome breve (es. "Fornitori", "Clienti potenziali", "Marketing") o null.`;

function buildUserPrompt(input: {
  from: string;
  domain: string;
  subject: string;
  snippet: string;
}): string {
  return `Mittente: ${input.from}
Dominio: ${input.domain}
Oggetto: ${input.subject || "(vuoto)"}
Estratto:
${(input.snippet || "(vuoto)").slice(0, 800)}`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = getCorsHeaders(origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Estrae batch di job pending (lock pessimistico via update returning) ──
  const { data: jobs, error: jobsErr } = await supabase
    .from("inbound_enrichment_queue")
    .update({ status: "processing", attempts: 1 })
    .eq("status", "pending")
    .select("id, user_id, message_id, from_address, domain, attempts")
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (jobsErr) {
    return new Response(JSON.stringify({ error: jobsErr.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (!jobs || jobs.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let done = 0;
  let failed = 0;

  // Audit Sez.1 — D: prompt dal Prompt Lab (scope=funnemail_classifier), fallback hardcoded.
  // Caricato 1 sola volta per batch — risparmio I/O e token.
  let systemPrompt = PROMPT_SYSTEM_FALLBACK;
  try {
    const { block } = await loadOperativePrompts(supabase, jobs[0]?.user_id ?? "", {
      scope: "funnemail_classifier",
      extraTags: ["inbound", "classification"],
      includeUniversal: false,
      limit: 3,
    });
    if (block && block.length > 80) {
      systemPrompt = `${PROMPT_SYSTEM_FALLBACK}\n\n${block}`;
    }
  } catch (_e) { /* keep fallback */ }

  for (const job of jobs as Array<{
    id: string;
    user_id: string;
    message_id: string;
    from_address: string;
    domain: string | null;
    attempts: number;
  }>) {
    try {
      // Carica il messaggio
      const { data: msg } = await supabase
        .from("channel_messages")
        .select("subject, body_text, from_address")
        .eq("id", job.message_id)
        .maybeSingle();

      if (!msg) {
        await supabase
          .from("inbound_enrichment_queue")
          .update({ status: "skipped", processed_at: new Date().toISOString(), last_error: "message_not_found" })
          .eq("id", job.id);
        continue;
      }

      const m = msg as { subject?: string | null; body_text?: string | null; from_address?: string | null };

      const result = await callLLM({
        functionName: "process-inbound-enrichment",
        userId: job.user_id,
        models: ["google/gemini-2.5-flash"],
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: buildUserPrompt({
              from: job.from_address,
              domain: job.domain ?? "",
              subject: m.subject ?? "",
              snippet: m.body_text ?? "",
            }),
          },
        ],
        temperature: 0.2,
        scope: "inbound-enrichment",
        action: "classify",
        groupCategory: "cron",
        isCron: true,
      });

      const parsedRes = safeParseAiJson(result.content ?? "", SuggestionSchema, {
        fnName: "process-inbound-enrichment",
        model: "google/gemini-2.5-flash",
        fallback: {
          category: "altro",
          reason: "fallback",
          confidence: 0,
          suggested_group: null,
        } as Suggestion,
      });
      const parsed = parsedRes.data;

      await supabase
        .from("channel_messages")
        .update({
          ai_classification_suggestion: {
            ...parsed,
            generated_at: new Date().toISOString(),
            model: "google/gemini-2.5-flash",
          },
        })
        .eq("id", job.message_id);

      await supabase
        .from("inbound_enrichment_queue")
        .update({
          status: "done",
          processed_at: new Date().toISOString(),
          result: parsed as unknown as Record<string, unknown>,
        })
        .eq("id", job.id);

      done++;
    } catch (e) {
      failed++;
      const msg = e instanceof Error ? e.message : String(e);
      const next = (job.attempts ?? 0) + 1;
      await supabase
        .from("inbound_enrichment_queue")
        .update({
          status: next >= MAX_ATTEMPTS ? "error" : "pending",
          attempts: next,
          last_error: msg.slice(0, 500),
        })
        .eq("id", job.id);
    }
  }

  return new Response(JSON.stringify({ processed: jobs.length, done, failed }), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});