/**
 * funnemail-auto-route — Auto-instradamento mail nei gruppi mittente dell'utente.
 *
 * Si attiva fire-and-forget da classify-inbound-message dopo la classificazione.
 * Logica:
 *  1. Se il mittente ha già una `email_address_rules.group_id` → skip (nulla da fare).
 *  2. Carica i gruppi `email_sender_groups` dell'utente con i loro hint.
 *  3. Chiede a Lovable AI di scegliere il gruppo migliore.
 *  4. confidenza ≥ 0.85 → upsert `email_address_rules` (auto-instrada anche le prossime).
 *     0.60–0.85 → solo suggerimento in `channel_messages.ai_classification_suggestion`.
 *     < 0.60 → nessuna azione (resta in "Non classificate").
 *
 * Idempotente: se la rule esiste già con group_id valorizzato, esce subito.
 * Fail-safe: errori loggati ma mai bloccanti per il caller.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { normalizeContent } from "../_shared/contentNormalizer.ts";
import { safeWrap } from "../_shared/promptSanitizer.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";

interface RequestBody {
  message_id: string;
  from_address: string;
  subject?: string;
  body_text?: string;
  user_id: string;
}

const ResultSchema = z.object({
  group_name: z.string().min(1).max(120),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(280).default(""),
});

const AUTO_APPLY_THRESHOLD = 0.85;
const SUGGEST_THRESHOLD = 0.60;
const FALLBACK_GENERIC_DOMAINS = new Set<string>([
  "gmail.com","googlemail.com","outlook.com","hotmail.com","live.com",
  "libero.it","virgilio.it","tiscali.it","alice.it","tin.it",
  "yahoo.com","yahoo.it","aol.com","icloud.com","me.com",
  "proton.me","protonmail.com","gmx.com","gmx.de","mail.com","pec.it",
]);

function lc(s: string | null | undefined): string {
  return (s || "").trim().toLowerCase();
}
function domainOf(addr: string): string {
  const a = lc(addr);
  const i = a.lastIndexOf("@");
  return i >= 0 ? a.slice(i + 1) : "";
}

/** Sprint 4: valuta una condizione singola contro il payload inbound. */
interface RuleCondition {
  field: "from_address" | "domain" | "subject" | "body" | string;
  op: "equals" | "contains" | "regex" | "in" | "starts_with" | "ends_with" | string;
  value: unknown;
}
function evalCondition(cond: RuleCondition, ctx: Record<string, string>): boolean {
  const haystack = lc(ctx[cond.field] ?? "");
  const needle = cond.value;
  switch (cond.op) {
    case "equals":   return haystack === lc(String(needle ?? ""));
    case "contains": return haystack.includes(lc(String(needle ?? "")));
    case "starts_with": return haystack.startsWith(lc(String(needle ?? "")));
    case "ends_with":   return haystack.endsWith(lc(String(needle ?? "")));
    case "in":       return Array.isArray(needle) && needle.map((v) => lc(String(v))).includes(haystack);
    case "regex": {
      try { return new RegExp(String(needle), "i").test(haystack); } catch { return false; }
    }
    default: return false;
  }
}
function evalRule(conditions: unknown, ctx: Record<string, string>): boolean {
  if (!Array.isArray(conditions) || conditions.length === 0) return false;
  return (conditions as RuleCondition[]).every((c) => evalCondition(c, ctx));
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const headers = getSecurityHeaders(getCorsHeaders(req.headers.get("origin")));
  const metrics = startMetrics("funnemail-auto-route");

  try {
    const body: RequestBody = await req.json();
    if (!body.message_id || !body.from_address || !body.user_id) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "message_id+from_address+user_id required" }), { status: 400, headers });
    }

    // Auth: JWT utente o token interno server-to-server
    const auth = await requireInternalOrUser(req, body.user_id, headers);
    if (auth.kind === "error") {
      endMetrics(metrics, false, 401);
      return auth.response;
    }
    if (auth.kind === "user" && body.user_id !== auth.userId) {
      endMetrics(metrics, false, 403);
      return new Response(JSON.stringify({ error: "Forbidden: user_id mismatch" }), { status: 403, headers });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const addr = lc(body.from_address);
    const dom = domainOf(addr);

    // S6 — domain guard: carica config (fallback su set built-in se assente).
    let genericDomains: Set<string> = FALLBACK_GENERIC_DOMAINS;
    let genericMinConfidence = 0.95;
    try {
      const { data: cfg } = await supabase
        .from("funnemail_routing_config")
        .select("generic_domains, generic_domain_min_confidence")
        .eq("user_id", body.user_id)
        .maybeSingle();
      if (cfg?.generic_domains?.length) {
        genericDomains = new Set<string>((cfg.generic_domains as string[]).map(lc));
      }
      if (typeof cfg?.generic_domain_min_confidence === "number") {
        genericMinConfidence = Number(cfg.generic_domain_min_confidence);
      }
    } catch (_) { /* fail-safe: usa default */ }
    const isGenericDomain = genericDomains.has(dom);

    // 1) Già instradato? skip.
    const { data: existingByAddr } = await supabase
      .from("email_address_rules")
      .select("id, group_id, group_name")
      .eq("user_id", body.user_id)
      .eq("email_address", addr)
      .maybeSingle();
    if (existingByAddr?.group_id) {
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, skipped: "already_routed", group: existingByAddr.group_name }), { status: 200, headers });
    }

    // 2) Match per dominio (sender stesso dominio già classificato)?
    if (dom) {
      const { data: domRule } = await supabase
        .from("email_address_rules")
        .select("group_id, group_name, group_color, group_icon")
        .eq("user_id", body.user_id)
        .eq("domain", dom)
        .not("group_id", "is", null)
        .order("email_count", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (domRule?.group_id) {
        await applyRule(supabase, body.user_id, addr, dom, {
          group_id: domRule.group_id,
          group_name: domRule.group_name,
          group_color: domRule.group_color,
          group_icon: domRule.group_icon,
        }, "domain_match");
        endMetrics(metrics, true, 200);
        return new Response(JSON.stringify({ ok: true, applied: true, source: "domain_match", group: domRule.group_name }), { status: 200, headers });
      }
    }

    // 3) Carica gruppi utente
    const { data: groups } = await supabase
      .from("email_sender_groups")
      .select("id, nome_gruppo, descrizione, classification_hint, colore, icon")
      .eq("user_id", body.user_id);
    if (!groups || groups.length === 0) {
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, skipped: "no_groups" }), { status: 200, headers });
    }

    // 4) Chiedi all'AI in quale gruppo va la mail
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, skipped: "no_ai_key" }), { status: 200, headers });
    }

    const groupsList = groups.map((g) => {
      const parts = [
        `- ${String(g.nome_gruppo)}`,
        g.descrizione ? `descr: ${String(g.descrizione).trim()}` : null,
        g.classification_hint ? `hint: ${String(g.classification_hint).trim()}` : null,
      ].filter(Boolean);
      return parts.join(" | ");
    }).join("\n");
    const validNames = groups.map((g) => String(g.nome_gruppo));

    const subjNorm = normalizeContent(body.subject ?? "", { source: "email-inbound", maxChars: 240 }).text;
    const bodyNorm = normalizeContent(body.body_text ?? "", { source: "email-inbound", maxChars: 1800 });
    const wrappedBody = safeWrap(bodyNorm.text, "INBOUND BODY", { source: "email-inbound", policy: "redact" }).block;

    const systemPrompt = [
      "Sei il dispatcher mittenti di Funnemail.",
      "Devi assegnare la mail a UNO dei gruppi mittente esistenti dell'utente.",
      "Usa SOLO i nomi nella lista FORNITA. Mai inventare nomi.",
      "Se nessun gruppo è chiaramente adatto, scegli quello meno specifico (es. CLIENTI, FORNITORI, Newsletter) ma con confidence bassa (<0.6).",
    ].join("\n");
    const userPrompt = `GRUPPI DISPONIBILI:\n${groupsList}\n\nMITTENTE: ${addr}\nDOMINIO: ${dom || "(n/a)"}\nOGGETTO: ${subjNorm || "(vuoto)"}\nCORPO:\n${wrappedBody}\n\nAssegna usando lo strumento.`;

    let chosen: z.infer<typeof ResultSchema> | null = null;
    try {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "assign_to_group",
              description: "Assegna l'email mittente a un gruppo dell'utente",
              parameters: {
                type: "object",
                properties: {
                  group_name: { type: "string", enum: validNames },
                  confidence: { type: "number", minimum: 0, maximum: 1 },
                  reasoning: { type: "string", maxLength: 280 },
                },
                required: ["group_name", "confidence", "reasoning"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "assign_to_group" } },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
        if (args) {
          const parsed = ResultSchema.safeParse(JSON.parse(args));
          if (parsed.success) chosen = parsed.data;
        }
      }
    } catch (_e) { /* fail-safe */ }

    if (!chosen) {
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, skipped: "ai_unavailable" }), { status: 200, headers });
    }

    const matchedGroup = groups.find((g) => String(g.nome_gruppo) === chosen!.group_name);
    if (!matchedGroup) {
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, skipped: "group_not_found" }), { status: 200, headers });
    }

    // 5) Auto-apply o solo suggest in base alla soglia
    const effectiveAutoApplyThreshold = isGenericDomain
      ? Math.max(AUTO_APPLY_THRESHOLD, genericMinConfidence)
      : AUTO_APPLY_THRESHOLD;

    if (chosen.confidence >= effectiveAutoApplyThreshold) {
      await applyRule(supabase, body.user_id, addr, dom, {
        group_id: matchedGroup.id as string,
        group_name: matchedGroup.nome_gruppo as string,
        group_color: (matchedGroup.colore as string) ?? null,
        group_icon: (matchedGroup.icon as string) ?? null,
      }, "ai_auto");
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, applied: true, source: "ai_auto", group: chosen.group_name, confidence: chosen.confidence, generic_domain: isGenericDomain }), { status: 200, headers });
    }

    if (chosen.confidence >= SUGGEST_THRESHOLD) {
      // Suggest-only: scrive ai_classification_suggestion sul messaggio
      await supabase
        .from("channel_messages")
        .update({
          ai_classification_suggestion: {
            suggested_group: chosen.group_name,
            confidence: chosen.confidence,
            reason: chosen.reasoning,
            source: "funnemail-auto-route",
            generic_domain: isGenericDomain,
            min_threshold_used: effectiveAutoApplyThreshold,
            at: new Date().toISOString(),
          },
        })
        .eq("id", body.message_id);
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, suggested: true, group: chosen.group_name, confidence: chosen.confidence }), { status: 200, headers });
    }

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({ ok: true, skipped: "low_confidence", confidence: chosen.confidence }), { status: 200, headers });
  } catch (error: unknown) {
    logEdgeError("funnemail-auto-route", error);
    endMetrics(metrics, false, 500);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), { status: 500, headers });
  }
});

/** Upsert email_address_rules con il gruppo scelto. */
async function applyRule(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  addr: string,
  dom: string,
  group: { group_id: string; group_name: string; group_color: string | null; group_icon: string | null },
  source: string,
): Promise<void> {
  const payload = {
    user_id: userId,
    email_address: addr,
    domain: dom || null,
    group_id: group.group_id,
    group_name: group.group_name,
    group_color: group.group_color,
    group_icon: group.group_icon,
    notes: `auto-routed by ${source} on ${new Date().toISOString().slice(0, 10)}`,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  await supabase
    .from("email_address_rules")
    .upsert(payload, { onConflict: "user_id,email_address" });
}