import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsPreflight, getCorsHeaders } from "../_shared/cors.ts";
import { aiChat, mapErrorToResponse } from "../_shared/aiGateway.ts";
// getKBSlice deprecated — kb_entries is the single source of truth

/** Fetch KB entries optimized for email improvement — focus on style and techniques */
async function fetchKbEntriesForImprove(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<{ text: string; sections: string[] }> {
  const { data: entries } = await supabase
    .from("kb_entries")
    .select("title, content, category, chapter, tags")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("category", ["regole_sistema", "struttura_email", "chris_voss", "negoziazione", "hook", "persuasione", "tono", "errori"])
    .gte("priority", 6)
    .order("priority", { ascending: false })
    .order("sort_order")
    .limit(15);

  if (!entries || entries.length === 0) return { text: "", sections: [] };

  const sections = [...new Set(entries.map((e: { category: string }) => e.category))];
  return {
    text: entries.map((e: { title: string; content: string }) => `### ${e.title}\n${e.content}`).join("\n\n---\n\n"),
    sections,
  };
}

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { subject, html_body, recipient_count, recipient_countries, oracle_tone, use_kb, email_type_id, email_type_structure } = await req.json();
    if (!html_body) throw new Error("html_body is required");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch user settings (scoped to authenticated user)
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("user_id", userId)
      .like("key", "ai_%");

    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: { key: string; value: string | null }) => { settings[r.key] = r.value || ""; });

    const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
    const senderCompany = settings.ai_company_alias || settings.ai_company_name || "";

    // Use granular kb_entries first, fallback to legacy monolithic
    const kbResult = await fetchKbEntriesForImprove(supabase, userId);
    const fullSalesKB = settings.ai_sales_knowledge_base || "";
    const salesKBSlice = kbResult.text;
    if (!kbResult.text && fullSalesKB) {
      console.warn("[improve-email] kb_entries vuoto, fallback monolitico DEPRECATO — migrare a kb_entries");
    }

    // ─── Decision Object ───
    const decision = {
      email_type: email_type_id || "generico",
      tone: oracle_tone || settings.ai_tone || "professionale",
      max_length_lines: 12,
      improvement_focus: email_type_id === "follow_up"
        ? "urgenza_soft_e_cta"
        : email_type_id === "primo_contatto"
          ? "hook_e_personalizzazione"
          : "struttura_e_impatto",
    };

    // ─── Readiness Scoring (simplified for improve) ───
    const readiness = {
      sender: [
        settings.ai_contact_alias || settings.ai_contact_name ? 30 : 0,
        settings.ai_company_alias || settings.ai_company_name ? 30 : 0,
        settings.ai_knowledge_base ? 20 : 0,
        settings.ai_contact_role ? 20 : 0,
      ].reduce((a, b) => a + b, 0),
      kb: kbResult.text ? Math.min(100, kbResult.sections.length * 20) : 0,
    };

    const systemPrompt = `Sei un esperto copywriter, stratega di vendita B2B e consulente di comunicazione nel settore della logistica internazionale e del freight forwarding.

Il tuo compito è MIGLIORARE un'email scritta manualmente dall'utente. NON riscriverla da zero — mantieni il messaggio, lo stile e l'intento dell'autore.

DECISION OBJECT (contesto per il miglioramento):
${JSON.stringify(decision, null, 2)}

## Come migliorare:
1. ANALIZZA l'email e identifica punti deboli (hook mancante, CTA assente, tono piatto, struttura confusa)
2. APPLICA tecniche dalla KB: Label, Mirroring, domande calibrate, urgenza soft — dove appropriato
3. RAFFORZA la call-to-action: se manca, aggiungine una. Se è debole, rendila specifica.
4. MIGLIORA l'hook iniziale: la prima riga deve catturare l'attenzione
5. TAGLIA il superfluo: ogni riga deve avere uno scopo

PROFILO MITTENTE:
- Nome: ${senderAlias}
- Azienda: ${senderCompany}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Tono preferito: ${oracle_tone || settings.ai_tone || "professionale"}

${use_kb !== false && settings.ai_knowledge_base ? `KNOWLEDGE BASE AZIENDALE:\n${settings.ai_knowledge_base}\n` : ""}
${use_kb !== false && salesKBSlice ? `# TECNICHE DI VENDITA E COMUNICAZIONE (${kbResult.sections.join(", ")}):\nApplica queste tecniche dove migliorano l'email.\n\n${salesKBSlice}\n` : ""}
${settings.ai_style_instructions ? `ISTRUZIONI STILE: ${settings.ai_style_instructions}\n` : ""}
${email_type_structure ? `STRUTTURA EMAIL RICHIESTA:\n${email_type_structure}\n` : ""}

REGOLE DI MIGLIORAMENTO:
1. Mantieni la STESSA lingua dell'email originale
2. Mantieni lo STESSO tono e stile dell'autore — non cambiare la personalità
3. Migliora: hook iniziale, struttura, scelta parole, CTA, impatto commerciale
4. Applica le tecniche dalla KB dove NATURALE (non forzare)
5. Correggi errori grammaticali e di punteggiatura
6. Mantieni le variabili template ({{company_name}}, {{contact_name}}, ecc.) INTATTE
7. NON allungare inutilmente — l'email deve rimanere concisa (max 10-15 righe)
8. Se l'email ha un oggetto, miglora anche quello con più impatto
9. L'output DEVE essere HTML valido per email (usa <p>, <br/>, <strong>, <em>, <ul>, <li>)
10. NON aggiungere firma — viene gestita separatamente

${recipient_count ? `Questa email sarà inviata a ${recipient_count} destinatari${recipient_countries ? ` in: ${recipient_countries}` : ""}.` : ""}

Rispondi SOLO con:
Subject: <oggetto migliorato>

<corpo HTML migliorato>`;

    const userPrompt = `Ecco l'email da migliorare:

${subject ? `Oggetto originale: ${subject}\n` : ""}
Corpo:
${html_body}`;

    const result = await aiChat({
      models: ["google/gemini-3-flash-preview", "openai/gpt-5-mini"],
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      timeoutMs: 30000,
      maxRetries: 1,
      context: `improve-email:${userId.substring(0, 8)}`,
    });
    const rawText = result.content || "";

    // Parse subject and body
    let improvedSubject = subject || "";
    let improvedBody = rawText;

    const subjectMatch = rawText.match(/^Subject:\s*(.+?)(?:\n|$)/im);
    if (subjectMatch) {
      improvedSubject = subjectMatch[1].trim();
      improvedBody = rawText.substring(subjectMatch[0].length).trim();
    }

    // Clean markdown code fences if present
    improvedBody = improvedBody.replace(/^```html?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    return new Response(JSON.stringify({
      subject: improvedSubject,
      body: improvedBody,
      readiness,
      decision,
    }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("improve-email error:", e);
    return mapErrorToResponse(e, getCorsHeaders(req.headers.get("origin")));
  }
});
