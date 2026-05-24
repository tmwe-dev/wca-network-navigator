/**
 * Edge function: kb-intake-analyze
 *
 * Riceve nuovo materiale (paste/url/file content) e propone:
 *  - categoria + chapter + titolo + tags + priorità
 *  - duplicati (entry esistenti molto simili)
 *  - conflitti (entry esistenti con contenuto opposto)
 *  - razionale per scelte
 *
 * NON scrive in kb_entries. Restituisce solo il payload da inserire
 * in `kb_entry_proposals` lato UI.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";
import { aiFetch } from "../_shared/aiCallShim.ts";

interface Body {
  raw_content: string;
  source?: "paste" | "url" | "file" | "chat";
  source_url?: string;
  hint_category?: string;
}

const SYSTEM = [
  "Sei l'analista della Knowledge Base.",
  "Ricevi nuovo materiale e una lista di entry esistenti pertinenti.",
  "Compito: decidere dove andrebbe collocato e se duplica/contraddice qualcosa.",
  "Restituisci ESCLUSIVAMENTE un JSON in questo formato:",
  "{",
  '  "suggested_category": "...",  // categoria sorgente (es. doctrine, procedures, voice_rules)',
  '  "suggested_chapter": "...",   // breve, tutto minuscolo, separatori "_"',
  '  "suggested_title": "...",     // titolo sintetico',
  '  "suggested_content": "...",   // versione pulita/formattata del contenuto',
  '  "suggested_tags": ["...", "..."],',
  '  "suggested_priority": 50,    // 0-100',
  '  "duplicates_of": "<uuid|null>",',
  '  "conflicts_with": ["<uuid>", ...],',
  '  "rationale": "..."',
  "}",
].join("\n");

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const body = (await req.json()) as Body;
    if (!body.raw_content || body.raw_content.trim().length < 10) {
      return new Response(JSON.stringify({ error: "raw_content troppo breve" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Carica un campione di KB esistente (limite per token budget)
    let q = supabase
      .from("kb_entries")
      .select("id, category, chapter, title, content, priority")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .limit(40);
    if (body.hint_category) q = q.eq("category", body.hint_category);
    const { data: kb, error } = await q;
    if (error) throw error;

    const kbBlock = (kb ?? []).map((e) =>
      `- id:${(e as { id: string }).id} [${(e as { category: string }).category}/${(e as { chapter: string | null }).chapter ?? "-"}] ${(e as { title: string }).title}: ${((e as { content: string }).content || "").slice(0, 200)}`
    ).join("\n");

    const userMsg = [
      "MATERIALE NUOVO:",
      "---",
      body.raw_content.slice(0, 4000),
      "---",
      "",
      `KB ESISTENTE (${(kb ?? []).length} entry, priorità decrescente):`,
      kbBlock || "(vuota)",
    ].join("\n");

    const aiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!aiKey) throw new Error("LOVABLE_API_KEY non configurata");

    const aiResp = await aiFetch({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        response_format: { type: "json_object" },
      });

    if (!aiResp.ok) {
      const status = aiResp.status === 429 || aiResp.status === 402 ? aiResp.status : 500;
      const msg = aiResp.status === 429 ? "Rate limit" : aiResp.status === 402 ? "Crediti esauriti" : "AI gateway error";
      return new Response(JSON.stringify({ error: msg }),
        { status, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const aiJson = await aiResp.json();
    const content = aiJson?.choices?.[0]?.message?.content ?? "{}";
    let parsed: Record<string, unknown> = {};
    try { parsed = JSON.parse(content); } catch { parsed = { rationale: content }; }

    return new Response(JSON.stringify({
      proposal: parsed,
      kb_sample_size: (kb ?? []).length,
      source: body.source ?? "paste",
      source_url: body.source_url ?? null,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});