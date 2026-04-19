/**
 * ai-query-planner — Genera un QueryPlan strutturato da un prompt utente.
 *
 * Input:  { prompt: string, history?: {role,content}[] }
 * Output: { table, columns?, filters[], sort?, limit, title?, rationale? }
 *
 * L'AI ha conoscenza COMPLETA dello schema DB (iniettato nel system prompt)
 * e produce query SELECT che verranno eseguite client-side dal safe executor.
 *
 * Solo SELECT consentite. Mai mutazioni.
 */
import { corsHeaders } from "https://esm.sh/@supabase/[email protected]/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Schema DB inline (deve restare allineato a src/v2/agent/kb/dbSchema.ts)
const SCHEMA_TEXT = `
📊 partners
  Scopo: Partner della rete WCA (~25.000 record). Logistica/spedizionieri.
  Colonne: id, company_name, country_code (ISO-2: US, IT, CN, DE...), country_name, city,
           email, phone, mobile, website, rating (0-5), is_active, is_favorite,
           lead_status [new|first_touch_sent|holding|engaged|qualified|negotiation|converted|archived|blacklisted|contacted],
           office_type, interaction_count, last_interaction_at, member_since, created_at

📊 imported_contacts
  Scopo: Contatti CRM (clienti, lead, prospect).
  Colonne: id, name, company_name, email, phone, mobile, country, origin,
           lead_status [new|first_touch_sent|holding|engaged|qualified|negotiation|converted|archived|blacklisted],
           interaction_count, last_interaction_at, wca_partner_id, created_at

📊 outreach_queue
  Scopo: Coda messaggi outbound (email/wa/li).
  Colonne: id, partner_id, channel [email|whatsapp|linkedin], recipient_email, subject,
           status [pending|approved|sent|delivered|replied|bounced|failed|running],
           scheduled_at, processed_at, replied_at, created_at

📊 activities
  Scopo: Attività CRM (call, follow-up, meeting).
  Colonne: id, title, description, activity_type, status [pending|in_progress|completed|cancelled],
           priority [low|medium|high|urgent], partner_id, due_date, scheduled_at, completed_at,
           response_received, created_at

📊 channel_messages
  Scopo: Messaggi sincronizzati (inbound + outbound) email/wa/li.
  Colonne: id, channel, direction [inbound|outbound], from_address, to_address, subject,
           body_text, email_date, read_at, partner_id, category

📊 agents
  Scopo: Agenti AI configurati.
  Colonne: id, name, role, is_active, avatar_emoji, created_at

📊 agent_tasks
  Scopo: Task assegnati agli agenti AI.
  Colonne: id, agent_id, task_type, description,
           status [proposed|pending|running|completed|failed|cancelled],
           scheduled_at, started_at, completed_at, created_at

📊 kb_entries
  Scopo: Knowledge Base / doctrine.
  Colonne: id, title, content, category, chapter, priority, is_active, access_count

📊 business_cards
  Scopo: Biglietti da visita OCR.
  Colonne: id, contact_name, company_name, email, phone, position, location, event_name,
           match_status [matched|unmatched|needs_review], match_confidence,
           matched_partner_id, lead_status, created_at

📊 download_jobs
  Scopo: Job sync massive.
  Colonne: id, job_type, status [pending|running|completed|failed|cancelled],
           country_code, progress, created_at, completed_at

📊 campaign_jobs
  Scopo: Job campagne outbound.
  Colonne: id, batch_id, company_name, country_code, country_name, city, email,
           job_type [call|email|visit|qualify], status [pending|in_progress|completed|skipped],
           partner_id, created_at
`;

const SYSTEM_PROMPT = `Sei un AI Query Planner per un CRM logistico.
Riceverai una richiesta utente in italiano e DEVI tradurla in un QueryPlan JSON STRUTTURATO da eseguire su Supabase.

═══ SCHEMA DATABASE ═══
${SCHEMA_TEXT}

═══ FORMATO OUTPUT (OBBLIGATORIO) ═══
Rispondi SOLO con JSON valido (niente markdown, niente testo extra) seguendo questo schema:
{
  "table": "<nome_tabella_whitelisted>",
  "columns": ["col1","col2",...],            // opzionale, omettere = colonne predefinite
  "filters": [
    {"column":"<nome>","op":"<eq|neq|gt|gte|lt|lte|ilike|in|is>","value":<valore>}
  ],
  "sort": {"column":"<nome>","ascending":false},  // opzionale
  "limit": 50,                                    // 1-200, default 50
  "title": "<titolo breve risultato>",
  "rationale": "<perché hai scelto questi filtri, 1 frase>"
}

═══ REGOLE ═══
1. SOLO SELECT. Mai INSERT/UPDATE/DELETE. Mai colonne fuori schema.
2. Mappa nomi paesi a codici ISO-2 (USA/Stati Uniti→US, Cina→CN, Germania→DE, Italia→IT, ecc.) per partners.country_code.
3. Per ricerche testuali su company_name/name/title usa "ilike" (il safe executor wrappa con % automaticamente).
4. Se l'utente chiede "ultimi N", usa sort created_at desc + limit N.
5. Se l'utente chiede "più di X", "almeno X", usa gt/gte.
6. Per booleani (is_active, response_received): usa "eq" con true/false.
7. Per "senza email" / "campo vuoto": usa op "is" con value null.
8. Se la richiesta è ambigua, scegli la tabella più ovvia e aggiungi il rationale.
9. Default limit = 50. Cap massimo = 200.
10. Per campi enum (lead_status, status, channel, ecc.) usa SEMPRE i valori esatti elencati.

═══ ESEMPI ═══
"mostra partner US attivi con rating > 4"
→ {"table":"partners","filters":[{"column":"country_code","op":"eq","value":"US"},{"column":"is_active","op":"eq","value":true},{"column":"rating","op":"gt","value":4}],"sort":{"column":"rating","ascending":false},"limit":50,"title":"Partner US attivi rating > 4","rationale":"Country mappato a ISO-2 US, filtro rating numerico"}

"ultimi 20 prospect aggiunti"
→ {"table":"imported_contacts","filters":[],"sort":{"column":"created_at","ascending":false},"limit":20,"title":"Ultimi 20 contatti","rationale":"Ordinamento per data creazione decrescente"}

"contatti senza email"
→ {"table":"imported_contacts","filters":[{"column":"email","op":"is","value":null}],"limit":50,"title":"Contatti senza email","rationale":"Filtro IS NULL su email"}

"partner italiani con email Gmail"
→ {"table":"partners","filters":[{"column":"country_code","op":"eq","value":"IT"},{"column":"email","op":"ilike","value":"gmail.com"}],"limit":50,"title":"Partner IT con Gmail","rationale":"ilike per match parziale dominio"}

"messaggi non letti dell'ultima settimana"
→ {"table":"channel_messages","filters":[{"column":"direction","op":"eq","value":"inbound"},{"column":"read_at","op":"is","value":null}],"sort":{"column":"email_date","ascending":false},"limit":100,"title":"Inbound non letti","rationale":"direction inbound + read_at null"}

Se la richiesta richiede operazioni di scrittura, scansioni esterne o azioni, rispondi:
{"table":"INVALID","filters":[],"limit":1,"title":"N/A","rationale":"Richiesta non è una query di lettura"}
`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY non configurata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const prompt = typeof body?.prompt === "string" ? body.prompt : "";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt richiesto" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.slice(-6).map((m: { role: string; content: string }) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.content,
      })),
      { role: "user", content: prompt },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        response_format: { type: "json_object" },
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(
        JSON.stringify({ error: `AI gateway error: ${aiResp.status}`, detail: txt.slice(0, 500) }),
        { status: aiResp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const aiJson = await aiResp.json();
    const content: string = aiJson?.choices?.[0]?.message?.content ?? "";

    let plan: unknown;
    try {
      plan = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      plan = m ? JSON.parse(m[0]) : null;
    }

    if (!plan || typeof plan !== "object") {
      return new Response(
        JSON.stringify({ error: "Planner non ha prodotto JSON valido", raw: content.slice(0, 500) }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify(plan), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
