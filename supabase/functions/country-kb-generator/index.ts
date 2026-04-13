import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { aiChat } from "../_shared/aiGateway.ts";

serve(async (req) => {
  const pre = corsPreflight(req);
  if (pre) return pre;
  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json().catch(() => ({}));
    const countryCodes: string[] = body.country_codes || [];
    const maxCountries = Math.min(countryCodes.length || 5, 10);

    // Find countries without KB entries
    let targetCountries: string[];
    if (countryCodes.length > 0) {
      targetCountries = countryCodes.slice(0, maxCountries);
    } else {
      // Auto-detect: find countries with partners but no country_culture KB
      const { data: partnerCountries } = await supabase
        .from("partners")
        .select("country_code")
        .not("country_code", "is", null)
        .limit(200);

      const uniqueCodes = [...new Set((partnerCountries || []).map((p: Record<string, unknown>) => p.country_code as string))];

      const { data: existingKb } = await supabase
        .from("kb_entries")
        .select("tags")
        .eq("category", "country_culture")
        .eq("is_active", true);

      const coveredCodes = new Set<string>();
      for (const entry of (existingKb || []) as Record<string, unknown>[]) {
        const tags = entry.tags as string[] | null;
        if (tags) tags.forEach(t => { if (t.length === 2) coveredCodes.add(t.toLowerCase()); });
      }

      targetCountries = uniqueCodes
        .filter(code => code && !coveredCodes.has(code.toLowerCase()))
        .slice(0, maxCountries);
    }

    if (targetCountries.length === 0) {
      return new Response(JSON.stringify({ success: true, generated: 0, message: "Tutti i paesi hanno già regole KB" }), {
        headers: { ...dynCors, "Content-Type": "application/json" },
      });
    }

    const stats = { generated: 0, failed: 0, countries: [] as string[] };

    for (const code of targetCountries) {
      try {
        const prompt = `Genera regole di comunicazione commerciale per il paese con codice ISO "${code.toUpperCase()}" nel contesto del freight forwarding e logistica internazionale.

Rispondi SOLO con un JSON valido con questa struttura:
{
  "country_name": "Nome del paese in italiano",
  "tone": "formale|semi-formale|informale",
  "formality_level": "alto|medio|basso",
  "preferred_channels": ["email", "linkedin", "whatsapp", "telefono"],
  "greeting_style": "Come aprire la comunicazione (1 frase)",
  "business_culture_notes": "Note sulla cultura commerciale (2-3 frasi)",
  "email_tips": "Consigli specifici per email commerciali (2-3 frasi)",
  "avoid": "Cosa evitare nella comunicazione (1-2 frasi)",
  "best_contact_time": "Orari migliori per contattare",
  "language_preference": "Lingua preferita per business"
}`;

        const result = await aiChat({
          messages: [{ role: "user", content: prompt }],
          model: "google/gemini-2.5-flash-lite",
          temperature: 0.3,
          maxTokens: 800,
        });

        const content = result.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON in response");

        const parsed = JSON.parse(jsonMatch[0]);

        const kbContent = `## Comunicazione commerciale — ${parsed.country_name}

**Tono**: ${parsed.tone} (formalità: ${parsed.formality_level})
**Canali preferiti**: ${parsed.preferred_channels?.join(", ") || "email"}
**Lingua business**: ${parsed.language_preference || "inglese"}
**Orario migliore**: ${parsed.best_contact_time || "orario lavorativo locale"}

**Apertura**: ${parsed.greeting_style}

**Cultura commerciale**: ${parsed.business_culture_notes}

**Email tips**: ${parsed.email_tips}

**Da evitare**: ${parsed.avoid}`;

        await supabase.from("kb_entries").insert({
          title: `Regole comunicazione — ${parsed.country_name} (${code.toUpperCase()})`,
          content: kbContent,
          category: "country_culture",
          tags: [code.toLowerCase(), "auto_generated", "communication_rules"],
          priority: 3,
          is_active: true,
          user_id: null,
        });

        stats.generated++;
        stats.countries.push(code.toUpperCase());
      } catch (err: unknown) {
        console.warn(`[country-kb-generator] Failed for ${code}:`, err instanceof Error ? err.message : String(err));
        stats.failed++;
      }
    }

    console.log("[country-kb-generator] Stats:", JSON.stringify(stats));

    return new Response(JSON.stringify({ success: true, ...stats }), {
      headers: { ...dynCors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    console.error("country-kb-generator error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...dynCors, "Content-Type": "application/json" } },
    );
  }
});
