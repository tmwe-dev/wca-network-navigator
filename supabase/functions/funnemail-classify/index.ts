/**
 * funnemail-classify — Classifica un'email inbound nelle cartelle del client
 * Funnemail e decide azione, agenda, handoff commerciale.
 *
 * La logica vive nel prompt operativo `funnemail_classifier` (operative_prompts).
 * Le cartelle disponibili vengono lette runtime da `funnemail_folders`.
 * NESSUNA lista hardcoded.
 *
 * Output: una riga in `funnemail_decisions` (idempotente per message_id).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";
import { startMetrics, endMetrics, logEdgeError } from "../_shared/monitoring.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";
import { normalizeContent } from "../_shared/contentNormalizer.ts";
import { safeWrap } from "../_shared/promptSanitizer.ts";
import { requireInternalOrUser } from "../_shared/internalAuth.ts";

interface RequestBody {
  message_id: string;
  from_address: string;
  subject?: string;
  body_text?: string;
  partner_id?: string | null;
  user_id?: string | null;
  prior_classification?: string;
  prior_intent?: string;
  /** Intel mittente arricchita dallo Scout (cache funnemail_sender_intel). */
  sender_intel?: {
    known?: boolean;
    partner_id?: string | null;
    company_type?: string | null;
    country?: string | null;
    website?: string | null;
    role_guess?: string | null;
  } | null;
  force?: boolean;
}

const ResultSchema = z.object({
  folder_slug: z.string().min(1).max(60),
  suggested_action: z.enum(["none","archive","draft_reply","forward","escalate","notify_human"]),
  goes_to_agenda: z.boolean(),
  urgency: z.enum(["critical","high","normal","low"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(400).default(""),
  commercial_handoff: z.boolean().default(false),
});

type Folder = {
  slug: string;
  label: string;
  section: string;
  accept_into_agenda: boolean;
  prompt_hint: string | null;
};

function fallback(folders: Folder[]): z.infer<typeof ResultSchema> {
  const hasToSort = folders.find((f) => f.slug === "to_sort");
  return {
    folder_slug: hasToSort?.slug ?? folders[0]?.slug ?? "to_sort",
    suggested_action: "notify_human",
    goes_to_agenda: false,
    urgency: "normal",
    confidence: 0.0,
    reasoning: "fallback: classifier unavailable",
    commercial_handoff: false,
  };
}

Deno.serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const headers = getSecurityHeaders(getCorsHeaders(req.headers.get("origin")));
  const metrics = startMetrics("funnemail-classify");

  try {
    const body: RequestBody = await req.json();
    if (!body.message_id || !body.from_address) {
      endMetrics(metrics, false, 400);
      return new Response(JSON.stringify({ error: "message_id+from_address required" }), { status: 400, headers });
    }

    // Auth: JWT utente OPPURE token interno server-to-server (orchestrazione)
    const auth = await requireInternalOrUser(req, body.user_id ?? null, headers);
    if (auth.kind === "error") {
      endMetrics(metrics, false, 401);
      return auth.response;
    }
    // Per chiamate utente, il user_id deve coincidere o essere assente
    if (auth.kind === "user") {
      if (body.user_id && body.user_id !== auth.userId) {
        endMetrics(metrics, false, 403);
        return new Response(JSON.stringify({ error: "Forbidden: user_id mismatch" }), { status: 403, headers });
      }
      body.user_id = auth.userId;
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Idempotenza: se esiste già, ritorna quella decisione
    const { data: existing } = await supabase
      .from("funnemail_decisions")
      .select("*")
      .eq("message_id", body.message_id)
      .maybeSingle();
    if (existing && !body.force) {
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, decision: existing, cached: true }), { status: 200, headers });
    }

    // Carica cartelle attive (no hardcode)
    const { data: foldersRaw } = await supabase
      .from("funnemail_folders")
      .select("slug,label,section,accept_into_agenda,prompt_hint")
      .eq("is_active", true)
      .order("section")
      .order("sort_order");
    const folders = (foldersRaw ?? []) as Folder[];
    if (folders.length === 0) {
      const dec = fallback([]);
      await supabase.from("funnemail_decisions").insert({
        message_id: body.message_id,
        user_id: body.user_id ?? null,
        partner_id: body.partner_id ?? null,
        from_address: body.from_address,
        ...dec,
      });
      endMetrics(metrics, true, 200);
      return new Response(JSON.stringify({ ok: true, decision: dec, fallback: "no_folders" }), { status: 200, headers });
    }

    // Prompt operativo "funnemail_classifier" dal Prompt Lab
    let operativeBlock = "";
    if (body.user_id) {
      try {
        const op = await loadOperativePrompts(supabase, body.user_id, {
          scope: "funnemail_classifier",
          includeUniversal: true,
          limit: 3,
        });
        if (op.block) operativeBlock = op.block;
      } catch (_e) { /* non-fatal */ }
    }

    const foldersList = folders.map((f) =>
      `- ${f.slug} | ${f.label} | section=${f.section} | agenda=${f.accept_into_agenda} | hint: ${f.prompt_hint ?? ""}`,
    ).join("\n");

    const subjNorm = normalizeContent(body.subject ?? "", { source: "email-inbound", maxChars: 300 }).text;
    const bodyNorm = normalizeContent(body.body_text ?? "", { source: "email-inbound", maxChars: 3000 });
    const wrappedBody = safeWrap(bodyNorm.text, "INBOUND BODY", { source: "email-inbound", policy: "redact" }).block;

    const systemPrompt = [
      "Sei Funnemail, il classificatore inbound del client di posta.",
      "Devi smistare la mail in UNA cartella esistente e decidere azione/agenda/handoff commerciale.",
      operativeBlock || "",
    ].filter(Boolean).join("\n\n");

    const senderIntelLine = body.sender_intel
      ? `SENDER_INTEL:\n- known_partner=${body.sender_intel.known ?? false}\n- company_type=${body.sender_intel.company_type ?? "unknown"}\n- role_guess=${body.sender_intel.role_guess ?? "unknown"}\n- country=${body.sender_intel.country ?? "n/a"}\n- website=${body.sender_intel.website ?? "n/a"}`
      : "SENDER_INTEL: (non disponibile)";
    const userPrompt = `FOLDERS:\n${foldersList}\n\n${senderIntelLine}\n\nMITTENTE: ${body.from_address}\nOGGETTO: ${subjNorm || "(vuoto)"}\nCORPO:\n${wrappedBody}\n\nClassifica usando lo strumento.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let decision: z.infer<typeof ResultSchema> = fallback(folders);
    let model = "google/gemini-3-flash-preview";

    if (LOVABLE_API_KEY) {
      const validSlugs = folders.map((f) => f.slug);
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
                name: "classify_into_folder",
                description: "Classifica l'email in una cartella Funnemail",
                parameters: {
                  type: "object",
                  properties: {
                    folder_slug: { type: "string", enum: validSlugs },
                    suggested_action: { type: "string", enum: ["none","archive","draft_reply","forward","escalate","notify_human"] },
                    goes_to_agenda: { type: "boolean" },
                    urgency: { type: "string", enum: ["critical","high","normal","low"] },
                    confidence: { type: "number", minimum: 0, maximum: 1 },
                    reasoning: { type: "string", maxLength: 400 },
                    commercial_handoff: { type: "boolean" },
                  },
                  required: ["folder_slug","suggested_action","goes_to_agenda","urgency","confidence","reasoning","commercial_handoff"],
                  additionalProperties: false,
                },
              },
            }],
            tool_choice: { type: "function", function: { name: "classify_into_folder" } },
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
          if (args) {
            const parsed = ResultSchema.safeParse(JSON.parse(args));
            if (parsed.success) {
              decision = parsed.data;
              // Hard guard: se cartella è archive, mai in agenda
              const folderMeta = folders.find((f) => f.slug === decision.folder_slug);
              if (!folderMeta || folderMeta.section === "archive") decision.goes_to_agenda = false;
              if (folderMeta && !folderMeta.accept_into_agenda) decision.goes_to_agenda = false;
            }
          }
        } else if (resp.status === 429 || resp.status === 402) {
          decision = { ...fallback(folders), reasoning: `AI gateway ${resp.status}` };
        }
      } catch (e) {
        decision = { ...fallback(folders), reasoning: `AI exception: ${e instanceof Error ? e.message : String(e)}` };
      }
    }

    // Se esiste già una decisione (force=true), aggiorna; altrimenti insert.
    const decisionRow = {
      message_id: body.message_id,
      user_id: body.user_id ?? null,
      partner_id: body.partner_id ?? body.sender_intel?.partner_id ?? null,
      from_address: body.from_address,
      folder_slug: decision.folder_slug,
      suggested_action: decision.suggested_action,
      goes_to_agenda: decision.goes_to_agenda,
      urgency: decision.urgency,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      commercial_handoff: decision.commercial_handoff,
      model,
    };
    if (existing && body.force) {
      await supabase.from("funnemail_decisions")
        .update(decisionRow)
        .eq("message_id", body.message_id);
    } else {
      await supabase.from("funnemail_decisions").insert(decisionRow);
    }

    endMetrics(metrics, true, 200);
    return new Response(JSON.stringify({ ok: true, decision }), { status: 200, headers });
  } catch (error: unknown) {
    logEdgeError("funnemail-classify", error);
    endMetrics(metrics, false, 500);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers },
    );
  }
});