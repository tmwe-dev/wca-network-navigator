import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { countryCodes } = await req.json();
    if (!countryCodes?.length) throw new Error("countryCodes required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Load ALL partners in selected countries (including those without contacts)
    const { data: partners, error: pErr } = await supabase
      .from("partners")
      .select("id, company_name, country_code, company_alias, partner_contacts(id, name, title, email, direct_phone, mobile, contact_alias)")
      .in("country_code", countryCodes);

    if (pErr) throw pErr;

    // Filter: partners that need company_alias OR have contacts needing contact_alias
    const eligible = (partners || []).filter((p: any) => {
      const contacts = p.partner_contacts || [];
      const needsCompanyAlias = !p.company_alias;
      const needsContactAlias = contacts.some((c: any) => !c.contact_alias && (c.email || c.direct_phone || c.mobile));
      return needsCompanyAlias || needsContactAlias;
    });

    if (!eligible.length) {
      return new Response(JSON.stringify({ success: true, processed: 0, message: "Nessun partner da elaborare" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;
    let totalContacts = 0;

    // Process in batches
    for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
      const batch = eligible.slice(i, i + BATCH_SIZE);

      const partnerList = batch.map((p: any) => {
        const contacts = (p.partner_contacts || [])
          .filter((c: any) => !c.contact_alias && (c.email || c.direct_phone || c.mobile))
          .map((c: any) => ({
            contact_id: c.id,
            full_name: c.name,
            title: c.title || "",
          }));
        return {
          partner_id: p.id,
          company_name: p.company_name,
          needs_company_alias: !p.company_alias,
          contacts,
        };
      }).filter((p: any) => p.needs_company_alias || p.contacts.length > 0);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Sei un esperto di comunicazione commerciale italiana. Il tuo compito è generare alias naturali per aziende e contatti, come li userebbe un professionista italiano in un'email.

REGOLE PER ALIAS AZIENDA (company_alias):
- Rimuovi suffissi legali: SPA, SRL, LLC, Ltd, Inc, GmbH, d.o.o., S.A., Corp, Pty, dba, etc.
- Rimuovi la città se è nel nome (es. "World Transport Overseas d.o.o. Sarajevo" → "World Transport Overseas")
- Mantieni il nome riconoscibile e naturale
- Se il nome è già corto e senza suffissi, lascialo com'è

REGOLE PER ALIAS CONTATTO (contact_alias):
- Usa SOLO il cognome (es. "Mr. Christian Halpaus" → "Halpaus")
- Rimuovi titoli (Mr., Mrs., Ms., Dr., Ing., etc.)
- Se il nome sembra un ruolo e non un nome di persona (es. "President", "Manager", "Operations"), restituisci stringa vuota ""
- Se c'è solo un nome senza cognome chiaro, usa quel nome
- NON usare mai nome + cognome insieme`,
            },
            {
              role: "user",
              content: JSON.stringify(partnerList),
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "save_aliases",
                description: "Salva gli alias generati per aziende e contatti",
                parameters: {
                  type: "object",
                  properties: {
                    aliases: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          partner_id: { type: "string" },
                          company_alias: { type: "string" },
                          contacts: {
                            type: "array",
                            items: {
                              type: "object",
                              properties: {
                                contact_id: { type: "string" },
                                contact_alias: { type: "string" },
                              },
                              required: ["contact_id", "contact_alias"],
                              additionalProperties: false,
                            },
                          },
                        },
                        required: ["partner_id", "company_alias", "contacts"],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["aliases"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "save_aliases" } },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("AI error:", response.status, errText);
        if (response.status === 429) {
          // Wait and retry
          await new Promise((r) => setTimeout(r, 5000));
          i -= BATCH_SIZE; // retry this batch
          continue;
        }
        throw new Error(`AI gateway error: ${response.status}`);
      }

      const aiResult = await response.json();
      const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.error("No tool call in response:", JSON.stringify(aiResult));
        continue;
      }

      const { aliases } = JSON.parse(toolCall.function.arguments);

      // Save to DB
      for (const alias of aliases) {
        // Only save company alias if the partner needed one
        const original = batch.find((p: any) => p.id === alias.partner_id);
        if (alias.company_alias && (!original || !original.company_alias)) {
          await supabase
            .from("partners")
            .update({ company_alias: alias.company_alias })
            .eq("id", alias.partner_id);
          totalProcessed++;
        }

        for (const contact of alias.contacts || []) {
          if (contact.contact_alias) {
            await supabase
              .from("partner_contacts")
              .update({ contact_alias: contact.contact_alias })
              .eq("id", contact.contact_id);
            totalContacts++;
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: totalProcessed,
        contacts: totalContacts,
        total: eligible.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("generate-aliases error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
