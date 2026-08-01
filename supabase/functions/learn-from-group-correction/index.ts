import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { aiFetch } from "../_shared/aiCallShim.ts";

/**
 * learn-from-group-correction
 *
 * Quando l'operatore sceglie un gruppo diverso dal suggerimento AI,
 * questa function:
 *  1. Rilegge gli oggetti delle ultime mail del mittente corretto.
 *  2. Carica 2-3 mittenti già nel gruppo SCELTO (con i loro subject) come esempio.
 *  3. Chiede all'AI di scrivere/aggiornare un'istruzione KB su come distinguere
 *     correttamente in futuro (e perché il suggerimento precedente era sbagliato).
 *  4. Salva l'istruzione in `kb_entries` con tag `email_classification` +
 *     `group_correction` + nome gruppo, in modo che il prossimo run di
 *     suggest-email-groups la trovi automaticamente.
 *
 * Fire-and-forget dal client: gli errori non devono mai bloccare l'UI.
 */
serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const dynCors = getCorsHeaders(req.headers.get("origin"));

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const rl = checkRateLimit(`learn-correction:${userId}`, { maxTokens: 10, refillRate: 0.2 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const suggestedGroup = String(body.suggested_group || "").trim();
    const chosenGroup = String(body.chosen_group || "").trim();
    if (!email || !chosenGroup || suggestedGroup === chosenGroup) {
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // 1) Subjects delle ultime mail del mittente corretto.
    const { data: msgs } = await supabase
      .from("channel_messages")
      .select("subject, snippet")
      .eq("from_address", email)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(5);
    const senderSubjects = (msgs || [])
      .map((m: Record<string, unknown>) => String(m.subject || "").trim())
      .filter(Boolean);

    // 2) Esempi (2-3 mittenti) già nel gruppo SCELTO con relativi subject.
    const { data: peers } = await supabase
      .from("email_address_rules")
      .select("email_address, display_name, company_name, domain")
      .eq("user_id", userId)
      .eq("group_name", chosenGroup)
      .neq("email_address", email)
      .order("email_count", { ascending: false })
      .limit(3);

    const peerSamples: Array<{ email: string; display_name: string | null; subjects: string[] }> = [];
    for (const p of peers || []) {
      const { data: pmsgs } = await supabase
        .from("channel_messages")
        .select("subject")
        .eq("from_address", p.email_address)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(3);
      peerSamples.push({
        email: String(p.email_address),
        display_name: (p.display_name as string | null) ?? null,
        subjects: (pmsgs || []).map((m: Record<string, unknown>) => String(m.subject || "").trim()).filter(Boolean),
      });
    }

    // 3) Chiedi all'AI di scrivere l'istruzione di apprendimento.
    const LOVABLE_API_KEY = (Deno.env.get("OPENAI_API_KEY") || Deno.env.get("ANTHROPIC_API_KEY") || Deno.env.get("LOVABLE_API_KEY"));
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const peersBlock = peerSamples.length === 0
      ? "(nessun altro mittente già nel gruppo)"
      : peerSamples.map((p) =>
          `- ${p.email}${p.display_name ? ` (${p.display_name})` : ""}\n  subject: ${p.subjects.join(" | ") || "N/A"}`
        ).join("\n");

    const prompt =
`L'operatore ha CORRETTO una tua classificazione email.

Mittente: ${email}
Subject recenti del mittente: ${senderSubjects.join(" | ") || "N/A"}

Tu avevi suggerito il gruppo: "${suggestedGroup || "(nessuno)"}"
L'operatore ha scelto invece: "${chosenGroup}"

Esempi reali di altri mittenti già classificati nel gruppo "${chosenGroup}":
${peersBlock}

COMPITO:
- Capisci PERCHÉ il gruppo corretto è "${chosenGroup}" osservando i pattern (dominio, display name, struttura subject, tema ricorrente).
- Scrivi un'istruzione operativa breve (max 6 righe) che migliori i prossimi suggerimenti automatici.
- Sii concreto: cita pattern (dominio, parole chiave nei subject, tipo di mittente).
- Non inventare: se i dati non bastano, dichiaralo e suggerisci di osservare ancora.
- Inizia con: "Quando il mittente ha questi pattern, classificalo come ${chosenGroup}:".

Rispondi SOLO con il testo dell'istruzione, niente preamboli.`;

    const aiResponse = await aiFetch({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Sei un classificatore email che impara dagli errori. Scrivi istruzioni concise e operative." },
          { role: "user", content: prompt },
        ],
      });
    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiResponse.json();
    const lesson = String(aiData.choices?.[0]?.message?.content || "").trim();
    if (!lesson) {
      return new Response(JSON.stringify({ ok: true, empty: true }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    // 4) Salva/aggiorna entry KB.
    const tags = ["email_classification", "group_correction", chosenGroup];
    const title = `Correzione classificazione → ${chosenGroup}`;
    const content =
`${lesson}

— Caso: il mittente ${email} era stato suggerito come "${suggestedGroup || "n/d"}", ma l'operatore lo ha messo in "${chosenGroup}".
Subject di riferimento: ${senderSubjects.slice(0, 3).join(" | ") || "N/A"}.`;

    const { data: existing } = await supabase
      .from("kb_entries")
      .select("id, content")
      .eq("user_id", userId)
      .eq("category", "email_management")
      .eq("title", title)
      .maybeSingle();

    if (existing?.id) {
      const merged = `${existing.content}\n\n---\n${content}`.slice(-6000);
      await supabase.from("kb_entries").update({
        content: merged,
        tags,
        priority: 7,
        is_active: true,
      }).eq("id", existing.id);
    } else {
      await supabase.from("kb_entries").insert({
        user_id: userId,
        category: "email_management",
        title,
        content,
        tags,
        priority: 7,
        is_active: true,
      });
    }

    // Log della correzione in ai_decision_log per audit.
    await supabase.from("ai_decision_log").insert({
      user_id: userId,
      decision_type: "email_group_correction",
      input_context: { email, suggested_group: suggestedGroup, sender_subjects: senderSubjects },
      decision_output: { chosen_group: chosenGroup, lesson },
      confidence: 1.0,
    });

    return new Response(JSON.stringify({ ok: true, lesson }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("learn-from-group-correction error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});