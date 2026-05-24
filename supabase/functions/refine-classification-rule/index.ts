import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { z, safeParseToolArgs } from "../_shared/aiJsonValidator.ts";
import { aiFetch } from "../_shared/aiCallShim.ts";

/**
 * Refiner: quando l'utente sceglie un gruppo diverso dal suggerimento AI,
 * analizza un campione di email del mittente e propone una modifica di
 * regola/prompt per evitare lo stesso errore in futuro.
 * Risultato salvato in ai_classification_insights con status=pending.
 * Scope AI: learning.classification.refine (governance Charter).
 */

const RefineSchema = z.object({
  proposed_target: z.enum(["group", "prompt"]).default("group"),
  proposed_change_text: z.string().min(3).max(600),
  reasoning: z.string().max(800).default(""),
  confidence: z.number().min(0).max(1).default(0.5),
});

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const dynCors = getCorsHeaders(req.headers.get("origin"));

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const anon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anon.auth.getUser();
    if (userErr || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), {
        status: 401,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json();
    const addressRuleId: string | undefined = body.address_rule_id;
    const chosenGroupId: string | undefined = body.chosen_group_id;
    const userNote: string | undefined = body.user_note;
    if (!addressRuleId || !chosenGroupId) {
      return new Response(JSON.stringify({ error: "address_rule_id and chosen_group_id required" }), {
        status: 400,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Carica regola, gruppi, campioni email
    const { data: rule } = await supabase
      .from("email_address_rules")
      .select("id, email_address, display_name, company_name, domain, ai_suggested_group, ai_suggestion_confidence")
      .eq("id", addressRuleId)
      .maybeSingle();
    if (!rule) {
      return new Response(JSON.stringify({ error: "rule not found" }), {
        status: 404,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // Skip se l'AI non aveva fatto un suggerimento (nessuna correzione)
    const aiSuggested = (rule.ai_suggested_group as string | null) ?? null;
    if (!aiSuggested) {
      return new Response(JSON.stringify({ skipped: "no_ai_suggestion" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const { data: chosenGroup } = await supabase
      .from("email_sender_groups")
      .select("id, nome_gruppo, descrizione, classification_hint")
      .eq("id", chosenGroupId)
      .maybeSingle();
    if (!chosenGroup) {
      return new Response(JSON.stringify({ error: "chosen group not found" }), {
        status: 404,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    if (chosenGroup.nome_gruppo === aiSuggested) {
      return new Response(JSON.stringify({ skipped: "no_correction" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const { data: aiGroup } = await supabase
      .from("email_sender_groups")
      .select("id, nome_gruppo, descrizione, classification_hint")
      .eq("nome_gruppo", aiSuggested)
      .limit(1)
      .maybeSingle();

    // Campiona ultime 5 email del mittente
    const { data: messages } = await supabase
      .from("channel_messages")
      .select("id, subject, body_text, email_date")
      .eq("channel", "email")
      .eq("direction", "inbound")
      .ilike("from_address", `%${rule.email_address}%`)
      .order("email_date", { ascending: false })
      .limit(5);

    const samples = (messages ?? []).map((m: Record<string, unknown>) => ({
      id: String(m.id),
      subject: String(m.subject ?? "").slice(0, 180),
      excerpt: String(m.body_text ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
    }));

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI_NOT_CONFIGURED" }), {
        status: 500,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = [
      "Sei il Refiner del classificatore email per TMWE / Find Air.",
      "Il classificatore ha sbagliato gruppo per un mittente. L'operatore ha corretto.",
      "Tuo compito: capire il PERCHÉ qualitativo dell'errore analizzando i campioni email reali, e proporre UNA singola modifica testuale (max 2-3 frasi) da appendere come hint di classificazione al gruppo corretto, oppure al prompt operativo.",
      "Concentrati su distinzioni semantiche (es. 'broadcast di listini ≠ comunicazione amministrativa 1-a-1') non su pattern di dominio.",
      "Sii conciso, professionale, in italiano. Niente preamboli.",
    ].join("\n");

    const userPrompt = [
      `Mittente: ${rule.email_address} (${rule.display_name ?? rule.company_name ?? "—"}, dominio ${rule.domain ?? "?"})`,
      `\nGruppo suggerito (errato): ${aiSuggested}`,
      aiGroup?.descrizione ? `Descrizione gruppo errato: ${aiGroup.descrizione}` : "",
      aiGroup?.classification_hint ? `Hint attuale gruppo errato: ${aiGroup.classification_hint}` : "",
      `\nGruppo scelto dall'utente (corretto): ${chosenGroup.nome_gruppo}`,
      chosenGroup.descrizione ? `Descrizione gruppo corretto: ${chosenGroup.descrizione}` : "",
      chosenGroup.classification_hint ? `Hint attuale gruppo corretto: ${chosenGroup.classification_hint}` : "",
      userNote ? `\nNota dell'operatore: ${userNote}` : "",
      `\nCampioni email recenti dal mittente:`,
      ...samples.map((s, i) => `[${i + 1}] Oggetto: ${s.subject}\n    Estratto: ${s.excerpt}`),
      "",
      "Produci la modifica più utile per evitare lo stesso errore in futuro.",
    ].filter(Boolean).join("\n");

    const aiResp = await aiFetch({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "propose_rule_refinement",
            description: "Propone una modifica testuale alla regola di classificazione",
            parameters: {
              type: "object",
              properties: {
                proposed_target: { type: "string", enum: ["group", "prompt"], description: "group = aggiungi hint al gruppo corretto; prompt = aggiungi regola al prompt operativo" },
                proposed_change_text: { type: "string", description: "Testo della modifica, 2-3 frasi max" },
                reasoning: { type: "string", description: "Perché l'AI ha sbagliato" },
                confidence: { type: "number" },
              },
              required: ["proposed_target", "proposed_change_text", "reasoning", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "propose_rule_refinement" } },
      });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("[refine] ai gateway error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI_GATEWAY_ERROR" }), {
        status: 502,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ skipped: "no_tool_call" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const r = safeParseToolArgs(toolCall.function.arguments, RefineSchema, {
      fnName: "refine-classification-rule",
      model: "google/gemini-2.5-flash",
      fallback: { proposed_target: "group" as const, proposed_change_text: "", reasoning: "", confidence: 0 },
    });
    if (r.isFallback || !r.data.proposed_change_text || r.data.confidence < 0.5) {
      return new Response(JSON.stringify({ skipped: "low_confidence_or_empty", confidence: r.data.confidence }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const targetIsGroup = r.data.proposed_target === "group";
    let proposedTargetId: string | null = chosenGroup.id;
    let proposedTargetName: string | null = chosenGroup.nome_gruppo;
    if (!targetIsGroup) {
      const { data: prompt } = await supabase
        .from("operative_prompts")
        .select("id, name")
        .eq("name", "Email Groups Classifier")
        .limit(1)
        .maybeSingle();
      proposedTargetId = (prompt?.id as string | undefined) ?? null;
      proposedTargetName = (prompt?.name as string | undefined) ?? "Email Groups Classifier";
    }

    const { data: insight, error: insErr } = await supabase
      .from("ai_classification_insights")
      .insert({
        trigger_address: rule.email_address,
        trigger_address_rule_id: rule.id,
        ai_suggested_group_name: aiSuggested,
        ai_suggested_group_id: (aiGroup?.id as string | undefined) ?? null,
        user_chosen_group_name: chosenGroup.nome_gruppo,
        user_chosen_group_id: chosenGroup.id,
        sample_message_ids: samples.map((s) => s.id),
        sample_subjects: samples.map((s) => s.subject),
        proposed_target: r.data.proposed_target,
        proposed_target_id: proposedTargetId,
        proposed_target_name: proposedTargetName,
        change_type: "append_hint",
        proposed_change_text: r.data.proposed_change_text,
        reasoning: r.data.reasoning,
        confidence: r.data.confidence,
        user_note: userNote ?? null,
        created_by_user_id: userId,
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      console.error("[refine] insert error", insErr);
      return new Response(JSON.stringify({ error: "INSERT_FAILED" }), {
        status: 500,
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ ok: true, insight_id: insight?.id, confidence: r.data.confidence }),
      { headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[refine-classification-rule] fatal", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});