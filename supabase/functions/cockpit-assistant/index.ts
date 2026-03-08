import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sei l'assistente AI della Command Bar del Cockpit outreach. Ricevi la lista dei contatti attualmente visibili e il comando dell'utente. Devi restituire azioni strutturate che il frontend eseguirà.

RISPONDI SEMPRE in italiano, breve e operativo.

AZIONI DISPONIBILI (restituisci un JSON con "actions" array e "message" stringa):

1. filter — Applica filtri sulla lista contatti
   { "type": "filter", "filters": [{"id": "lang-it", "label": "🇮🇹 Italiano", "type": "language"}] }
   Tipi filtro: language, country, channel, priority, status, custom
   
2. select_all — Seleziona tutti i contatti visibili
   { "type": "select_all" }

3. clear_selection — Deseleziona tutti
   { "type": "clear_selection" }

4. select_where — Seleziona contatti che matchano un criterio
   { "type": "select_where", "field": "priority"|"country"|"language"|"channels", "operator": ">="|"=="|"includes", "value": ... }
   Esempi: {"type":"select_where","field":"priority","operator":">=","value":7}
           {"type":"select_where","field":"country","operator":"==","value":"IT"}
           {"type":"select_where","field":"channels","operator":"includes","value":"email"}

5. bulk_action — Lancia un'azione sui contatti selezionati
   { "type": "bulk_action", "action": "deep_search"|"alias"|"outreach" }

6. single_action — Azione su un singolo contatto (specificare il nome)
   { "type": "single_action", "action": "deep_search"|"alias", "contactName": "Marco Bianchi" }

7. view_mode — Cambia modalità visualizzazione
   { "type": "view_mode", "mode": "card"|"list" }

8. auto_outreach — Filtra, seleziona e prepara outreach automaticamente
   { "type": "auto_outreach", "channel": "email"|"linkedin"|"whatsapp"|"sms", "contactNames": ["Marco Bianchi", "Roberto Esposito"] }

REGOLE:
- Puoi combinare più azioni in sequenza (es. filter + select_where + bulk_action).
- Se l'utente chiede "prepara email per gli italiani", restituisci: filter italiano → select_where country IT → auto_outreach email.
- Se l'utente chiede qualcosa che non rientra nelle azioni, restituisci actions vuoto e un message esplicativo.
- NON inventare contatti che non sono nella lista fornita.
- Il "message" è mostrato come toast di conferma all'utente.

FORMATO RISPOSTA (SOLO JSON, niente altro):
{"actions":[...],"message":"..."}`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { command, contacts } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build context from contacts
    const contactSummary = (contacts || []).map((c: any) =>
      `- ${c.name} | ${c.company} | ${c.country} | priority:${c.priority} | lang:${c.language} | channels:${(c.channels||[]).join(",")}`
    ).join("\n");

    const userPrompt = `CONTATTI ATTUALMENTE VISIBILI (${contacts?.length || 0}):
${contactSummary}

COMANDO UTENTE: "${command}"`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const text = await response.text();
      console.error("AI gateway error:", status, text);
      const errorMsg = status === 429 ? "Troppe richieste, riprova tra poco." : status === 402 ? "Crediti AI esauriti." : "Errore AI gateway";
      return new Response(JSON.stringify({ error: errorMsg }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content || "";

    // Extract JSON from response (may be wrapped in markdown code blocks)
    let parsed: any = null;
    try {
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, content];
      parsed = JSON.parse(jsonMatch[1].trim());
    } catch {
      try {
        // Try direct parse
        parsed = JSON.parse(content.trim());
      } catch {
        // Fallback: no structured actions, just message
        parsed = { actions: [], message: content.replace(/```[\s\S]*?```/g, "").trim() || "Non ho capito il comando." };
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cockpit-assistant error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
