import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Extract sections from KB using <!-- SECTION:N --> markers */
function getKBSlice(fullKB: string): string {
  if (!fullKB) return "";
  // Use standard sections for improvement
  const allowedSections = [1, 2, 3, 4, 5, 6, 7, 8];
  const sectionRegex = /<!-- SECTION:(\d+) -->/g;
  const markers: { index: number; section: number }[] = [];
  let match;
  while ((match = sectionRegex.exec(fullKB)) !== null) {
    markers.push({ index: match.index, section: parseInt(match[1]) });
  }
  if (markers.length === 0) return fullKB.substring(0, 3000);
  const parts: string[] = [];
  for (let i = 0; i < markers.length; i++) {
    if (allowedSections.includes(markers[i].section)) {
      const start = markers[i].index;
      const end = i + 1 < markers.length ? markers[i + 1].index : fullKB.length;
      parts.push(fullKB.substring(start, end).trim());
    }
  }
  return parts.join("\n\n---\n\n").substring(0, 4000);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { subject, html_body, recipient_count, recipient_countries, oracle_tone, use_kb } = await req.json();
    if (!html_body) throw new Error("html_body is required");

    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Fetch user settings (profile, KB, sales techniques)
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value")
      .like("key", "ai_%");

    const settings: Record<string, string> = {};
    (settingsRows || []).forEach((r: any) => { settings[r.key] = r.value || ""; });

    const senderAlias = settings.ai_contact_alias || settings.ai_contact_name || "";
    const senderCompany = settings.ai_company_alias || settings.ai_company_name || "";
    const fullSalesKB = settings.ai_sales_knowledge_base || "";
    const salesKBSlice = getKBSlice(fullSalesKB);

    const systemPrompt = `Sei un esperto copywriter e consulente di vendita B2B nel settore della logistica internazionale e del freight forwarding.

Il tuo compito è MIGLIORARE un'email scritta manualmente dall'utente. NON riscriverla da zero — mantieni il messaggio, lo stile e l'intento dell'autore.

PROFILO MITTENTE:
- Nome: ${senderAlias}
- Azienda: ${senderCompany}
- Ruolo: ${settings.ai_contact_role || "N/A"}
- Settore: ${settings.ai_sector || "freight_forwarding"}
- Tono preferito: ${oracle_tone || settings.ai_tone || "professionale"}

${use_kb !== false && settings.ai_knowledge_base ? `KNOWLEDGE BASE AZIENDALE:\n${settings.ai_knowledge_base}\n` : ""}
${use_kb !== false && salesKBSlice ? `TECNICHE DI VENDITA:\n${salesKBSlice}\n` : ""}
${settings.ai_style_instructions ? `ISTRUZIONI STILE: ${settings.ai_style_instructions}\n` : ""}

REGOLE DI MIGLIORAMENTO:
1. Mantieni la STESSA lingua dell'email originale
2. Mantieni lo STESSO tono e stile dell'autore — non cambiare la personalità
3. Migliora: chiarezza, impatto, struttura, scelta delle parole, call-to-action
4. Applica le tecniche di vendita dalla KB dove appropriato (urgenza soft, value proposition, ecc.)
5. Correggi errori grammaticali e di punteggiatura
6. Mantieni le variabili template ({{company_name}}, {{contact_name}}, ecc.) INTATTE
7. NON allungare inutilmente — l'email deve rimanere concisa
8. Se l'email ha un oggetto, miglora anche quello
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

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("AI gateway error:", resp.status, errText);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit raggiunto, riprova tra poco" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti" }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI error: ${resp.status}`);
    }

    const result = await resp.json();
    const rawText = result.choices?.[0]?.message?.content || "";

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

    return new Response(JSON.stringify({ subject: improvedSubject, body: improvedBody }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("improve-email error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
