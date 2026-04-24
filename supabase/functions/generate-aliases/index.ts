import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = ReturnType<typeof createClient<any>>;


const BATCH_SIZE = 15;

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const { countryCodes, partnerIds, contactIds } = await req.json();

    const supabase = createClient<any>(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // ── Branch: imported_contacts (contactIds) ──
    if (contactIds?.length) {
      return await processImportedContacts(supabase, LOVABLE_API_KEY, contactIds);
    }

    // ── Branch: partners by ID ──
    if (partnerIds?.length) {
      return await processPartnersByIds(supabase, LOVABLE_API_KEY, partnerIds);
    }

    // ── Branch: partners by country (original) ──
    if (!countryCodes?.length) throw new Error("countryCodes, partnerIds, or contactIds required");
    return await processPartnersByCountry(supabase, LOVABLE_API_KEY, countryCodes);

  } catch (e: unknown) {
    console.error("generate-aliases error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } }
    );
  }
});

const SYSTEM_PROMPT = `Sei un esperto di comunicazione commerciale italiana. Il tuo compito è generare alias naturali per aziende e contatti, come li userebbe un professionista italiano in un'email.

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
- NON usare mai nome + cognome insieme`;

const TOOL_DEF = {
  type: "function" as const,
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
              id: { type: "string" },
              company_alias: { type: "string" },
              contact_alias: { type: "string" },
            },
            required: ["id", "company_alias", "contact_alias"],
            additionalProperties: false,
          },
        },
      },
      required: ["aliases"],
      additionalProperties: false,
    },
  },
};

async function callAI(apiKey: string, items: Array<Record<string, unknown>>) {
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(items) },
      ],
      tools: [TOOL_DEF],
      tool_choice: { type: "function", function: { name: "save_aliases" } },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI error:", response.status, errText);
    if (response.status === 429) return null; // signal retry
    throw new Error(`AI gateway error: ${response.status}`);
  }

  const aiResult = await response.json();
  const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    console.error("No tool call in response:", JSON.stringify(aiResult));
    return [];
  }
  const { aliases } = JSON.parse(toolCall.function.arguments);
  return aliases || [];
}

function ok(data: Record<string, unknown>) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

// ── Process imported_contacts ──
async function processImportedContacts(supabase: SupabaseClient, apiKey: string, contactIds: string[]) {
  const { data: contacts, error } = await supabase
    .from("imported_contacts")
    .select("id, company_name, name, company_alias, contact_alias")
    .in("id", contactIds);

  if (error) throw error;

  const eligible = (contacts || []).filter(
    (c: Record<string, unknown>) => !c.company_alias || !c.contact_alias
  );

  if (!eligible.length) return ok({ success: true, processed: 0, message: "Nessun contatto da elaborare" });

  let totalProcessed = 0;

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);
    const items = batch.map((c: Record<string, unknown>) => ({
      id: c.id,
      company_name: c.company_name || "",
      full_name: c.name || "",
      needs_company_alias: !c.company_alias,
      needs_contact_alias: !c.contact_alias,
    }));

    const aliases = await callAI(apiKey, items);
    if (aliases === null) {
      await new Promise((r) => setTimeout(r, 5000));
      i -= BATCH_SIZE;
      continue;
    }

    for (const alias of aliases) {
      const original = batch.find((c: Record<string, unknown>) => c.id === alias.id);
      if (!original) continue;
      const update: Record<string, unknown> = {};
      if (alias.company_alias && !original.company_alias) update.company_alias = alias.company_alias;
      if (alias.contact_alias && !original.contact_alias) update.contact_alias = alias.contact_alias;
      if (Object.keys(update).length) {
        await supabase.from("imported_contacts").update(update).eq("id", alias.id);
        totalProcessed++;
      }
    }
  }

  return ok({ success: true, processed: totalProcessed, total: eligible.length });
}

// ── Process partners by specific IDs ──
async function processPartnersByIds(supabase: SupabaseClient, apiKey: string, partnerIds: string[]) {
  const { data: partners, error } = await supabase
    .from("partners")
    .select("id, company_name, company_alias, partner_contacts(id, name, title, contact_alias)")
    .in("id", partnerIds);

  if (error) throw error;
  return processPartners(supabase, apiKey, partners || []);
}

// ── Process partners by country (original logic) ──
async function processPartnersByCountry(supabase: SupabaseClient, apiKey: string, countryCodes: string[]) {
  const { data: partners, error } = await supabase
    .from("partners")
    .select("id, company_name, country_code, company_alias, partner_contacts(id, name, title, contact_alias)")
    .in("country_code", countryCodes);

  if (error) throw error;
  return processPartners(supabase, apiKey, partners || []);
}

async function processPartners(supabase: SupabaseClient, apiKey: string, partners: Array<Record<string, unknown>>) {
  // deno-lint-ignore no-explicit-any
  const eligible = partners.filter((p: any) => {
    const contacts = (p.partner_contacts || []) as any[];
    return !p.company_alias || contacts.some((c: any) => !c.contact_alias);
  });

  if (!eligible.length) return ok({ success: true, processed: 0, message: "Nessun partner da elaborare" });

  let totalProcessed = 0;
  let totalContacts = 0;

  // Use legacy tool schema for partner mode
  const PARTNER_TOOL = {
    type: "function" as const,
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
  };

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE);

    // deno-lint-ignore no-explicit-any
    const partnerList = batch.map((p: any) => {
      const contacts = ((p.partner_contacts || []) as any[])
        .filter((c: any) => !c.contact_alias)
        .map((c: any) => ({ contact_id: c.id, full_name: c.name, title: c.title || "" }));
      return {
        partner_id: p.id,
        company_name: p.company_name,
        needs_company_alias: !p.company_alias,
        contacts,
      };
    }).filter((p) => p.needs_company_alias || p.contacts.length > 0);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(partnerList) },
        ],
        tools: [PARTNER_TOOL],
        tool_choice: { type: "function", function: { name: "save_aliases" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      if (response.status === 429) {
        await new Promise((r) => setTimeout(r, 5000));
        i -= BATCH_SIZE;
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

    for (const alias of aliases) {
      const original = batch.find((p: Record<string, unknown>) => p.id === alias.partner_id);
      if (alias.company_alias && (!original || !original.company_alias)) {
        await supabase.from("partners").update({ company_alias: alias.company_alias }).eq("id", alias.partner_id);
        totalProcessed++;
      }
      for (const contact of alias.contacts || []) {
        if (contact.contact_alias) {
          await supabase.from("partner_contacts").update({ contact_alias: contact.contact_alias }).eq("id", contact.contact_id);
          totalContacts++;
        }
      }
    }
  }

  return ok({ success: true, processed: totalProcessed, contacts: totalContacts, total: eligible.length });
}
