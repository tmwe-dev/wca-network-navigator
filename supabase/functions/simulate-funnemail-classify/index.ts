/**
 * simulate-funnemail-classify — Read-only dry-run del flusso di classificazione inbound.
 *
 * Replica gli stage chiave di `classify-inbound-message` (injection guard, normalizzazione,
 * AI classification, scout dominio, routing) ma **senza** scrivere su tabelle business
 * (messages / partners / contacts / email_messages / reply_classifications).
 *
 * Tracciamento: ogni step viene loggato su `pipeline_traces` con
 * `entity_type = 'email_simulation'` per essere distinto dalle pipeline reali.
 *
 * Auth: JWT operatore obbligatoria (lab tool, no service role).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics } from "../_shared/monitoring.ts";
import { detectInjection } from "../_shared/promptSanitizer.ts";
import { normalizeContent } from "../_shared/contentNormalizer.ts";
import { safeWrap } from "../_shared/promptSanitizer.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import { createTracer, newTraceId } from "../_shared/pipelineTrace.ts";
import { aiFetch } from "../_shared/aiCallShim.ts";

const CLASSIFICATIONS = [
  "interested", "not_interested", "neutral", "question",
  "objection", "ooo", "bounce", "spam", "unsubscribe",
] as const;
const SENTIMENTS = ["positive", "neutral", "negative"] as const;
const URGENCIES = ["low", "normal", "high"] as const;

interface SimulateBody {
  from?: string;
  subject?: string;
  body?: string;
  channel?: "email" | "whatsapp" | "linkedin";
}

interface AuthOk { userId: string; }

async function authenticate(req: Request, corsH: Record<string, string>): Promise<AuthOk | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
  const sb = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } },
  );
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsH, "Content-Type": "application/json" },
    });
  }
  return { userId: data.claims.sub };
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const corsH = getCorsHeaders(req.headers.get("origin"));
  const headers = getSecurityHeaders({ ...corsH, "Content-Type": "application/json" });
  const metrics = startMetrics("simulate-funnemail-classify");

  try {
    const auth = await authenticate(req, corsH);
    if (auth instanceof Response) { endMetrics(metrics, false, auth.status); return auth; }

    const body = (await req.json().catch(() => ({}))) as SimulateBody;
    const channel = body.channel ?? "email";
    const from = (body.from ?? "").trim();
    const subject = (body.subject ?? "").trim();
    const text = (body.body ?? "").trim();

    if (!from || !text) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "from + body required" }), { status: 400, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const traceId = newTraceId();
    const tracer = createTracer(supabase, {
      traceId,
      entityType: "email_simulation",
      entityId: traceId,
      entityLabel: subject || from,
      operatorId: auth.userId,
    });

    await tracer.step("simulate:received", {
      input: { from, subject, channel, bodyChars: text.length },
      status: "started",
    });

    // ── Stage 1: Injection guard (detection only, no DB review) ──
    const t1 = Date.now();
    const findings = detectInjection(`${subject}\n${text}`);
    const highSeverity = findings.some((f) => f.severity === "high");
    const blocked = highSeverity;
    await tracer.step("simulate:injection_guard", {
      input: { sample: text.slice(0, 200) },
      output: { findings, blocked, count: findings.length },
      status: blocked ? "error" : "success",
      durationMs: Date.now() - t1,
    });

    // ── Stage 2: Normalizzazione contenuto ──
    const t2 = Date.now();
    const normSubject = normalizeContent(subject, { source: "email-inbound", maxChars: 300 });
    const normBody = normalizeContent(text, { source: "email-inbound", maxChars: 3000 });
    const { block: bodyWrapped } = safeWrap(normBody.text, "INBOUND BODY", {
      source: "email-inbound", policy: "redact",
    });
    await tracer.step("simulate:normalize", {
      input: { rawSubjectChars: subject.length, rawBodyChars: text.length },
      output: {
        subjectNorm: normSubject.text,
        bodyNormPreview: normBody.text.slice(0, 400),
        steps: normBody.report.steps,
        truncated: normBody.report.truncated,
      },
      durationMs: Date.now() - t2,
    });

    // ── Stage 3: Carica prompt operativi (Prompt Lab) ──
    const t3 = Date.now();
    let promptLabBlock = "";
    let appliedNames: string[] = [];
    try {
      const opResult = await loadOperativePrompts(supabase, auth.userId, {
        scope: "classification",
        channel,
        extraTags: ["system", "inbound"],
        includeUniversal: true,
        limit: 6,
      });
      promptLabBlock = opResult.block ?? "";
      appliedNames = opResult.appliedNames ?? [];
    } catch (e) {
      await tracer.step("simulate:prompt_lab_load", {
        status: "error", errorMessage: (e as Error).message, durationMs: Date.now() - t3,
      });
    }
    await tracer.step("simulate:prompt_lab_load", {
      output: { appliedNames, promptChars: promptLabBlock.length },
      durationMs: Date.now() - t3,
    });

    // ── Stage 4: AI classification ──
    const channelHint = channel === "whatsapp"
      ? "This is a WhatsApp message (short, informal)."
      : channel === "linkedin"
      ? "This is a LinkedIn message (professional networking)."
      : "This is an email reply (business communication).";
    const fallbackSys = `You are a B2B inbound message classifier for a logistics CRM.\n${channelHint}\n\nClassify the message and extract structured metadata using the provided tool.`;
    const systemPrompt = promptLabBlock
      ? `${channelHint}\n\n${promptLabBlock}`
      : fallbackSys;
    const userPrompt = `Channel: ${channel}\nFrom: ${from}\nSubject: ${normSubject.text || "(none)"}\nBody:\n${bodyWrapped}`;

    const t4 = Date.now();
    const LOVABLE_API_KEY = (Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("LOVABLE_API_KEY"));
    const model = "google/gemini-3-flash-preview";
    let classification: Record<string, unknown> = {
      classification: "neutral", confidence: 0, sentiment: "neutral",
      urgency: "normal", intent: "", reasoning: "No API key (skipped)",
    };
    let aiError: string | null = null;
    if (LOVABLE_API_KEY && !blocked) {
      try {
        const r = await aiFetch({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [{
              type: "function",
              function: {
                name: "classify_message",
                description: "Classify the inbound message",
                parameters: {
                  type: "object",
                  properties: {
                    classification: { type: "string", enum: [...CLASSIFICATIONS] },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    sentiment: { type: "string", enum: [...SENTIMENTS] },
                    urgency: { type: "string", enum: [...URGENCIES] },
                    intent: { type: "string" },
                    reasoning: { type: "string" },
                  },
                  required: ["classification", "confidence", "sentiment", "urgency", "reasoning"],
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "classify_message" } },
          });
        const j = await r.json();
        const args = j?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) classification = JSON.parse(args);
      } catch (e) {
        aiError = (e as Error).message;
      }
    }
    await tracer.step("simulate:ai_classify", {
      input: { systemPromptChars: systemPrompt.length, userPromptPreview: userPrompt.slice(0, 500) },
      output: { ...classification, _systemPrompt: systemPrompt, _userPrompt: userPrompt },
      status: aiError ? "error" : "success",
      errorMessage: aiError,
      aiModel: model, aiScope: "classification",
      durationMs: Date.now() - t4,
    });

    // ── Stage 5: Scout dominio mittente (read-only) ──
    const t5 = Date.now();
    const domain = from.includes("@") ? from.split("@")[1].toLowerCase() : "";
    let knownPartner: { id: string; name: string | null } | null = null;
    let domainGroupHint: string | null = null;
    if (domain) {
      const { data: p } = await supabase
        .from("partners")
        .select("id, name")
        .ilike("email", `%@${domain}`)
        .limit(1)
        .maybeSingle();
      if (p) knownPartner = { id: p.id as string, name: (p.name as string) ?? null };
      const { data: rule } = await supabase
        .from("email_sender_rules")
        .select("group_name, action")
        .or(`sender_pattern.eq.${domain},sender_pattern.eq.@${domain}`)
        .limit(1)
        .maybeSingle();
      if (rule) domainGroupHint = (rule as { group_name?: string }).group_name ?? null;
    }
    await tracer.step("simulate:scout_domain", {
      input: { domain },
      output: { knownPartner, domainGroupHint },
      durationMs: Date.now() - t5,
    });

    // ── Stage 6: Routing decision (proposta) ──
    const t6 = Date.now();
    const cls = (classification.classification as string) ?? "neutral";
    let proposedGroup = domainGroupHint ?? "Inbox";
    let proposedAction = "review";
    if (cls === "spam") { proposedGroup = "Spam"; proposedAction = "auto_archive"; }
    else if (cls === "unsubscribe") { proposedGroup = "Unsubscribe"; proposedAction = "auto_unsubscribe"; }
    else if (cls === "bounce") { proposedGroup = "Bounces"; proposedAction = "mark_bounce"; }
    else if (cls === "ooo") { proposedGroup = "OOO"; proposedAction = "ignore"; }
    else if (cls === "interested") { proposedAction = "notify_human"; }
    await tracer.step("simulate:routing", {
      input: { classification: cls, domainGroupHint },
      output: { proposedGroup, proposedAction, knownPartnerId: knownPartner?.id ?? null },
      durationMs: Date.now() - t6,
    });

    // ── Verdict finale ──
    const verdict = {
      traceId,
      classification,
      proposedGroup,
      proposedAction,
      knownPartner,
      domain,
      injectionBlocked: blocked,
    };
    await tracer.step("simulate:verdict", {
      output: verdict, status: "success", durationMs: 0,
    });

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({ ok: true, ...verdict }), { status: 200, headers });
  } catch (e) {
    endMetrics(metrics, false, 500);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers },
    );
  }
});