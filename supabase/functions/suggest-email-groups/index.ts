import "../_shared/llmFetchInterceptor.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimiter.ts";
import { z, safeParseToolArgs } from "../_shared/aiJsonValidator.ts";
import { loadOperativePrompts } from "../_shared/operativePromptsLoader.ts";

const ClassificationsSchema = z.object({
  classifications: z
    .array(
      z.object({
        email: z.string(),
        suggested_group: z.string(),
        confidence: z.number().min(0).max(1),
        reasoning: z.string().optional().default(""),
      }),
    )
    .default([]),
});

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await anonClient.auth.getUser();
    if (userError || !userData?.user?.id) {
      return new Response(JSON.stringify({ error: "INVALID_TOKEN" }), { status: 401, headers: { ...dynCors, "Content-Type": "application/json" } });
    }
    const user = { id: userData.user.id };

    // Rate limiting
    const rl = checkRateLimit(`suggest-groups:${user.id}`, { maxTokens: 5, refillRate: 0.08 });
    if (!rl.allowed) return rateLimitResponse(rl, dynCors);

    const body = await req.json();
    const minEmailCount = body.min_email_count ?? 3;
    const batchSize = body.batch_size ?? 20;
    const requestedEmails = Array.isArray(body.emails)
      ? body.emails.map((value: unknown) => String(value).trim().toLowerCase()).filter(Boolean)
      : [];

    // 1. Load groups — prima i gruppi dell'utente, fallback su gruppi
    // condivisi (uso interno aziendale, vedi memoria "Visibilità Globale").
    let { data: groups } = await supabase
      .from("email_sender_groups")
      .select("id, nome_gruppo, descrizione, classification_hint, response_style_hint")
      .eq("user_id", user.id);

    if (!groups || groups.length === 0) {
      const { data: sharedGroups } = await supabase
        .from("email_sender_groups")
        .select("id, nome_gruppo, descrizione, classification_hint, response_style_hint");
      groups = sharedGroups ?? [];
    }

    if (!groups || groups.length === 0) {
      return new Response(JSON.stringify({ error: "No groups configured" }), { status: 400, headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    // 2. Load addresses to analyze.
    // Quando l'utente passa email esplicite (singola o selezione), bypassiamo i
    // filtri "non classificato" e "min_email_count": è una richiesta puntuale
    // di rianalisi e deve sempre passare. Il filtro classico vale solo per la
    // modalità "scopri suggerimenti su tutto".
    const buildAddressQuery = (scopeToUser: boolean) => {
      let q = supabase
        .from("email_address_rules")
        .select("id, email_address, display_name, email_count, user_id")
        .order("email_count", { ascending: false });
      if (scopeToUser) q = q.eq("user_id", user.id);
      if (requestedEmails.length > 0) {
        q = q.in("email_address", requestedEmails);
      } else {
        q = q.is("group_id", null).gte("email_count", minEmailCount).limit(batchSize);
      }
      return q;
    };

    let { data: addresses } = await buildAddressQuery(true);
    if (!addresses || addresses.length === 0) {
      // Fallback: uso interno aziendale → se l'utente non ha record propri,
      // analizza i record condivisi (stesso pattern dei gruppi).
      const { data: shared } = await buildAddressQuery(false);
      addresses = shared ?? [];
    }

    if (!addresses || addresses.length === 0) {
      return new Response(JSON.stringify({ processed: 0, suggestions: [] }), { headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    let { data: learningRules } = await supabase
      .from("email_address_rules")
      .select("group_name, email_address, display_name, company_name, domain, custom_prompt, email_count")
      .eq("user_id", user.id)
      .not("group_name", "is", null)
      .order("email_count", { ascending: false })
      .limit(250);
    if (!learningRules || learningRules.length === 0) {
      const { data: sharedLearning } = await supabase
        .from("email_address_rules")
        .select("group_name, email_address, display_name, company_name, domain, custom_prompt, email_count")
        .not("group_name", "is", null)
        .order("email_count", { ascending: false })
        .limit(250);
      learningRules = sharedLearning ?? [];
    }

    // 3. For each address, get last 5 subjects + dominio noto + first contact
    const addressData: Array<{
      email: string;
      display_name: string | null;
      email_count: number;
      subjects: string[];
      ruleId: string;
      is_first_contact: boolean;
      domain_known: "yes" | "no";
      domain_known_group?: string | null;
    }> = [];

    // Pre-carica i domini già classificati (una sola query) per non interrogare
    // il DB per ogni address.
    const domainsToCheck = Array.from(new Set(
      addresses
        .map((a: { email_address: string }) => (a.email_address.split("@")[1] || "").toLowerCase())
        .filter(Boolean),
    ));
    const domainGroupMap = new Map<string, string>();
    if (domainsToCheck.length > 0) {
      let { data: domainRules } = await supabase
        .from("email_address_rules")
        .select("domain, group_name, email_count")
        .eq("user_id", user.id)
        .in("domain", domainsToCheck)
        .not("group_name", "is", null)
        .order("email_count", { ascending: false });
      if (!domainRules || domainRules.length === 0) {
        const { data: sharedDomain } = await supabase
          .from("email_address_rules")
          .select("domain, group_name, email_count")
          .in("domain", domainsToCheck)
          .not("group_name", "is", null)
          .order("email_count", { ascending: false });
        domainRules = sharedDomain ?? [];
      }
      for (const r of (domainRules ?? []) as Array<{ domain: string | null; group_name: string | null }>) {
        if (r.domain && r.group_name && !domainGroupMap.has(r.domain.toLowerCase())) {
          domainGroupMap.set(r.domain.toLowerCase(), r.group_name);
        }
      }
    }

    for (const addr of addresses) {
      const { data: msgs } = await supabase
        .from("channel_messages")
        .select("subject")
        .eq("from_address", addr.email_address)
        .eq("direction", "inbound")
        .order("created_at", { ascending: false })
        .limit(5);

      const emailCount = addr.email_count ?? 0;
      const dom = (addr.email_address.split("@")[1] || "").toLowerCase();
      const knownGroup = dom ? domainGroupMap.get(dom) ?? null : null;

      addressData.push({
        email: addr.email_address,
        display_name: addr.display_name,
        email_count: emailCount,
        subjects: (msgs || []).map((m: Record<string, unknown>) => m.subject || "").filter(Boolean),
        ruleId: addr.id,
        is_first_contact: emailCount <= 1,
        domain_known: knownGroup ? "yes" : "no",
        domain_known_group: knownGroup,
      });
    }

    const groupedExamples = new Map<string, string[]>();
    for (const rule of learningRules ?? []) {
      const groupName = typeof rule.group_name === "string" ? rule.group_name : null;
      if (!groupName) continue;
      const bucket = groupedExamples.get(groupName) ?? [];
      if (bucket.length >= 3) continue;
      const sampleParts = [
        typeof rule.company_name === "string" && rule.company_name.trim() ? `azienda: ${rule.company_name.trim()}` : null,
        typeof rule.display_name === "string" && rule.display_name.trim() ? `nome: ${rule.display_name.trim()}` : null,
        typeof rule.email_address === "string" && rule.email_address.trim() ? `email: ${rule.email_address.trim()}` : null,
        typeof rule.domain === "string" && rule.domain.trim() ? `dominio: ${rule.domain.trim()}` : null,
        typeof rule.custom_prompt === "string" && rule.custom_prompt.trim() ? `nota: ${rule.custom_prompt.trim().slice(0, 140)}` : null,
      ].filter((value): value is string => value !== null);
      bucket.push(`- ${sampleParts.join(" · ")}`);
      groupedExamples.set(groupName, bucket);
    }

    // 4. Call AI
    const groupsList = groups.map((g: Record<string, unknown>) => {
      const parts = [
        `- ${String(g.nome_gruppo)}`,
        typeof g.descrizione === "string" && g.descrizione.trim() ? `descrizione: ${g.descrizione.trim()}` : null,
        typeof g.classification_hint === "string" && g.classification_hint.trim() ? `hint: ${g.classification_hint.trim()}` : null,
        typeof g.response_style_hint === "string" && g.response_style_hint.trim() ? `stile: ${g.response_style_hint.trim()}` : null,
      ].filter((value): value is string => value !== null);
      return parts.join(" | ");
    }).join("\n");
    const addressList = addressData.map((a) => {
      const domHint = a.domain_known === "yes" && a.domain_known_group
        ? `dominio noto → già classificato come "${a.domain_known_group}"`
        : "dominio sconosciuto";
      const firstHint = a.is_first_contact ? "PRIMO CONTATTO" : `relazione esistente (${a.email_count} email)`;
      return [
        `Email: ${a.email}`,
        `Nome: ${a.display_name || "N/A"}`,
        `Volume: ${a.email_count}`,
        firstHint,
        domHint,
        `Ultimi oggetti: ${a.subjects.slice(0, 5).join(" | ") || "N/A"}`,
      ].join(", ");
    }).join("\n");
    const examplesList = groups.map((g: Record<string, unknown>) => {
      const groupName = String(g.nome_gruppo);
      const samples = groupedExamples.get(groupName) ?? [];
      if (samples.length === 0) return `## ${groupName}\n- nessun esempio ancora disponibile`;
      return `## ${groupName}\n${samples.join("\n")}`;
    }).join("\n\n");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    // Carica i prompt operativi dal Prompt Lab (scope: classification).
    // Editabili dall'operatore via /v2/prompt-lab senza redeploy.
    let operativeBlock = "";
    let appliedPromptNames: string[] = [];
    try {
      const op = await loadOperativePrompts(supabase, user.id, {
        scope: "classification",
        extraTags: ["email-groups-classifier"],
        includeUniversal: true,
        limit: 6,
      });
      operativeBlock = op.block;
      appliedPromptNames = op.appliedNames;
    } catch (e) {
      console.warn("[suggest-email-groups] operative prompts load failed:", (e as Error).message);
    }

    const systemPrompt = [
      "Sei il classificatore degli indirizzi email mittente per TMWE / Find Air, azienda di freight forwarding e logistica internazionale.",
      "Devi assegnare ogni address a UNO dei gruppi esistenti dell'operatore (mai inventarne di nuovi).",
      "Distingui sempre i mittenti REALI con cui abbiamo rapporto operativo dai COLD OUTREACH / pitch commerciali non richiesti.",
      operativeBlock || "",
    ].filter(Boolean).join("\n\n");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: `Gruppi disponibili:\n${groupsList}\n\nEsempi reali già classificati dall'operatore (usali come mini-guida di stile e perimetro, senza copiarli meccanicamente):\n${examplesList}\n\nPer ogni address email qui sotto, suggerisci il gruppo più appropriato.\n\nREGOLE:\n- Usa SOLO gruppi esistenti dalla lista sopra: l'obiettivo è RIDURRE i gruppi, non moltiplicarli\n- Preferisci sempre gruppi ampi e operativi (es. amministrativo, commerciale, banca, fornitori, clienti, spam, social) invece di micro-segmenti geografici o troppo specifici\n- Per mittenti LinkedIn/social automatici (inviti, notifiche, newsletter, noreply) scegli il gruppo social esistente più vicino: Social_Notification per notifiche/inviti, Social_News per newsletter/news, Social Spam solo se chiaramente indesiderato\n- Non creare sottogruppi tipo "clienti Francia" o "clienti Germania" se esiste già un gruppo più generale adeguato\n- Usa gli esempi già classificati per capire come l'azienda raggruppa davvero i mittenti\n- Basa la decisione su DOMINIO email, struttura del dominio, display name, OGGETTI ricorrenti, pattern del sender E sul CONTESTO RELAZIONALE (PRIMO CONTATTO vs relazione esistente, dominio noto vs sconosciuto)\n- **Cold_Outreach guardrail**: se è PRIMO CONTATTO + dominio sconosciuto + tono pitch/sales (growth manager, "we help", demo, lead gen) → suggerisci "Cold_Outreach" anche se il testo parla di logistica. Operativo richiede SEMPRE riferimento esplicito a spedizione/AWB/MAWB/B/L/booking/fattura/dogana o thread esistente.\n- Se il dominio è già stato classificato in un gruppo (vedi "dominio noto"), usa di norma lo stesso gruppo a meno che il pattern oggetti dica chiaramente l'opposto.\n- Se non sei sicuro (confidence < 0.4), suggerisci "uncategorized"\n- Rispondi SOLO con i dati del tool, niente testo extra\n\nFormato risposta: [{"email":"...","suggested_group":"nome_gruppo","confidence":0.0-1.0,"reasoning":"breve spiegazione"}]\n\nAddress da classificare (con feature relazionali):\n${addressList}`
          }
        ],
        tools: [{
          type: "function",
          function: {
            name: "classify_email_addresses",
            description: "Classify email addresses into groups",
            parameters: {
              type: "object",
              properties: {
                classifications: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      email: { type: "string" },
                      suggested_group: { type: "string" },
                      confidence: { type: "number" },
                      reasoning: { type: "string" }
                    },
                    required: ["email", "suggested_group", "confidence", "reasoning"],
                    additionalProperties: false
                  }
                }
              },
              required: ["classifications"],
              additionalProperties: false
            }
          }
        }],
        tool_choice: { type: "function", function: { name: "classify_email_addresses" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } });
    }

    const aiData = await aiResponse.json();
    let classifications: Array<{ email: string; suggested_group: string; confidence: number; reasoning: string }> = [];

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const r = safeParseToolArgs(toolCall.function.arguments, ClassificationsSchema, {
        fnName: "suggest-email-groups",
        model: "ai-tool-call",
        fallback: { classifications: [] },
      });
      classifications = r.data.classifications.map((c) => ({
        email: c.email,
        suggested_group: c.suggested_group,
        confidence: c.confidence,
        reasoning: c.reasoning,
      }));
      if (r.isFallback) {
        console.warn("[suggest-email-groups] schema fallback → empty classifications");
      }
    }

    // 5. Save suggestions
    let processed = 0;
    for (const cls of classifications) {
      if (cls.suggested_group === "uncategorized" || cls.confidence < 0.3) continue;
      const addrData = addressData.find((a) => a.email.toLowerCase() === cls.email.toLowerCase());
      if (!addrData) continue;

      await supabase
        .from("email_address_rules")
        .update({
          ai_suggested_group: cls.suggested_group,
          ai_suggestion_confidence: cls.confidence,
        })
        .eq("id", addrData.ruleId);

      processed++;
    }

    return new Response(
      JSON.stringify({ processed, suggestions: classifications, applied_prompts: appliedPromptNames }),
      { headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("suggest-email-groups error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});
